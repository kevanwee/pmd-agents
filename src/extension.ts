import * as vscode from 'vscode';
import {randomUUID} from 'node:crypto';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {type Event} from './core';
import {WorkspaceLease} from './autoconnect';
import {Sessions} from './sessions';
import {startReceiver} from './receiver';
import {prepareSetup,installSetup,type HookPlan} from './setup';
import {loadPack,validateSpecies} from './assets';
import {loadDex,trackerFetch} from './catalog';
import {portraitFile,portraitPath,type Dex} from './dex';
import {cachedFetch,ensurePortraits,importSpecies,writeImport} from './importer';
import {allGameAssets,ensureFiles,fetchUrl,gameAssets,loadTypes,LAST_DEX,type GameTypes} from './gamedata';
import type {Pack} from './world';
import {startTranscriptWatcher,type Evidence} from './transcripts';
export async function activate(context:vscode.ExtensionContext) {
 const sessions=new Sessions(context.workspaceState.get<string[]>('excludedSessions',[])),store=sessions.store;
 const roots=()=> (vscode.workspace.workspaceFolders||[]).map(f=>f.uri.fsPath);
 const autoEnabled=()=>vscode.workspace.getConfiguration('pmdAgents').get<boolean>('autoConnect',true);
 const autoAttachEnabled=()=>vscode.workspace.getConfiguration('pmdAgents').get<boolean>('autoAttach',true);
 let lease:WorkspaceLease|undefined;
 // Workspace membership first (verified scope), then auto-attach for everything else; both pause while guild windows overlap.
 const reconcile=()=>{sessions.autoConnect(autoEnabled()?lease?.eligible||new Set():new Set());sessions.autoAttach(autoAttachEnabled()&&lease?.state==='single');};
 let panel:vscode.WebviewPanel|undefined;
 let pendingSetup:{id:string;plan:HookPlan}|undefined;
 async function beginSetup(remove=false,choice?:string){
  const provider=choice||(await vscode.window.showQuickPick([{label:'Codex',value:'codex'},{label:'Claude Code',value:'claude'}],{title:remove?'Remove PMD observer hooks':'Connect an agent provider'}))?.value;
  if(provider!=='codex'&&provider!=='claude')return;
  try{
   const plan=await prepareSetup(provider,remove),id=randomUUID();pendingSetup={id,plan};
   void panel?.webview.postMessage({type:'hookSetup',id,provider,remove,file:plan.file,preview:plan.preview,changed:plan.changed});
  }catch(error){void panel?.webview.postMessage({type:'hookResult',error:error instanceof Error?error.message:'Could not prepare setup.'});}
 }
 const terminals=new Map<vscode.Terminal,string>();
 const executions=new Map<vscode.TerminalShellExecution,{tool:string;session:string}>();
 const terminalNames=new Map<string,string>();
 let terminalSequence=0;
 const assignments={...context.workspaceState.get<Record<string,string>>('characters',{})};
 // Automatic membership is workspace scoped; simultaneous overlapping windows pause it.
 // Explicit links remain activation-local; exclusions and character choices persist.
 let sequence=0;
 let ready=false;
 const evidence=sessions.evidence;
 let watcher:ReturnType<typeof startTranscriptWatcher>|undefined;
 let publishTimer:ReturnType<typeof setTimeout>|undefined;
 const snapshot=()=>({type:'snapshot',workspaces:(vscode.workspace.workspaceFolders||[]).map(f=>f.name),autoConnect:autoEnabled(),autoAttach:autoAttachEnabled(),autoState:lease?.state,membership:Object.fromEntries(sessions.membership),scene:context.workspaceState.get<string>('scene','forest'),sequence:++sequence,agents:store.snapshot(),journal:sessions.journal.snapshot(),links:Object.fromEntries(sessions.links),diagnostics:watcher?.diagnostics,observationEnabled:!!watcher,evidence:Object.fromEntries(evidence),terminalNames:Object.fromEntries(terminalNames),assignments});
 const publish=()=>{if(!publishTimer)publishTimer=setTimeout(()=>{publishTimer=undefined;if(panel)void panel.webview.postMessage(snapshot());},80);};
 const receive=(e:Event,direct:boolean,source:Evidence={source:e.provider==='terminal'?'terminal':'hook'})=>{
  sessions.receive(e,direct,source);reconcile();
  publish();
 };
 const registry=process.env.PMD_AGENTS_REGISTRY||join(homedir(),'.pmd-agents','instances');
 const receiver=await startReceiver(registry,receive);
 lease=new WorkspaceLease(join(registry,'workspaces'),receiver.registration.id);
 await lease.refresh(roots());
 const renew=async()=>{await lease?.refresh(roots());reconcile();publish();};
 const leaseTimer=setInterval(()=>void renew(),4000);
 context.subscriptions.push({dispose(){clearInterval(leaseTimer);void lease?.dispose();}});
 context.environmentVariableCollection.replace('PMD_AGENTS_INSTANCE',receiver.registration.id);
 context.environmentVariableCollection.description='Associate provider observer events with this VS Code window.';
 context.subscriptions.push({dispose(){context.environmentVariableCollection.clear();void receiver.dispose();}});
 const observe=()=>{
  watcher?.dispose();watcher=undefined;sessions.pauseTranscripts();
  if(vscode.workspace.getConfiguration('pmdAgents').get<boolean>('observeLocalChats',true))
   watcher=startTranscriptWatcher(roots(),(event,source)=>receive(event,false,source),{onState:(id,state)=>{sessions.mark(id,state);publish();},onScan:()=>{reconcile();publish();}});
  publish();
 };
 observe();
 context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(()=>{lease?.eligible.clear();reconcile();observe();void renew();}),vscode.workspace.onDidChangeConfiguration(e=>{if(e.affectsConfiguration('pmdAgents.observeLocalChats'))observe();if(e.affectsConfiguration('pmdAgents.autoConnect')||e.affectsConfiguration('pmdAgents.autoAttach')){reconcile();publish();}}),{dispose(){watcher?.dispose();clearTimeout(publishTimer);}});
 const emit=(session:string,kind:Event['kind'],extra:Partial<Event>={})=>receive({v:1,id:randomUUID(),session,provider:'terminal',kind,at:Date.now(),...extra},true);
 function addTerminal(t:vscode.Terminal) {
  if(terminals.has(t))return terminals.get(t)!;
  const id='terminal:'+randomUUID();terminals.set(t,id);
  // Terminal titles may contain user paths; display a stable neutral label.
  terminalNames.set(id,'Terminal '+(++terminalSequence));emit(id,'session');return id;
 }
 vscode.window.terminals.forEach(addTerminal);
 context.subscriptions.push(
  vscode.window.onDidOpenTerminal(addTerminal),
  vscode.window.onDidCloseTerminal(t=>{const id=terminals.get(t);if(id){emit(id,'end');terminals.delete(t);terminalNames.delete(id);for(const [execution,value] of executions)if(value.session===id)executions.delete(execution);} }),
  vscode.window.onDidStartTerminalShellExecution(e=>{
   const id=addTerminal(e.terminal),tool=randomUUID();executions.set(e.execution,{tool,session:id});
   emit(id,'turn',{turn:tool});emit(id,'tool-start',{tool,turn:tool,activity:'running'});
  }),
  vscode.window.onDidEndTerminalShellExecution(e=>{
   const id=terminals.get(e.terminal),tool=executions.get(e.execution)?.tool;
   if(!tool||!id)return;executions.delete(e.execution);emit(id,'tool-end',{tool,turn:tool});
   if(typeof e.exitCode==='number')emit(id,e.exitCode===0?'finish':'failure',{turn:tool});
  })
 );
 async function open() {
  if(panel){panel.reveal();return;}
  const configured=vscode.workspace.getConfiguration('pmdAgents').get<string>('assetPath');
  const local=join(context.extensionPath,'assets','local');
  let directory=configured||(existsSync(join(local,'manifest.json'))?local:join(homedir(),'.pmd-agents','assets')),pack:Pack|undefined,assetError='';
  try{pack=await loadPack(directory);}catch{assetError='Choose a local PMD asset pack to bring the guild to life.';}
  // The living Pokédex: catalog, box portraits and species imports are pinned SpriteCollab fetches into the local pack, one at a time.
  let dex:Dex|undefined,types:GameTypes|undefined,importQueue=Promise.resolve(),gameImport:Promise<unknown>|undefined;
  const spriteNames=async()=>{try{return new TextDecoder().decode(await cachedFetch(directory)('spritebot_credits.txt'));}catch{return '';}};
  const importForm=async(path:string,id:string)=>{
   if(!pack)throw Error('No asset pack is loaded.');
   const existing=pack.sprites.find(s=>s.id===id);if(existing)return existing;
   dex??=await loadDex(directory,trackerFetch);
   const species=dex.species.find(s=>s.forms.some(f=>f.path===path&&f.id===id)),form=species?.forms.find(f=>f.path===path);
   if(!species||!form||!form.ready)throw Error('That form has no complete Idle, Walk, Attack and Sleep sheets yet.');
   // Move colours follow the species' primary type when the pack or PokeAPI data knows it.
   if(!types)types=await loadTypes(directory).catch(()=>undefined);
   const element=pack.sprites.find(s=>s.dex===species.dex)?.element||types?.[String(species.dex).padStart(4,'0')]?.[0];
   const result=await importSpecies({id,name:species.name,dex:species.dex,path,label:form.label,element,portraitPath:portraitPath(species,path)},cachedFetch(directory),await spriteNames());
   await writeImport(directory,result,validateSpecies);
   pack.sprites.push(result.species);return result.species;
  };
  panel=vscode.window.createWebviewPanel('pmdAgents','PMD Agents',vscode.ViewColumn.Beside,{
   enableScripts:true,retainContextWhenHidden:true,localResourceRoots:[vscode.Uri.joinPath(context.extensionUri,'media'),...(pack?[vscode.Uri.file(directory)]:[])]
  });
  const webview=panel.webview;
  const uri=(...p:string[])=>webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,...p)).toString();
  const nonce=randomUUID().replaceAll('-','');
  const assetBase=pack?webview.asWebviewUri(vscode.Uri.file(directory)).toString()+'/':'';
  const boot={pack,assetBase,assetError,mode:'live',...snapshot(),clients:['openai.chatgpt','anthropic.claude-code'].map(id=>({id,version:vscode.extensions.getExtension(id)?.packageJSON.version||'Not installed'}))};
  webview.html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
   '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src '+webview.cspSource+'; font-src '+webview.cspSource+'; style-src '+webview.cspSource+' \'nonce-'+nonce+'\'; script-src \'nonce-'+nonce+'\';">'+
   '<link rel="stylesheet" href="'+uri('media','style.css')+'"><style nonce="'+nonce+'">@font-face{font-family:Pixelify;src:url("'+assetBase+'PixelifySans.woff2")}</style></head><body><div id="app"></div>'+
   '<script nonce="'+nonce+'">window.PMD_BOOT='+JSON.stringify(boot).replaceAll('<','\\u003c')+';</script><script nonce="'+nonce+'" src="'+uri('media','app.js')+'"></script></body></html>';
  panel.onDidDispose(()=>{panel=undefined;pendingSetup=undefined;});
  panel.onDidChangeViewState(e=>{void webview.postMessage({type:'visibility',visible:e.webviewPanel.visible});if(e.webviewPanel.visible)publish();});
  webview.onDidReceiveMessage(async msg=>{
   try {
    if(!msg||typeof msg!=='object')return;
    if(msg.type==='ready'){ready=true;publish();if(pendingSetup){const {id,plan}=pendingSetup;void webview.postMessage({type:'hookSetup',id,provider:plan.provider,remove:plan.remove,file:plan.file,preview:plan.preview,changed:plan.changed});}}
    if(msg.type==='attach'&&typeof msg.id==='string'&&store.agents.has(msg.id)){
     sessions.attach(msg.id);await context.workspaceState.update('excludedSessions',sessions.exclusions());
     publish();
    }
    if(msg.type==='detach'&&typeof msg.id==='string'){sessions.detach(msg.id);await context.workspaceState.update('excludedSessions',sessions.exclusions());publish();}
    if(msg.type==='link'&&typeof msg.id==='string'&&typeof msg.terminal==='string'){sessions.link(msg.id,msg.terminal);publish();}
    if(msg.type==='scene'&&typeof msg.id==='string'&&pack?.maps.some(m=>m.id===msg.id)){await context.workspaceState.update('scene',msg.id);}
    if(msg.type==='autoConnect'&&typeof msg.enabled==='boolean'){await vscode.workspace.getConfiguration('pmdAgents').update('autoConnect',msg.enabled,vscode.ConfigurationTarget.Workspace);reconcile();publish();}
    if(msg.type==='autoAttach'&&typeof msg.enabled==='boolean'){await vscode.workspace.getConfiguration('pmdAgents').update('autoAttach',msg.enabled,vscode.ConfigurationTarget.Workspace);reconcile();publish();}
    if(msg.type==='rescan')await watcher?.rescan();
    if(msg.type==='addWorkspaceFolder')await vscode.commands.executeCommand('workbench.action.addRootFolder');
    if(msg.type==='character'&&typeof msg.id==='string'&&store.agents.has(msg.id)&&pack?.sprites.some(s=>s.id===msg.species)){
     assignments[msg.id]=msg.species;await context.workspaceState.update('characters',assignments);publish();
    }
    if(msg.type==='focus'&&typeof msg.id==='string'){
     const t=[...terminals.entries()].find(([,id])=>id===(sessions.links.get(msg.id)||msg.id))?.[0];
     if(t)t.show();else{
      const a=store.agents.get(msg.id);
      const command=a?.provider==='codex'?'chatgpt.openSidebar':a?.provider==='claude'?'claude-vscode.sidebar.open':null;
      if(command && (await vscode.commands.getCommands(true)).includes(command))await vscode.commands.executeCommand(command);
      else void vscode.window.showInformationMessage('The source session is no longer available in this window.');
     }
    }
    if(msg.type==='dex'){
     if(!pack)void webview.postMessage({type:'dex',error:'Choose an asset pack first.'});
     else try{dex??=await loadDex(directory,trackerFetch);void webview.postMessage({type:'dex',dex});}
     catch(error){void webview.postMessage({type:'dex',error:'The Pokédex catalog could not be fetched from PMD SpriteCollab: '+(error instanceof Error?error.message:'unknown error')});}
    }
    if(msg.type==='dexPortraits'&&pack&&Array.isArray(msg.paths)){
     const paths=msg.paths.filter((p:unknown)=>typeof p==='string'&&/^[0-9]{4}(\/[0-9]{4}){0,4}$/.test(p)).slice(0,40);
     try{const result=await ensurePortraits(directory,paths,cachedFetch(directory),portraitFile);void webview.postMessage({type:'dexPortraits',...result});}
     catch(error){void webview.postMessage({type:'dexPortraits',failed:paths,error:error instanceof Error?error.message:'Portrait cache could not be saved.'});}
    }
    if(msg.type==='gameTypes'&&pack){
     try{types??=await loadTypes(directory);void webview.postMessage({type:'gameTypes',types});}
     catch(error){void webview.postMessage({type:'gameTypes',error:'Type data could not be fetched from PokeAPI: '+(error instanceof Error?error.message:'unknown error')});}
    }
    if(msg.type==='gameAssets'&&pack&&Array.isArray(msg.dexes)){
     const dexes=msg.dexes.filter((n:unknown)=>Number.isInteger(n)&&(n as number)>=1&&(n as number)<=LAST_DEX).slice(0,40) as number[];
     const items=dexes.flatMap(gameAssets);
     try{const result=await ensureFiles(directory,items,fetchUrl,'game/receipts.json');void webview.postMessage({type:'gameAssets',...result});}
     catch(error){void webview.postMessage({type:'gameAssets',failed:items.map(i=>i.key),error:error instanceof Error?error.message:'Game sprite cache could not be saved.'});}
    }
    if(msg.type==='gameImportAll'&&pack&&!gameImport){
     const items=allGameAssets(),total=items.length;let last=0;
     gameImport=ensureFiles(directory,items,fetchUrl,'game/receipts.json',8,done=>{if(done-last>=50){last=done;void webview.postMessage({type:'gameImport',done,total});}})
      .then(result=>{void webview.postMessage({type:'gameImport',done:total,total,failed:result.failed.length,complete:true});},error=>{void webview.postMessage({type:'gameImport',done:0,total,failed:total,complete:true,error:error instanceof Error?error.message:'Game sprite cache could not be saved.'});})
      .finally(()=>{gameImport=undefined;});
    }
    if(msg.type==='dexImport'&&typeof msg.path==='string'&&typeof msg.id==='string'&&/^[a-z0-9-]{1,48}$/.test(msg.id)){
     const {path,id}=msg;
     importQueue=importQueue.then(async()=>{
      try{const species=await importForm(path,id);void webview.postMessage({type:'dexImport',path,id,species});}
      catch(error){void webview.postMessage({type:'dexImport',path,id,error:error instanceof Error?error.message:'Import failed.'});}
     });
    }
    if(msg.type==='setup')await beginSetup(false,msg.provider);
    if(msg.type==='installHooks'&&typeof msg.id==='string'&&pendingSetup?.id===msg.id){
     const {id,plan}=pendingSetup!;pendingSetup=undefined;
     try{const result=await installSetup(plan,context.extensionPath);void panel?.webview.postMessage({type:'hookResult',id,provider:plan.provider,remove:plan.remove,...result});}
     catch(error){void panel?.webview.postMessage({type:'hookResult',id,error:error instanceof Error?error.message:'Hook setup failed.'});}
    }
    if(msg.type==='cancelHooks')pendingSetup=undefined;
    if(msg.type==='assets'){
     const pick=await vscode.window.showOpenDialog({canSelectFolders:true,canSelectFiles:false,canSelectMany:false,title:'Select PMD pack folder containing manifest.json'});
     if(pick?.[0]){await loadPack(pick[0].fsPath);await vscode.workspace.getConfiguration('pmdAgents').update('assetPath',pick[0].fsPath,vscode.ConfigurationTarget.Global);panel?.dispose();await open();}
    }
   }catch(error){void vscode.window.showErrorMessage('PMD Agents: '+(error instanceof Error?error.message:'Action failed'));}
  });
 }
 context.subscriptions.push(vscode.commands.registerCommand('pmdAgents.open',open),
  vscode.commands.registerCommand('pmdAgents.setup',async()=>{await open();await beginSetup();}),
  vscode.commands.registerCommand('pmdAgents.removeHooks',async()=>{await open();await beginSetup(true);}));
 return {snapshot:()=>store.snapshot(),...(context.extensionMode===vscode.ExtensionMode.Test?{registration:receiver.registration,ready:()=>ready,sessions}: {})};
}
