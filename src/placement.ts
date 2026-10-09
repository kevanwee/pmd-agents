/** Roster order, attention sorting and arrivals never move existing teammates. */
export class Placement {
 readonly slots=new Map<string,number>();
 sync(ids:string[]){
  const active=new Set(ids);
  for(const id of this.slots.keys())if(!active.has(id))this.slots.delete(id);
  const used=new Set(this.slots.values());
  for(const id of ids)if(!this.slots.has(id)){
   let slot=0;while(used.has(slot))slot++;
   this.slots.set(id,slot);used.add(slot);
  }
 }
 clear(){this.slots.clear();}
 pages(size=6){return [...new Set([...this.slots.values()].map(slot=>Math.floor(slot/size)))].sort((a,b)=>a-b);}
 page(id:string,size=6){return Math.floor((this.slots.get(id)||0)/size);}
 onPage(ids:string[],page:number,size=6){return ids.filter(id=>this.page(id,size)===page);}
}
