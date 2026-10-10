import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {realpathSync} from 'node:fs';
function canonical(path:string){let p=resolve(path);try{p=realpathSync.native(p);}catch{}return process.platform==='win32'?p.toLowerCase():p;}
export function workspaceKey(path:string){return createHash('sha256').update(canonical(path)).digest('hex');}
function scope(path:string){const parents:string[]=[];for(let p=canonical(path);;p=dirname(p)){parents.push(workspaceKey(p));if(dirname(p)===p)break;}return {key:parents[0],parents};}
interface Lease {id:string;pid:number;at:number;scopes:ReturnType<typeof scope>[]}
/** Workspace auto mode is a disclosed scope, not proof of a native chat's window.
 * Overlapping guild windows suspend automatic membership until disambiguated.
 */
export class WorkspaceLease {
 private record:Lease;
 private file:string;
 private closed=false;
 private chain:Promise<void>=Promise.resolve();
 readonly eligible=new Set<string>();
 state:'single'|'ambiguous'|'unavailable'='unavailable';
 constructor(private directory:string,readonly id:string=randomUUID()){
  this.record={id,pid:process.pid,at:0,scopes:[]};this.file=join(directory,id+'.json');
 }
 refresh(roots:string[]){
  const operation=this.chain.then(async()=>{
   if(this.closed)return;
   this.eligible.clear();this.state='unavailable';
   try{
    await mkdir(this.directory,{recursive:true,mode:0o700});
    this.record={...this.record,at:Date.now(),scopes:roots.map(scope)};
    await writeFile(this.file+'.tmp',JSON.stringify(this.record),{mode:0o600});await rename(this.file+'.tmp',this.file);
    const names=(await readdir(this.directory)).filter(n=>/^[a-f0-9-]+\.json$/.test(n));if(names.length>256)return;
    const peers:Lease[]=[];
    for(const name of names){
     let text:string;try{text=await readFile(join(this.directory,name),'utf8');}catch{continue;}
     if(text.length>65536)return;
     let p:Lease;try{p=JSON.parse(text);}catch{return;}
     if(!p||!Number.isFinite(p.at)||!Number.isInteger(p.pid)||!Array.isArray(p.scopes)||!p.scopes.every(s=>typeof s.key==='string'&&Array.isArray(s.parents)&&s.parents.every(k=>typeof k==='string')))return;
     if(p.id===this.id||Date.now()-p.at>30000)continue;
     try{process.kill(p.pid,0);}catch(e){if((e as NodeJS.ErrnoException).code==='ESRCH')continue;}
     peers.push(p);
    }
    for(const current of this.record.scopes)if(!peers.some(peer=>peer.scopes.some(other=>current.parents.includes(other.key)||other.parents.includes(current.key))))this.eligible.add(current.key);
    this.state=this.eligible.size===roots.length?'single':'ambiguous';
   }catch{this.eligible.clear();this.state='unavailable';}
  });this.chain=operation.catch(()=>{});return operation;
 }
 async dispose(){this.closed=true;await this.chain;await unlink(this.file).catch(()=>{});}
}
