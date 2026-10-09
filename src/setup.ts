import * as vscode from 'vscode';
import {readFile,writeFile,mkdir,copyFile,rename} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {hookConfig} from './hooks-config';
export async function setup(context:vscode.ExtensionContext,remove=false) {
 const provider=await vscode.window.showQuickPick(['Codex','Claude Code'],{title:remove?'Remove PMD observer hooks':'Connect a provider'});
 if(!provider)return;
 const dir=provider==='Codex'?(process.env.CODEX_HOME||join(homedir(),'.codex')):join(homedir(),'.claude');
 const file=join(dir,provider==='Codex'?'hooks.json':'settings.json');
 const destination=join(homedir(),'.pmd-agents','hook.cjs');
 // A stable path prevents extension updates from leaving stale hook commands.
 const command='node "'+destination+'" --provider '+(provider==='Codex'?'codex':'claude');
 let before='{}';try{before=await readFile(file,'utf8');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 let parsed;try{parsed=JSON.parse(before);}catch{throw Error('Settings are not valid JSON; no changes made.');}
 const after=JSON.stringify(hookConfig(parsed,command,remove,provider==='Codex'?'codex':'claude'),null,2)+'\n';
 const preview=await vscode.workspace.openTextDocument({language:'json',content:after});
 await vscode.window.showTextDocument(preview,{preview:true});
 const choice=await vscode.window.showInformationMessage(
  (remove?'Remove':'Install')+' only PMD observer entries in '+file+'. Existing hooks are preserved. The generated configuration is open for review.',
  {modal:true},remove?'Remove hooks':'Install hooks');
 if(!choice)return;
 let current='{}';try{current=await readFile(file,'utf8');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 if(current!==before)throw Error('Settings changed during review; retry to preserve those changes.');
 await mkdir(dir,{recursive:true});await mkdir(dirname(destination),{recursive:true,mode:0o700});
 if(!remove)await copyFile(join(context.extensionPath,'dist','hook.cjs'),destination);
 if(before!=='{}')await writeFile(file+'.pmd-backup-'+Date.now(),before,{mode:0o600});
 const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,after,{mode:0o600});await rename(temp,file);
 void vscode.window.showInformationMessage(provider==='Codex'&&!remove?'Observer installed. Review and trust it using Codex /hooks, then start a new turn. No trust bypass is used.':'PMD observer hooks updated. New sessions may be needed for the provider to load them.');
}

