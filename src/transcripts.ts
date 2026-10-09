import {open,readdir,stat} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve,relative,isAbsolute,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {normalize} from './provider';
import type {Event,Provider} from './core';
export interface Evidence {source:'transcript'|'hook'|'terminal';version?:string;client?:string;project?:string;partial?:boolean;connection?:'observing'|'unavailable'|'paused'}
export interface Metadata {provider:Provider;id:string;cwd:string;version:string;client:string}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex').slice(0,32);
export function metadata(provider:Provider,record:any):Metadata|undefined {
 if(!record||typeof record!=='object')return;
 if(provider==='codex'&&record.type==='session_meta'){
  const p=record.payload;
  if(typeof p?.id!=='string'||typeof p.cwd!=='string'||typeof p.cli_version!=='string')return;
  if(!/^0\.(153|159|162)\./.test(p.cli_version))return;
  return {provider,id:p.id,cwd:p.cwd,version:p.cli_version,client:p.source==='vscode'?'VS Code':p.source==='cli'?'CLI':'Other client'};
 }
 if(provider==='claude'&&typeof record.sessionId==='string'&&typeof record.cwd==='string'&&typeof record.version==='string'&&/^2\.1\.(289|292)$/.test(record.version)&&!record.isSidechain)
  return {provider,id:record.sessionId,cwd:record.cwd,version:record.version,client:record.entrypoint==='claude-vscode'?'VS Code':'CLI / other'};
}
export function inWorkspace(cwd:string,roots:string[]){
 return roots.some(root=>{const r=relative(resolve(root),resolve(cwd));return r===''||r!=='..'&&!r.startsWith('..\\')&&!r.startsWith('../')&&!isAbsolute(r);});
}
export class TranscriptParser {
 private turn:string|undefined;
 constructor(readonly meta:Metadata){}
 parse(record:any,offset:string):Event[] {
  if(!record||typeof record!=='object')return [];
  const at=Date.parse(record.timestamp);if(!Number.isFinite(at))return [];
  const results:Event[]=[];
  const emit=(hook_event_name:string,extra:Record<string,unknown>={},kind?:Event['kind'])=>{
   const e=normalize(this.meta.provider,{session_id:this.meta.id,hook_event_name,...(this.turn?{turn_id:this.turn}:{}),...extra});
   if(e){if(kind)e.kind=kind;e.id='log:'+hash(this.meta.id+':'+offset+':'+e.kind+':'+String(extra.tool_use_id||''));e.at=at;results.push(e);}
  };
  if(this.meta.provider==='codex'){
   const p=record.payload;
   if(!p||typeof p!=='object')return [];
   if(typeof p.turn_id==='string')this.turn=p.turn_id;
   if(record.type==='event_msg'){
    if(p.type==='task_started')emit('UserPromptSubmit');
    if(p.type==='task_complete')emit(p.error?'StopFailure':'Stop');
    if(p.type==='turn_aborted')emit('Interrupt');
   }
   if(record.type==='response_item'){
    if(p.type==='reasoning'||p.type==='message'&&p.role==='assistant')emit('UserPromptSubmit',{},'pulse');
    if(['function_call','custom_tool_call'].includes(p.type)&&typeof p.name==='string'&&typeof p.call_id==='string')
     emit('PreToolUse',{tool_name:p.name.split('.').pop(),tool_use_id:p.call_id});
    if(['function_call_output','custom_tool_call_output'].includes(p.type)&&typeof p.call_id==='string')
     emit('PostToolUse',{tool_use_id:p.call_id});
   }
  }else{
   if(record.sessionId!==this.meta.id||record.isSidechain)return [];
   const blocks=record.message?.content;
   if(record.type==='user'){
    const resultBlocks=Array.isArray(blocks)?blocks.filter((b:any)=>b?.type==='tool_result'):[];
    if(resultBlocks.length){for(const b of resultBlocks)if(typeof b.tool_use_id==='string')emit('PostToolUse',{tool_use_id:b.tool_use_id});}
    else if(record.message?.role==='user'&&!record.toolUseResult){this.turn=record.uuid;emit('UserPromptSubmit');}
   }
   if(record.type==='assistant'){
    emit('UserPromptSubmit',{},'pulse');
    if(Array.isArray(blocks))for(const b of blocks)if(b?.type==='tool_use'&&typeof b.name==='string'&&typeof b.id==='string')emit('PreToolUse',{tool_name:b.name,tool_use_id:b.id});
    if(['end_turn','stop_sequence'].includes(record.message?.stop_reason))emit('Stop');
   }
  }
  return results;
 }
}
export class JsonlTail {
 position=0;private buffer:Buffer=Buffer.alloc(0);private dropping=false;private identity='';private lineStart=0;
 constructor(readonly file:string,private onRecord:(record:any,offset:string)=>void,private onReset:()=>void){}
 async read(initial=false){
  const handle=await open(this.file,'r');
  try{
   const info=await handle.stat(),identity=String(info.ino)+':'+info.birthtimeMs;
   if(this.identity&&(identity!==this.identity||info.size<this.position)){this.position=0;this.lineStart=0;this.buffer=Buffer.alloc(0);this.dropping=false;this.onReset();}
   this.identity=identity;
   if(initial&&info.size>1048576){this.position=info.size-1048576;this.lineStart=this.position;this.dropping=true;}
   const length=Math.min(1048576,info.size-this.position);if(length<=0)return;
   const bytes=Buffer.alloc(length);const {bytesRead}=await handle.read(bytes,0,length,this.position);
   this.position+=bytesRead;this.buffer=Buffer.concat([this.buffer,bytes.subarray(0,bytesRead)]);
   let pos;
   while((pos=this.buffer.indexOf(10))>=0){
    const value=this.buffer.subarray(0,pos);this.buffer=this.buffer.subarray(pos+1);
    const offset=this.lineStart;this.lineStart+=pos+1;
    if(!this.dropping&&value.length<=1048576){try{this.onRecord(JSON.parse(value.toString('utf8')),identity+':'+offset);}catch{/* Ignore malformed records; never expose contents. */}}
    this.dropping=false;
   }
   if(this.buffer.length>1048576){this.buffer=Buffer.alloc(0);this.lineStart=this.position;this.dropping=true;}
  }finally{await handle.close();}
 }
}
async function head(file:string){
 const f=await open(file,'r');try{const b=Buffer.alloc(262144);const {bytesRead}=await f.read(b,0,b.length,0);return b.subarray(0,bytesRead).toString('utf8').split('\n').slice(0,-1).slice(0,40).flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});}finally{await f.close();}
}
export interface WatchOptions {
 codexHome?:string;claudeHome?:string;poll?:boolean;
 onState?:(id:string,state:Evidence['connection'])=>void;
 onScan?:()=>void;
}
export function startTranscriptWatcher(roots:string[],onEvent:(event:Event,evidence:Evidence)=>void,options:WatchOptions={}){
 const tails=new Map<string,{tail:JsonlTail;id:string;reset:boolean}>();
 const states=new Map<string,Evidence['connection']>();
 const state=(id:string,value:Evidence['connection'])=>{if(!disposed&&states.get(id)!==value){states.set(id,value);options.onState?.(id,value);}};
 let disposed=false,busy=false,lastScan=0;
 const diagnostics={files:0,unsupported:0,readErrors:0,lastScan:0};
 const codexHome=options.codexHome||process.env.CODEX_HOME||join(homedir(),'.codex');
 const claudeHome=options.claudeHome||process.env.CLAUDE_CONFIG_DIR||join(homedir(),'.claude');
 async function scan(){
  if(!roots.length)return;
  const dirs:{provider:Provider;dir:string}[]=[];
  for(let day=0;day<3;day++){
   const date=new Date(Date.now()-day*86400000);
   dirs.push({provider:'codex',dir:join(codexHome,'sessions',String(date.getUTCFullYear()),String(date.getUTCMonth()+1).padStart(2,'0'),String(date.getUTCDate()).padStart(2,'0'))});
  }
  for(const root of roots)dirs.push({provider:'claude',dir:join(claudeHome,'projects',root.replace(/[^a-zA-Z0-9-]/g,'-'))});
  const files:{provider:Provider;file:string;mtime:number;size:number}[]=[];
  for(const d of dirs)try{
   const names=(await readdir(d.dir,{withFileTypes:true})).filter(f=>f.isFile()&&f.name.endsWith('.jsonl')).slice(-200);
   for(const n of names){const file=join(d.dir,n.name);const s=await stat(file);if(Date.now()-s.mtimeMs<43200000)files.push({provider:d.provider,file,mtime:s.mtimeMs,size:s.size});}
  }catch{/* No logs for this date/project is normal. */}
  const selected=new Set<string>();diagnostics.unsupported=0;
  for(const f of files.sort((a,b)=>b.mtime-a.mtime).slice(0,64)){
   if(disposed)return;
   if(selected.size>=16)break;
   if(tails.has(f.file)){selected.add(f.file);continue;}
   try{
    const m=(await head(f.file)).map(r=>metadata(f.provider,r)).find(Boolean);
    if(!m){diagnostics.unsupported++;continue;}
    if(!inWorkspace(m.cwd,roots))continue;
    if(disposed)return;
    selected.add(f.file);
    let parser=new TranscriptParser(m);
    const evidence:Evidence={source:'transcript',version:m.version,client:m.client,project:basename(m.cwd),partial:f.size>1048576};
    const initial=normalize(m.provider,{session_id:m.id,hook_event_name:'SessionStart'})!;
    let emitted=false;
    const entry={tail:null as unknown as JsonlTail,id:initial.session,reset:false};
    const tail=new JsonlTail(f.file,(r,offset)=>{if(!disposed&&!entry.reset)for(const e of parser.parse(r,offset)){emitted=true;onEvent(e,evidence);}},()=>{entry.reset=true;});
    entry.tail=tail;tails.set(f.file,entry);await tail.read(true);
    if(!emitted&&!disposed){initial.at=f.mtime;onEvent(initial,evidence);}
    state(initial.session,'observing');
   }catch{diagnostics.readErrors++;}
  }
  for(const [file,entry] of tails)if(!selected.has(file)){state(entry.id,'unavailable');tails.delete(file);states.delete(entry.id);}
  diagnostics.files=tails.size;
  diagnostics.lastScan=Date.now();if(!disposed)options.onScan?.();
 }
 async function tick(){
  if(disposed||busy)return;busy=true;
  try{
   if(Date.now()-lastScan>10000){lastScan=Date.now();await scan();}
   for(const [file,entry] of tails){
    if(disposed)break;
    try{
     await entry.tail.read();
     if(entry.reset){state(entry.id,'unavailable');tails.delete(file);states.delete(entry.id);lastScan=0;}
     else state(entry.id,'observing');
    }catch{diagnostics.readErrors++;state(entry.id,'unavailable');}
   }
   diagnostics.files=tails.size;
  }finally{busy=false;}
 }
 const timer=options.poll===false?undefined:setInterval(()=>void tick(),1000);
 if(options.poll!==false)void tick();
 return {diagnostics,async rescan(){lastScan=0;await tick();},dispose(){disposed=true;clearInterval(timer);tails.clear();states.clear();}};
}
