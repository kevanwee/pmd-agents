import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,appendFile,rm,utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {TranscriptParser,JsonlTail,metadata,inWorkspace,startTranscriptWatcher} from '../src/transcripts';
import {GuildStore} from '../src/core';
import {CodexDirectoryScan} from '../src/discovery';
const meta={provider:'codex' as const,id:'private-session',cwd:process.cwd(),version:'0.162.0-alpha.2',client:'VS Code'};
test('resumed old Codex logs are discovered in bounded batches and remain watched',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pmd-history-')),events:any[]=[];
 const watcher=startTranscriptWatcher([root],e=>events.push(e),{codexHome:root,claudeHome:join(root,'claude'),poll:false,historyBatch:1});
 try{
  const make=async(day:string,id:string,old=false)=>{const dir=join(root,'sessions','2020','01',day);await mkdir(dir,{recursive:true});const file=join(dir,'session.jsonl');await writeFile(file,[{type:'session_meta',payload:{id,cwd:root,cli_version:meta.version,source:'vscode'}},{timestamp:new Date().toISOString(),type:'event_msg',payload:{type:'task_started',turn_id:id}}].map(r=>JSON.stringify(r)).join('\n')+'\n');if(old)await utimes(file,new Date(0),new Date(0));return file;};
  const file=await make('03','resumed');await make('02','stale',true);await make('01','other');
  const scan=new CodexDirectoryScan();const batch=await scan.next(root,Date.now(),1);assert.equal(batch.length,4);assert.equal(scan.diagnostics.historyFolders,3);
  await watcher.rescan();assert.equal(events.length,1);assert.equal(watcher.diagnostics.files,1);
  await appendFile(file,JSON.stringify({timestamp:new Date().toISOString(),type:'event_msg',payload:{type:'task_complete',turn_id:'resumed'}})+'\n');
  await watcher.rescan();assert.equal(events.at(-1).kind,'finish');assert.equal(watcher.diagnostics.files,1);
  await watcher.rescan();assert.equal(watcher.diagnostics.files,2);assert.equal(events.length,3);
 }finally{watcher.dispose();await rm(root,{recursive:true,force:true});}
});
test('Codex transcript reconstructs turns without retaining raw content',()=>{
 const parser=new TranscriptParser(meta),store=new GuildStore();let i=0;
 const records=[
  {type:'event_msg',payload:{type:'task_started',turn_id:'one'}},
  {type:'response_item',payload:{type:'function_call',name:'functions.apply_patch',call_id:'call',arguments:'private contents'}},
  {type:'response_item',payload:{type:'function_call_output',call_id:'call',output:'private contents'}},
  {type:'event_msg',payload:{type:'task_complete',turn_id:'one'}},
  {type:'event_msg',payload:{type:'task_started',turn_id:'two'}}
 ];
 for(const r of records)for(const e of parser.parse({...r,timestamp:new Date(Date.now()+i++).toISOString()},String(i))){assert.ok(!JSON.stringify(e).includes('private'));store.apply(e);}
 assert.equal(store.snapshot()[0].activity,'working');assert.equal(store.snapshot()[0].outcome,'');assert.equal(store.snapshot()[0].attached,false);
});
test('Claude transcript preserves parallel tools and only ends on a turn boundary',()=>{
 const parser=new TranscriptParser({...meta,provider:'claude',version:'2.1.292'}),store=new GuildStore();let i=0;
 const parse=(type:string,message:unknown)=>{for(const e of parser.parse({type,message,sessionId:meta.id,uuid:'turn',timestamp:new Date().toISOString()},String(++i)))store.apply(e);};
 parse('user',{role:'user',content:'secret prompt'});
 parse('assistant',{content:[{type:'tool_use',id:'a',name:'Read'},{type:'tool_use',id:'b',name:'Edit'}],stop_reason:'tool_use'});
 parse('user',{role:'user',content:[{type:'tool_result',tool_use_id:'a',content:'secret result'}]});
 assert.equal(store.snapshot()[0].activity,'editing');
 parse('assistant',{content:[{type:'text',text:'secret answer'}],stop_reason:'end_turn'});
 assert.equal(store.snapshot()[0].outcome,'finished');
});
test('discovery is workspace scoped and version gated',()=>{
 assert.ok(metadata('codex',{type:'session_meta',payload:{id:'x',cwd:meta.cwd,cli_version:meta.version}}));
 assert.equal(metadata('codex',{type:'session_meta',payload:{id:'x',cwd:meta.cwd,cli_version:'9.0'}}),undefined);
 assert.equal(metadata('claude',{sessionId:'x',cwd:meta.cwd,version:'2.1.999'}),undefined);
 assert.equal(inWorkspace(join(meta.cwd,'src'),[meta.cwd]),true);
 assert.equal(inWorkspace(meta.cwd+'-other',[meta.cwd]),false);
});
test('JSONL reader handles split UTF8, stable byte offsets, malformed lines and truncation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pmd-tail-')),file=join(dir,'log.jsonl');
 try{
  const text=Buffer.from(JSON.stringify({word:'Pokémon'})+'\n'),split=text.indexOf(Buffer.from('é'))+1;
  await writeFile(file,text.subarray(0,split));
  const events:{record:any;offset:string}[]=[];let resets=0;
  const tail=new JsonlTail(file,(record,offset)=>events.push({record,offset}),()=>resets++);
  await tail.read(true);assert.equal(events.length,0);
  await appendFile(file,text.subarray(split));await tail.read();assert.equal(events[0].record.word,'Pokémon');
  const offsets:string[]=[];await new JsonlTail(file,(_,offset)=>offsets.push(offset),()=>{}).read(true);assert.equal(offsets[0],events[0].offset);
  await appendFile(file,'broken\n{"ok":true}\n');await tail.read();assert.equal(events.length,2);
  await writeFile(file,'{"reset":1}\n');await tail.read();assert.equal(resets,1);assert.equal(events[2].record.reset,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('watcher reports loss, revalidates replaced files and recovers without cross-workspace binding',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pmd-discovery-'));
 const codexHome=join(dir,'codex'),claudeHome=join(dir,'claude'),date=new Date();
 const logs=join(codexHome,'sessions',String(date.getUTCFullYear()),String(date.getUTCMonth()+1).padStart(2,'0'),String(date.getUTCDate()).padStart(2,'0'));
 const records=(id:string,cwd:string)=>[
  {type:'session_meta',payload:{id,cwd,cli_version:meta.version,source:'vscode'}},
  {timestamp:new Date().toISOString(),type:'event_msg',payload:{type:'task_started',turn_id:id}},
 ];
 const events:any[]=[],states:string[]=[];
 const watcher=startTranscriptWatcher([dir],e=>events.push(e),{codexHome,claudeHome,poll:false,onState:(_,state)=>states.push(state!)});
 try{
  await mkdir(logs,{recursive:true});const file=join(logs,'session.jsonl');
  await writeFile(file,records('original-session',dir).map(r=>JSON.stringify(r)).join('\n')+'\n');
  await watcher.rescan();assert.equal(events.length,1);assert.equal(watcher.diagnostics.files,1);
  await rm(file);await watcher.rescan();assert.equal(states.at(-1),'unavailable');assert.equal(watcher.diagnostics.files,0);
  await writeFile(file,records('other-session',dir+'-other').map(r=>JSON.stringify(r)).join('\n')+'\n');
  await watcher.rescan();assert.equal(events.length,1);assert.equal(watcher.diagnostics.files,0);
  await writeFile(file,records('new-session',dir).map(r=>JSON.stringify(r)).join('\n')+'\n');
  await watcher.rescan();assert.equal(events.length,2);assert.notEqual(events[0].session,events[1].session);assert.equal(states.at(-1),'observing');
 }finally{watcher.dispose();await rm(dir,{recursive:true,force:true});}
});
