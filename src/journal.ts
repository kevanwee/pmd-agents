import type {Activity,Event,Provider} from './core';
export interface JournalEntry {at:number;kind:Event['kind'];activity?:Activity;source:'hook'|'transcript'|'terminal'}

/** A bounded account of accepted observations; no free text or tool payloads. */
export class ActivityJournal {
 private entries=new Map<string,JournalEntry[]>();
 record(event:Event,source:JournalEntry['source']){
  const list=this.entries.get(event.session)||[];
  const entry:JournalEntry={at:event.at,kind:event.kind,source};
  if(event.kind==='tool-start'&&event.activity)entry.activity=event.activity;
  const last=list.at(-1);
  if(event.kind==='pulse'&&last?.kind==='pulse'&&last.source===source)last.at=Math.max(last.at,event.at);
  else {list.push(entry);if(list.length>32)list.shift();}
  this.entries.set(event.session,list);
 }
 prune(ids:Set<string>){for(const id of this.entries.keys())if(!ids.has(id))this.entries.delete(id);}
 snapshot(){return Object.fromEntries([...this.entries].map(([id,list])=>[id,list.map(e=>({...e}))]));}
}
export function journalText(entry:JournalEntry,provider:Provider){
 if(entry.kind==='tool-start')return {editing:'Editing started',reading:'Reading / searching started',running:'Command started',working:'Tool started',idle:'Tool started'}[entry.activity||'working'];
 if(entry.kind==='finish')return provider==='terminal'?'Command exited 0':'Turn finished';
 return {session:'Session observed',turn:'Turn started',pulse:'Thinking / responding',
  'tool-end':'Tool ended',approval:'Approval requested',input:'Input requested',failure:'Failure reported',interrupt:'Interrupted',end:'Session closed'}[entry.kind];
}
