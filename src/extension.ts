import {DesktopWidget,desktopExecutable} from './desktop';
import {assignSpawns,sanitizeFavorites} from './favorites';
import {ensureWidgetIcon,WIDGET_ICON} from './widgetIcon';
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
 let widget:vscode.WebviewView|undefined,desktop:DesktopWidget|undefined,desktopBoot:Record<string,unknown>|undefined;
 let ownerMinimized=false,desktopBound=false,desktopError='',disposed=false;
 const initializedViews=new Set<vscode.Webview>();
 const handlers=new Map<vscode.Webview,vscode.Disposable>();
 const mounts=new Map<vscode.Webview,symbol>();
 const views=new Map<vscode.Webview,()=>boolean>();
 const post=(message:unknown)=>{for(const webview of views.keys())void webview.postMessage(message);desktop?.send({type:'message',message});};
 const visibility=()=>{for(const [webview,isVisible] of views)void webview.postMessage({type:'visibility',visible:isVisible()&&!ownerMinimized});};
 const marker='PMD Agents widget '+randomUUID();
 const indicator=vscode.window.createStatusBarItem('pmdAgents.widget',vscode.StatusBarAlignment.Left,0);
 indicator.text='$(squirrel) PMD';indicator.name='PMD Agents';indicator.command='pmdAgents.showWidget';indicator.accessibilityInformation={label:marker};indicator.tooltip='Show PMD Agents widget';indicator.show();context.subscriptions.push(indicator);

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
 // New teammates get a Pokémon here, once: favourites first in order, then a random species no active teammate is using.
 const packIds=new Set<string>(),favoriteImports=new Set<string>();
 let importFavorites:(()=>void)|undefined;
 const favorites=()=>sanitizeFavorites(vscode.workspace.getConfiguration('pmdAgents').get('favorites',[]));
 const spawn=()=>{
  if(!packIds.size)return;
  const active=[...store.agents.values()].filter(a=>a.attached&&!a.ended).map(a=>a.id);
  if(assignSpawns(active,assignments,favorites(),[...packIds]))void context.workspaceState.update('characters',assignments);
 };
 // Automatic membership is workspace scoped; simultaneous overlapping windows pause it.
 // Explicit links remain activation-local; exclusions and character choices persist.
 let sequence=0;
 let ready=false;
 const evidence=sessions.evidence;
 let watcher:ReturnType<typeof startTranscriptWatcher>|undefined;
 let publishTimer:ReturnType<typeof setTimeout>|undefined;
 const snapshot=()=>(spawn(),{type:'snapshot',favorites:favorites(),workspaces:(vscode.workspace.workspaceFolders||[]).map(f=>f.name),autoConnect:autoEnabled(),autoAttach:autoAttachEnabled(),autoState:lease?.state,exclusions:sessions.exclusions(),membership:Object.fromEntries(sessions.membership),scene:context.workspaceState.get<string>('scene','forest'),quiet:context.workspaceState.get<boolean>('quiet',false),sequence:++sequence,agents:store.snapshot(),journal:sessions.journal.snapshot(),links:Object.fromEntries(sessions.links),diagnostics:watcher?.diagnostics,observationEnabled:!!watcher,evidence:Object.fromEntries(evidence),terminalNames:Object.fromEntries(terminalNames),assignments});
 const publish=()=>{if(!publishTimer)publishTimer=setTimeout(()=>{publishTimer=undefined;post(snapshot());},80);};
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
 context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(()=>{lease?.eligible.clear();reconcile();observe();void renew();}),vscode.workspace.onDidChangeConfiguration(e=>{if(e.affectsConfiguration('pmdAgents.observeLocalChats'))observe();if(e.affectsConfiguration('pmdAgents.autoConnect')||e.affectsConfiguration('pmdAgents.autoAttach')){reconcile();publish();}if(e.affectsConfiguration('pmdAgents.favorites')){importFavorites?.();publish();}}),{dispose(){watcher?.dispose();clearTimeout(publishTimer);}});
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
 async function mount(webview:vscode.Webview,presentation:'full'|'widget') {
  initializedViews.delete(webview);const generation=Symbol();mounts.set(webview,generation);handlers.get(webview)?.dispose();handlers.delete(webview);
  const configured=vscode.workspace.getConfiguration('pmdAgents').get<string>('assetPath');
  const local=join(context.extensionPath,'assets','local');
  let directory=configured||(existsSync(join(local,'manifest.json'))?local:join(homedir(),'.pmd-agents','assets')),pack:Pack|undefined,assetError='';
  try{pack=await loadPack(directory);}catch{assetError='Choose a local PMD asset pack to bring the guild to life.';}
  for(const s of pack?.sprites||[])packIds.add(s.id);
  if(disposed||!views.has(webview)||mounts.get(webview)!==generation)return;
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
   pack.sprites.push(result.species);packIds.add(result.species.id);return result.species;
  };
  // Favourites missing from the pack import in the background, one at a time, so they can spawn.
  importFavorites=()=>{
   if(!pack)return;
   for(const id of favorites()){
    if(packIds.has(id)||favoriteImports.has(id))continue;favoriteImports.add(id);
    importQueue=importQueue.then(async()=>{
     try{
      dex??=await loadDex(directory,trackerFetch);
      const form=dex.species.flatMap(s=>s.forms).find(f=>f.id===id);if(!form?.ready)return;
      const species=await importForm(form.path,id);post({type:'dexImport',path:form.path,id,species});publish();
     }catch{favoriteImports.delete(id);}
    });
   }
  };
  importFavorites();
  webview.options={enableScripts:true,localResourceRoots:[vscode.Uri.joinPath(context.extensionUri,'media'),...(pack?[vscode.Uri.file(directory)]:[])]};
  const uri=(...p:string[])=>webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,...p)).toString();
  const nonce=randomUUID().replaceAll('-','');
  const assetBase=pack?webview.asWebviewUri(vscode.Uri.file(directory)).toString()+'/':'';
  const boot={pack,assetBase,assetError,presentation,mode:'live',...snapshot(),clients:['openai.chatgpt','anthropic.claude-code'].map(id=>({id,version:vscode.extensions.getExtension(id)?.packageJSON.version||'Not installed'}))};
  desktopBoot={boot:{...boot,presentation:'desktop',assetBase:'https://assets.pmd.local/'},assetDirectory:pack?directory:'',mediaDirectory:join(context.extensionPath,'media')};
  startDesktop();
  webview.html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
   '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src '+webview.cspSource+'; font-src '+webview.cspSource+'; style-src '+webview.cspSource+' \'nonce-'+nonce+'\'; script-src \'nonce-'+nonce+'\';">'+
   '<link rel="stylesheet" href="'+uri('media','style.css')+'"><style nonce="'+nonce+'">@font-face{font-family:Pixelify;src:url("'+assetBase+'PixelifySans.woff2")}</style></head><body><div id="app"></div>'+
   '<script nonce="'+nonce+'">window.PMD_BOOT='+JSON.stringify(boot).replaceAll('<','\\u003c')+';</script><script nonce="'+nonce+'" src="'+uri('media','app.js')+'"></script></body></html>';
  handlers.set(webview,webview.onDidReceiveMessage(async msg=>{
   try {
    if(!msg||typeof msg!=='object')return;
    if(msg.type==='openGuild'){await open();return;}
    if(msg.type==='desktop'){await showDesktop();return;}
    if(msg.type==='quiet'&&typeof msg.quiet==='boolean'){await context.workspaceState.update('quiet',msg.quiet);publish();return;}
    if(msg.type==='ready'){initializedViews.add(webview);if(presentation==='full')ready=true;visibility();publish();if(pendingSetup){const {id,plan}=pendingSetup;void webview.postMessage({type:'hookSetup',id,provider:plan.provider,remove:plan.remove,file:plan.file,preview:plan.preview,changed:plan.changed});}}
    if(msg.type==='attach'&&typeof msg.id==='string'&&store.agents.has(msg.id)){
     sessions.attach(msg.id);await context.workspaceState.update('excludedSessions',sessions.exclusions());
     publish();
    }
    if(msg.type==='detach'&&typeof msg.id==='string'){sessions.detach(msg.id);await context.workspaceState.update('excludedSessions',sessions.exclusions());publish();}
    if(msg.type==='link'&&typeof msg.id==='string'&&typeof msg.terminal==='string'){sessions.link(msg.id,msg.terminal);publish();}
    if(msg.type==='scene'&&typeof msg.id==='string'&&pack?.maps.some(m=>m.id===msg.id)){await context.workspaceState.update('scene',msg.id);publish();}
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
      try{const species=await importForm(path,id);post({type:'dexImport',path,id,species});}
      catch(error){void webview.postMessage({type:'dexImport',path,id,error:error instanceof Error?error.message:'Import failed.'});}
     });
    }
    if(msg.type==='favorites'&&Array.isArray(msg.ids)){await vscode.workspace.getConfiguration('pmdAgents').update('favorites',sanitizeFavorites(msg.ids),vscode.ConfigurationTarget.Global);publish();}
    if(msg.type==='setup')await beginSetup(false,msg.provider);
    if(msg.type==='installHooks'&&typeof msg.id==='string'&&pendingSetup?.id===msg.id){
     const {id,plan}=pendingSetup!;pendingSetup=undefined;
     try{const result=await installSetup(plan,context.extensionPath);void panel?.webview.postMessage({type:'hookResult',id,provider:plan.provider,remove:plan.remove,...result});}
     catch(error){void panel?.webview.postMessage({type:'hookResult',id,error:error instanceof Error?error.message:'Hook setup failed.'});}
    }
    if(msg.type==='cancelHooks')pendingSetup=undefined;
    if(msg.type==='assets'){
     const pick=await vscode.window.showOpenDialog({canSelectFolders:true,canSelectFiles:false,canSelectMany:false,title:'Select PMD pack folder containing manifest.json'});
     if(pick?.[0]){await loadPack(pick[0].fsPath);await vscode.workspace.getConfiguration('pmdAgents').update('assetPath',pick[0].fsPath,vscode.ConfigurationTarget.Global);desktop?.dispose();desktop=undefined;panel?.dispose();if(widget)await mount(widget.webview,'widget');await open();}
    }
   }catch(error){void vscode.window.showErrorMessage('PMD Agents: '+(error instanceof Error?error.message:'Action failed'));}
  }));
 }
 function removeView(webview:vscode.Webview){initializedViews.delete(webview);views.delete(webview);mounts.delete(webview);handlers.get(webview)?.dispose();handlers.delete(webview);}
 async function open(){
  if(disposed)return;
  if(panel){panel.reveal();return;}
  const current=panel=vscode.window.createWebviewPanel('pmdAgents','PMD Agents',vscode.ViewColumn.Beside,{enableScripts:true,retainContextWhenHidden:true});
  views.set(current.webview,()=>current.visible);
  current.onDidDispose(()=>{removeView(current.webview);if(panel===current){panel=undefined;pendingSetup=undefined;}});
  current.onDidChangeViewState(()=>{visibility();publish();});
  await mount(current.webview,'full');
 }
 /** The size the desktop widget opens at (pmdAgents.desktopWidgetWidth/Height). */
 function widgetSize(){const c=vscode.workspace.getConfiguration('pmdAgents');return {width:c.get<number>('desktopWidgetWidth',460),height:c.get<number>('desktopWidgetHeight',440)};}
 function startDesktop(){
  if(disposed||desktop||!desktopBoot||process.platform!=='win32'||process.arch!=='x64'||vscode.env.remoteName||!vscode.workspace.getConfiguration('pmdAgents').get('desktopWidget',true))return;
  indicator.accessibilityInformation={label:marker};desktopBound=false;
  desktopError='';
  const current=desktop=new DesktopWidget(desktopExecutable(context.extensionPath),async message=>{
   if(disposed||desktop!==current)return;
   if(message.type==='desktopBound'){desktopBound=true;indicator.accessibilityInformation={label:'PMD Agents widget'};indicator.tooltip='PMD Agents: desktop widget follows this VS Code window';}
   if(message.type==='desktopBounds'&&['left','top','width','height'].every(key=>Number.isFinite(message[key])))await context.workspaceState.update('desktopBounds',{left:message.left,top:message.top,width:message.width,height:message.height});
   if(message.type==='desktopState'){ownerMinimized=message.ownerMinimized===true;visibility();}
   if(message.type==='desktopError'){desktopError=message.error;indicator.tooltip='PMD Agents: '+desktopError;}
   if(message.type==='desktopStopped'){desktop=undefined;desktopBound=false;ownerMinimized=false;visibility();}
   if(message.type==='ready'){desktop?.send({type:'message',message:snapshot()});}
   if(message.type==='openGuild')await open();
   if(message.type==='scene'&&typeof message.id==='string'){
    const pack=(desktopBoot?.boot as {pack?:Pack})?.pack;
    if(pack?.maps.some(map=>map.id===message.id)){await context.workspaceState.update('scene',message.id);publish();}
   }
   if(message.type==='quiet'&&typeof message.quiet==='boolean'){await context.workspaceState.update('quiet',message.quiet);publish();}
  });
  desktop.start({...desktopBoot,marker,applicationPath:process.execPath,bounds:context.workspaceState.get('desktopBounds'),size:widgetSize(),title:'PMD Agents - '+(vscode.workspace.name||'VS Code'),profileDirectory:join(context.globalStorageUri.fsPath,'desktop',randomUUID())});
  const iconRoot=typeof desktopBoot.assetDirectory==='string'?desktopBoot.assetDirectory:'';
  if(iconRoot)void ensureWidgetIcon(iconRoot).then(path=>{if(path&&desktop===current)current.send({type:'icon',path,frameWidth:WIDGET_ICON.frameWidth,frameHeight:WIDGET_ICON.frameHeight});}).catch(()=>{/* The generic icon stays. */});
 }
 async function showDesktop(){
  if(process.platform!=='win32'||process.arch!=='x64'||vscode.env.remoteName){void vscode.window.showInformationMessage('The desktop companion is available in local Windows x64 windows. The sidebar widget works here.');return;}
  if(!desktopBoot){await vscode.commands.executeCommand('pmdAgents.widget.focus');}
  startDesktop();if(desktop)desktop.send({type:'show'});else void vscode.window.showInformationMessage('Enable PMD Agents: Desktop Widget and open the sidebar widget first.');
 }
 const bindTimer=setInterval(()=>{if(!desktopBound)desktop?.send({type:'bind'});},2000);
 context.subscriptions.push({dispose(){clearInterval(bindTimer);}});
 context.subscriptions.push(vscode.window.registerWebviewViewProvider('pmdAgents.widget',{
  async resolveWebviewView(view){widget=view;views.set(view.webview,()=>view.visible);view.onDidDispose(()=>{removeView(view.webview);if(widget===view)widget=undefined;});view.onDidChangeVisibility(()=>{visibility();publish();});await mount(view.webview,'widget');}
 },{webviewOptions:{retainContextWhenHidden:true}}),
 vscode.commands.registerCommand('pmdAgents.showWidget',()=>vscode.commands.executeCommand('pmdAgents.widget.focus')),
 vscode.commands.registerCommand('pmdAgents.desktop',showDesktop),
 vscode.window.onDidChangeWindowState(state=>{if(state.focused&&!desktopBound)desktop?.send({type:'bind'});}),
 vscode.workspace.onDidChangeConfiguration(event=>{if(event.affectsConfiguration('pmdAgents.desktopWidgetWidth')||event.affectsConfiguration('pmdAgents.desktopWidgetHeight')){desktop?.send({type:'size',...widgetSize()});return;}if(event.affectsConfiguration('pmdAgents.desktopWidget')){if(vscode.workspace.getConfiguration('pmdAgents').get('desktopWidget',true))startDesktop();else{desktop?.dispose();desktop=undefined;ownerMinimized=false;visibility();}}}),
 {dispose(){disposed=true;desktop?.dispose();for(const handler of handlers.values())handler.dispose();handlers.clear();views.clear();}}
 );
 context.subscriptions.push(vscode.commands.registerCommand('pmdAgents.open',open),
  vscode.commands.registerCommand('pmdAgents.setup',async()=>{await open();await beginSetup();}),
  vscode.commands.registerCommand('pmdAgents.removeHooks',async()=>{await open();await beginSetup(true);}));
 // Start even if Explorer is closed; each extension host owns its own helper.
 if(process.platform==='win32'&&!vscode.env.remoteName){
  const local=join(context.extensionPath,'assets','local');
  const directory=vscode.workspace.getConfiguration('pmdAgents').get<string>('assetPath')||(existsSync(join(local,'manifest.json'))?local:join(homedir(),'.pmd-agents','assets'));
  void loadPack(directory).then(pack=>{
   desktopBoot??={boot:{...snapshot(),pack,assetBase:'https://assets.pmd.local/',mode:'live',presentation:'desktop'},assetDirectory:directory,mediaDirectory:join(context.extensionPath,'media')};startDesktop();
  }).catch(()=>{});
 }
 // Contribution visibility alone does not reveal Explorer in a fresh window.
 // Do not await the reveal during activation: resolving the view can wait on us.
 if(vscode.workspace.getConfiguration('pmdAgents').get<boolean>('autoShowWidget',true))
  void vscode.commands.executeCommand('pmdAgents.widget.focus',{preserveFocus:true}).then(undefined,()=>{
   if(!disposed)indicator.tooltip='PMD Agents: use Show Sidebar Widget to open the guild.';
  });
 return {snapshot:()=>store.snapshot(),...(context.extensionMode===vscode.ExtensionMode.Test?{registration:receiver.registration,ready:()=>ready,widgetReady:()=>!!widget&&initializedViews.has(widget.webview),desktopState:()=>({bound:desktopBound,error:desktopError,minimized:ownerMinimized}),sessions,assignments:()=>({...assignments})}: {})};
}
