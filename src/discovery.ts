import {readdir} from 'node:fs/promises';
import {join} from 'node:path';

async function directories(path:string,pattern:RegExp,limit:number){
 try{return (await readdir(path,{withFileTypes:true})).filter(e=>e.isDirectory()&&pattern.test(e.name)).map(e=>e.name).sort().reverse().slice(0,limit);}catch{return [];}
}

/** Always scan recent folders; rotate bounded batches of older creation dates.
 * A resumed thread can append to an old file, so creation date is not activity.
 */
export class CodexDirectoryScan {
 private older:string[]=[];
 private refreshed=-Infinity;
 private cursor=0;
 private cycles=0;
 readonly diagnostics={historyFolders:0,historyChecked:0,historyPasses:0,historyCapped:false};
 async next(home:string,now=Date.now(),batch=16){
  const hot:string[]=[];
  for(let day=0;day<3;day++){
   const date=new Date(now-day*86400000);
   hot.push(join(home,'sessions',String(date.getUTCFullYear()),String(date.getUTCMonth()+1).padStart(2,'0'),String(date.getUTCDate()).padStart(2,'0')));
  }
  if(now-this.refreshed>60000){
   const found:string[]=[];
   const root=join(home,'sessions');
   for(const year of await directories(root,/^\d{4}$/,8)){
    for(const month of await directories(join(root,year),/^(0[1-9]|1[0-2])$/,12)){
     for(const day of await directories(join(root,year,month),/^(0[1-9]|[12]\d|3[01])$/,31)){
      const dir=join(root,year,month,day);if(!hot.includes(dir))found.push(dir);
     }
    }
   }
   const next=found.slice(0,366);
   // Preserve progress when refreshing the directory list.
   const pending=this.older[this.cursor];
   this.older=next;this.cursor=pending&&next.includes(pending)?next.indexOf(pending):0;
   this.refreshed=now;this.diagnostics.historyFolders=next.length;this.diagnostics.historyCapped=found.length>366;
  }
  if(this.cursor>=this.older.length&&this.older.length){this.cursor=0;this.cycles++;}
  const cold=this.older.slice(this.cursor,this.cursor+Math.max(1,Math.min(32,batch)));
  this.cursor+=cold.length;
  this.diagnostics.historyChecked=this.cursor;this.diagnostics.historyPasses=this.cycles;
  return [...hot,...cold];
 }
}
