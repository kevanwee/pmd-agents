import * as vscode from 'vscode';
import {randomUUID} from 'node:crypto';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {GuildStore,type Event} from './core';
import {startReceiver} from './receiver';
import {setup} from './setup';
import {loadPack} from './assets';
import type {Pack} from './world';
import {startTranscriptWatcher,type Evidence} from './transcripts';
export async function activate(context:vscode.ExtensionContext) {
 const store=new GuildStore();
 let panel:vscode.WebviewPanel|undefined;
 const terminals=new Map<vscode.Terminal,string>();
 const executions=new Map<vscode.TerminalShellExecution,string>();
 const terminalNames=new Map<string,string>();
 const assignments={...context.workspaceState.get<Record<string,string>>('characters',{})};
 // VS Code workspaceState can be shared by windows on the same folder. Explicit
 // attachment is activation-local until a durable window identity is available.
 const attachments=new Set<string>();
 let sequence=0;
 let ready=false;
 const evidence=new Map<string,Evidence>(),hookSessions=new Set<string>();
 let publishTimer:ReturnType<typeof setTimeout>|undefined;
 const snapshot=()=>({type:'snapshot',sequence:++sequence,agents:store.snapshot(),evidence:Object.fromEntries(evidence),terminalNames:Object.fromEntries(terminalNames),assignments});
 const publish=()=>{if(!publishTimer)publishTimer=setTimeout(()=>{publishTimer=undefined;if(panel)void panel.webview.postMessage(snapshot());},80);};
 const receive=(e:Event,direct:boolean,source:Evidence={source:e.provider==='terminal'?'terminal':'hook'})=>{
  if(source.source==='transcript'&&hookSessions.has(e.session))return;
  if(source.source==='hook'&&e.kind!=='session')hookSessions.add(e.session);
  if(source.source!=='hook'||e.kind!=='session'||!evidence.has(e.session))evidence.set(e.session,source);
  store.apply(e,direct||attachments.has(e.session)||!!e.parent&&attachments.has(e.parent));
  for(const id of evidence.keys())if(!store.agents.has(id)){evidence.delete(id);hookSessions.delete(id);}
  publish();
 };
 const registry=process.env.PMD_AGENTS_REGISTRY||join(homedir(),'.pmd-agents','instances');
 const receiver=await startReceiver(registry,receive);
 context.environmentVariableCollection.replace('PMD_AGENTS_INSTANCE',receiver.registration.id);
 context.environmentVariableCollection.description='Associate provider observer events with this VS Code window.';
 context.subscriptions.push({dispose(){context.environmentVariableCollection.clear();void receiver.dispose();}});
 let watcher:ReturnType<typeof startTranscriptWatcher>|undefined;
 const observe=()=>{
  watcher?.dispose();watcher=undefined;
  if(vscode.workspace.getConfiguration('pmdAgents').get<boolean>('observeLocalChats',true))
   watcher=startTranscriptWatcher((vscode.workspace.workspaceFolders||[]).map(f=>f.uri.fsPath),(event,source)=>receive(event,false,source));
 };
 observe();
 context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(observe),vscode.workspace.onDidChangeConfiguration(e=>{if(e.affectsConfiguration('pmdAgents.observeLocalChats'))observe();}),{dispose(){watcher?.dispose();clearTimeout(publishTimer);}});
 const emit=(session:string,kind:Event['kind'],extra:Partial<Event>={})=>receive({v:1,id:randomUUID(),session,provider:'terminal',kind,at:Date.now(),...extra},true);
 function addTerminal(t:vscode.Terminal) {
  if(terminals.has(t))return terminals.get(t)!;
  const id='terminal:'+randomUUID();terminals.set(t,id);
  // Terminal titles may contain user paths; display a stable neutral label.
  terminalNames.set(id,'Terminal '+terminals.size);emit(id,'session');return id;
 }
 vscode.window.terminals.forEach(addTerminal);
 context.subscriptions.push(
  vscode.window.onDidOpenTerminal(addTerminal),
  vscode.window.onDidCloseTerminal(t=>{const id=terminals.get(t);if(id){emit(id,'end');terminals.delete(t);terminalNames.delete(id);} }),
  vscode.window.onDidStartTerminalShellExecution(e=>{
   const id=addTerminal(e.terminal),tool=randomUUID();executions.set(e.execution,tool);
   emit(id,'turn',{turn:tool});emit(id,'tool-start',{tool,turn:tool,activity:'running'});
  }),
  vscode.window.onDidEndTerminalShellExecution(e=>{
   const id=addTerminal(e.terminal),tool=executions.get(e.execution);
   if(!tool)return;executions.delete(e.execution);emit(id,'tool-end',{tool,turn:tool});
   if(typeof e.exitCode==='number')emit(id,e.exitCode===0?'finish':'failure',{turn:tool});
  })
 );
 async function open() {
  if(panel){panel.reveal();return;}
  const configured=vscode.workspace.getConfiguration('pmdAgents').get<string>('assetPath');
  const local=join(context.extensionPath,'assets','local');
  let directory=configured||(existsSync(join(local,'manifest.json'))?local:join(homedir(),'.pmd-agents','assets')),pack:Pack|undefined,assetError='';
  try{pack=await loadPack(directory);}catch{assetError='Choose a local PMD asset pack to bring the guild to life.';}
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
  panel.onDidDispose(()=>{panel=undefined;});
  panel.onDidChangeViewState(e=>{void webview.postMessage({type:'visibility',visible:e.webviewPanel.visible});if(e.webviewPanel.visible)publish();});
  webview.onDidReceiveMessage(async msg=>{
   try {
    if(!msg||typeof msg!=='object')return;
    if(msg.type==='ready'){ready=true;publish();}
    if(msg.type==='attach'&&typeof msg.id==='string'&&store.agents.has(msg.id)){
     attachments.add(msg.id);store.attach(msg.id);
     for(const a of store.agents.values())if(a.parent===msg.id){attachments.add(a.id);store.attach(a.id);}
     publish();
    }
    if(msg.type==='character'&&typeof msg.id==='string'&&store.agents.has(msg.id)&&pack?.sprites.some(s=>s.id===msg.species)){
     assignments[msg.id]=msg.species;await context.workspaceState.update('characters',assignments);publish();
    }
    if(msg.type==='focus'&&typeof msg.id==='string'){
     const t=[...terminals.entries()].find(([,id])=>id===msg.id)?.[0];
     if(t)t.show();else{
      const a=store.agents.get(msg.id);
      const command=a?.provider==='codex'?'chatgpt.openSidebar':a?.provider==='claude'?'claude-vscode.sidebar.open':null;
      if(command && (await vscode.commands.getCommands(true)).includes(command))await vscode.commands.executeCommand(command);
      else void vscode.window.showInformationMessage('The source session is no longer available in this window.');
     }
    }
    if(msg.type==='setup')await setup(context);
    if(msg.type==='assets'){
     const pick=await vscode.window.showOpenDialog({canSelectFolders:true,canSelectFiles:false,canSelectMany:false,title:'Select PMD pack folder containing manifest.json'});
     if(pick?.[0]){await loadPack(pick[0].fsPath);await vscode.workspace.getConfiguration('pmdAgents').update('assetPath',pick[0].fsPath,vscode.ConfigurationTarget.Global);panel?.dispose();await open();}
    }
   }catch(error){void vscode.window.showErrorMessage('PMD Agents: '+(error instanceof Error?error.message:'Action failed'));}
  });
 }
 context.subscriptions.push(vscode.commands.registerCommand('pmdAgents.open',open),
  vscode.commands.registerCommand('pmdAgents.setup',()=>setup(context)),
  vscode.commands.registerCommand('pmdAgents.removeHooks',()=>setup(context,true)));
 return {snapshot:()=>store.snapshot(),...(context.extensionMode===vscode.ExtensionMode.Test?{registration:receiver.registration,ready:()=>ready}: {})};
}
