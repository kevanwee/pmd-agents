import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import {join} from 'node:path';
import {rm} from 'node:fs/promises';
/** Private inherited pipes: no listening socket, shared global feed or browser-accessible control API. */
export class DesktopWidget {
 private child:ChildProcessWithoutNullStreams|undefined;
 constructor(private executable:string,private onMessage:(message:any)=>void|Promise<void>){}
 private emit(message:unknown){void Promise.resolve().then(()=>this.onMessage(message)).catch(()=>{});}
 start(config:Record<string,unknown>){
  if(this.child)return;
  const child=spawn(this.executable,[],{windowsHide:true,stdio:'pipe'});this.child=child;
  const lines=createInterface({input:child.stdout});
  lines.on('line',line=>{if(line.length>65536)return;try{this.emit(JSON.parse(line));}catch{/* Ignore malformed helper diagnostics. */}});
  child.stderr.resume();child.stdin.on('error',()=>{});
  child.once('error',()=>this.emit({type:'desktopError',error:'The desktop companion could not start. Reinstall the Windows package.'}));
  child.once('close',()=>{
   lines.close();
   // The extension creates a unique, absolute WebView2 cache path for this helper only.
   if(typeof config.profileDirectory==='string')void rm(config.profileDirectory,{recursive:true,force:true,maxRetries:8,retryDelay:500}).catch(()=>{});
   if(this.child===child){this.child=undefined;this.emit({type:'desktopStopped'});}
  });
  this.send({type:'init',...config as object});
 }
 send(message:unknown){if(this.child?.stdin.writable)this.child.stdin.write(JSON.stringify(message)+'\n');}
 dispose(){const child=this.child;this.child=undefined;if(child){child.stdin.end();const timer=setTimeout(()=>child.kill(),5000);timer.unref();child.once('exit',()=>clearTimeout(timer));}}
}
export const desktopExecutable=(extensionPath:string)=>join(extensionPath,'native','PmdWidget.exe');
