// Read-only historical compatibility probe. Outputs counts, never chat contents.
import {open,readdir,stat,mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {metadata,inWorkspace,TranscriptParser,JsonlTail} from '../src/transcripts';
const roots=process.argv.slice(2).map(p=>resolve(p));
if(!roots.length)throw Error('Pass a workspace directory.');
const results=[];
for(const root of roots){
 const dir=join(process.env.CLAUDE_CONFIG_DIR||join(homedir(),'.claude'),'projects',root.replace(/[^a-zA-Z0-9-]/g,'-'));
 let files;try{files=await readdir(dir);}catch{continue;}
 const candidates=await Promise.all(files.filter(n=>n.endsWith('.jsonl')).slice(-200).map(async n=>({path:join(dir,n),info:await stat(join(dir,n))})));
 for(const f of candidates.sort((a,b)=>b.info.mtimeMs-a.info.mtimeMs).slice(0,2)){
  const handle=await open(f.path,'r');const buffer=Buffer.alloc(262144);
  let bytesRead;try{({bytesRead}=await handle.read(buffer,0,buffer.length,0));}finally{await handle.close();}
  const meta=buffer.subarray(0,bytesRead).toString('utf8').split('\n').slice(0,40).flatMap(line=>{try{const m=metadata('claude',JSON.parse(line));return m?[m]:[];}catch{return [];}})[0];
  if(!meta||!inWorkspace(meta.cwd,roots))continue;
  const parser=new TranscriptParser(meta),counts:Record<string,number>={};
  await new JsonlTail(f.path,(r,offset)=>{for(const e of parser.parse(r,offset))counts[e.kind]=(counts[e.kind]||0)+1;},()=>{}).read(true);
  results.push({client:meta.client,version:meta.version,ageHours:Math.round((Date.now()-f.info.mtimeMs)/3600000),partial:f.info.size>1048576,counts});
 }
}
const report={mode:'historical replay, not live validation',results};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/claude-replay.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
