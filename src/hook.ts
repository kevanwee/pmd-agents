import {readdir,readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {request} from 'node:http';
import {normalize} from './provider';
import type {Registration} from './receiver';
async function main() {
 const provider=process.argv[process.argv.indexOf('--provider')+1];
 if(provider!=='codex'&&provider!=='claude')return;
 let input='';let bytes=0;
 for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>1048576)return;input+=chunk;}
 const event=normalize(provider,JSON.parse(input));if(!event)return;
 const dir=process.env.PMD_AGENTS_REGISTRY||join(homedir(),'.pmd-agents','instances');
 const files=(await readdir(dir)).filter(f=>/^[a-f0-9-]+\.json$/.test(f)).slice(0,32);
 await Promise.all(files.map(async f=>{try{
  const r:Registration=JSON.parse(await readFile(join(dir,f),'utf8'));
  if(!Number.isInteger(r.port)||r.port<1||r.port>65535||!/^[a-f0-9]{64}$/.test(r.token)||typeof r.id!=='string')return;
  if(process.env.PMD_AGENTS_INSTANCE && process.env.PMD_AGENTS_INSTANCE!==r.id)return;
  const data=JSON.stringify({event,window:process.env.PMD_AGENTS_INSTANCE===r.id?r.id:null});
  await new Promise<void>(resolve=>{
   const req=request({hostname:'127.0.0.1',port:r.port,path:'/event',method:'POST',headers:{Authorization:'Bearer '+r.token,'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)},timeout:500},res=>{res.resume();res.on('end',resolve);});
   req.on('timeout',()=>req.destroy());req.on('error',()=>resolve());req.end(data);
  });
 }catch{/* Observation must never fail a tool. */}}));
}
const deadline=setTimeout(()=>process.exit(0),1500);
main().catch(()=>{}).finally(()=>{clearTimeout(deadline);process.exit(0);});
