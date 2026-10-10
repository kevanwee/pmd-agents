import {randomUUID} from 'node:crypto';
import {mkdir,open,readFile,rename,unlink,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

/** Unique temporary names also work when separate extension hosts share a pack. */
export async function atomicWrite(path:string,data:string|Uint8Array){
 await mkdir(dirname(path),{recursive:true});
 const temporary=path+'.'+randomUUID()+'.tmp';
 try{await writeFile(temporary,data,{flag:'wx'});await rename(temporary,path);}
 finally{await unlink(temporary).catch(()=>{});}
}
/** Serialize read/modify/write across processes. Never steal a live or unknown owner's lock.
 * A crashed process may leave a lock; report its exact location for deliberate recovery. */
export async function locked<T>(path:string,operation:()=>Promise<T>,timeout=10000):Promise<T>{
 await mkdir(dirname(path),{recursive:true});
 const lock=path+'.lock',deadline=Date.now()+timeout;
 let handle;
 for(;;){
  try{handle=await open(lock,'wx');break;}
  catch(error){
   if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
   if(Date.now()>=deadline)throw Error('Asset update is locked: '+lock+'. Close other importers; if a previous importer crashed, remove this lock and retry.');
   await delay(25);
  }
 }
 try{await handle.writeFile(JSON.stringify({pid:process.pid,at:Date.now()}));return await operation();}
 finally{await handle.close();await unlink(lock);}
}
export function mergeFiles<T extends {file:string}>(old:T[],added:T[]):T[]{
 return [...new Map([...old,...added].map(item=>[item.file,item])).values()];
}
export async function mergeReceipts<T extends {file:string}>(path:string,added:T[]){
 if(!added.length)return;
 await locked(path,async()=>{
  let previous:T[]=[];
  try{previous=JSON.parse(await readFile(path,'utf8'));if(!Array.isArray(previous))throw Error('Invalid receipt list');}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  await atomicWrite(path,JSON.stringify(mergeFiles(previous,added))+'\n');
 });
}
