import * as vscode from 'vscode';
import {randomUUID} from 'node:crypto';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {type Event} from './core';
import {Sessions} from './sessions';
import {startReceiver} from './receiver';
import {setup} from './setup';
import {loadPack} from './assets';
import type {Pack} from './world';
import {startTranscriptWatcher,type Evidence} from './transcripts';
export async function activate(context:vscode.ExtensionContext) {
 const sessions=new Sessions(),store=sessions.store;
 let panel:vscode.WebviewPanel|undefined;
 const terminals=new Map<vscode.Terminal,string>();
 const executions=new Map<vscode.TerminalShellExecution,{tool:string;session:string}>();
 const terminalNames=new Map<string,string>();
 let terminalSequence=0;
 const assignments={...context.workspaceState.get<Record<string,string>>('characters',{})};
 // VS Code workspaceState can be shared by windows on the same folder. Explicit
 // attachment is activation-local until a durable window identity is available.
 let sequence=0;
 let ready=false;
 const evidence=sessions.evidence;
 let publishTimer:ReturnType<typeof setTimeout>|undefined;
 const snapshot=()=>({type:'snapshot',sequence:++sequence,agents:store.snapshot(),links:Object.fromEntries(sessions.links),diagnostics:watcher?.diagnostics,observationEnabled:!!watcher,evidence:Object.fromEntries(evidence),terminalNames:Object.fromEntries(terminalNames),assignments});
 const publish=()=>{if(!publishTimer)publishTimer=setTimeout(()=>{publishTimer=undefined;if(panel)void panel.webview.postMessage(snapshot());},80);};
 const receive=(e:Event,direct:boolean,source:Evidence={source:e.provider==='terminal'?'terminal':'hook'})=>{
  sessions.receive(e,direct,source);
  publish();
 };
 const registry=process.env.PMD_AGENTS_REGISTRY||join(homedir(),'.pmd-agents','instances');
 const receiver=await startReceiver(registry,receive);
 context.environmentVariableCollection.replace('PMD_AGENTS_INSTANCE',receiver.registration.id);
 context.environmentVariableCollection.description='Associate provider observer events with this VS Code window.';
 context.subscriptions.push({dispose(){context.environmentVariableCollection.clear();void receiver.dispose();}});
 let watcher:ReturnType<typeof startTranscriptWatcher>|undefined;
 const observe=()=>{
  watcher?.dispose();watcher=undefined;sessions.pauseTranscripts();
  if(vscode.workspace.getConfiguration('pmdAgents').get<boolean>('observeLocalChats',true))
   watcher=startTranscriptWatcher((vscode.workspace.workspaceFolders||[]).map(f=>f.uri.fsPath),(event,source)=>receive(event,false,source),{onState:(id,state)=>{sessions.mark(id,state);publish();},onScan:publish});
  publish();
 };
 observe();
 context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(observe),vscode.workspace.onDidChangeConfiguration(e=>{if(e.affectsConfiguration('pmdAgents.observeLocalChats'))observe();}),{dispose(){watcher?.dispose();clearTimeout(publishTimer);}});
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
     sessions.attach(msg.id);
     publish();
    }
    if(msg.type==='detach'&&typeof msg.id==='string'){sessions.detach(msg.id);publish();}
    if(msg.type==='link'&&typeof msg.id==='string'&&typeof msg.terminal==='string'){sessions.link(msg.id,msg.terminal);publish();}
    if(msg.type==='rescan')await watcher?.rescan();
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
 return {snapshot:()=>store.snapshot(),...(context.extensionMode===vscode.ExtensionMode.Test?{registration:receiver.registration,ready:()=>ready,sessions}: {})};
}
