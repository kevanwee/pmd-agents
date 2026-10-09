import {createServer} from 'node:http';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {mkdir,writeFile,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {validEvent,type Event} from './core';
export interface Registration {id:string;port:number;token:string;pid:number;created:number}
export async function startReceiver(directory:string,onEvent:(e:Event,direct:boolean)=>void) {
 const registration:Registration={id:randomUUID(),port:0,token:randomBytes(32).toString('hex'),pid:process.pid,created:Date.now()};
 const server=createServer((req,res)=>{
  const auth=String(req.headers.authorization||'');
  const expected='Bearer '+registration.token;
  if(req.method!=='POST'||req.url!=='/event'||req.headers.origin||Buffer.byteLength(auth)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(auth),Buffer.from(expected))) {res.writeHead(403).end();return;}
  let body='';let size=0;
  req.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>8192){res.writeHead(413).end();req.destroy();return;}body+=chunk.toString('utf8');});
  req.on('end',()=>{try{
   const msg=JSON.parse(body);
   if(Object.keys(msg).some(k=>!['event','window'].includes(k))||!validEvent(msg.event)||!([null,registration.id].includes(msg.window))) {res.writeHead(400).end();return;}
   onEvent(msg.event,msg.window===registration.id);res.writeHead(204).end();
  }catch{res.writeHead(400).end();}});
 });
 server.requestTimeout=2000;server.headersTimeout=2000;
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve());});
 registration.port=(server.address() as {port:number}).port;
 await mkdir(directory,{recursive:true,mode:0o700});
 const file=join(directory,registration.id+'.json');
 const save=async()=>{await writeFile(file+'.tmp',JSON.stringify(registration),{mode:0o600});await rename(file+'.tmp',file);};
 await save();
 return {registration,async dispose(){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await unlink(file).catch(()=>{});}};
}

