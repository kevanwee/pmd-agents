import {GuildStore,type Event} from './core';
import type {Evidence} from './transcripts';
import {ActivityJournal} from './journal';

/** Window-local membership and source arbitration. Never infer ownership from cwd. */
export class Sessions {
 readonly store=new GuildStore();
 readonly evidence=new Map<string,Evidence>();
 readonly links=new Map<string,string>();
 readonly journal=new ActivityJournal();
 private excluded=new Set<string>();
 private hookAt=new Map<string,number>();

 receive(event:Event,direct:boolean,source:Evidence,now=Date.now()) {
  if(this.store.hasSeen(event.id))return;
  const previous=this.evidence.get(event.session),lastHook=this.hookAt.get(event.session);
  if(source.source==='transcript'&&lastHook!==undefined){
   // Silence alone is insufficient: recovery also requires a newer transcript event.
   if(now-lastHook<120000||event.at<=lastHook||now-event.at>120000)return;
   this.hookAt.delete(event.session);
   this.store.resetObservation(event.session);
   source={...source,partial:true};
  }
  if(source.source==='hook'&&event.kind==='session'&&previous){
   if(direct&&!this.excluded.has(event.session))this.attach(event.session);
   return;
  }
  if(source.source==='hook'&&event.kind!=='session'){
   if(previous?.source==='transcript')this.store.resetObservation(event.session);
   this.hookAt.set(event.session,now);
  }
  const parentAttached=event.parent&&this.store.agents.get(event.parent)?.attached;
  const accepted=this.store.apply(event,!this.excluded.has(event.session)&&(direct||!!parentAttached));
  if(this.excluded.has(event.session))this.store.detach(event.session);
  if(accepted){
   this.evidence.set(event.session,{...source,connection:'observing'});
   this.journal.record(event,source.source);
  }
  this.prune();
 }
 attach(id:string){
  const a=this.store.agents.get(id);if(!a||a.ended)return;
  this.excluded.delete(id);this.store.attach(id);
  for(const child of this.store.agents.values())if(child.parent===id&&!this.excluded.has(child.id))this.store.attach(child.id);
 }
 detach(id:string){
  if(!this.store.agents.has(id))return;
  this.excluded.add(id);this.store.detach(id);this.links.delete(id);
  for(const child of this.store.agents.values())if(child.parent===id){this.excluded.add(child.id);this.store.detach(child.id);this.links.delete(child.id);}
  for(const [agent,terminal] of this.links)if(terminal===id)this.links.delete(agent);
 }
 link(id:string,terminal:string){
  const a=this.store.agents.get(id),t=this.store.agents.get(terminal);
  if(!a||a.provider==='terminal'||!a.attached||a.ended)return false;
  if(!terminal){this.links.delete(id);return true;}
  if(!t||t.provider!=='terminal'||t.ended||!t.attached)return false;
  // A terminal may contain several agents; explicit links retain every identity.
  this.links.set(id,terminal);return true;
 }
 mark(id:string,connection:Evidence['connection']){
  const e=this.evidence.get(id);if(e?.source==='transcript')this.evidence.set(id,{...e,connection});
 }
 pauseTranscripts(){for(const [id,e] of this.evidence)if(e.source==='transcript')this.mark(id,'paused');}
 private prune(){
  this.journal.prune(new Set(this.store.agents.keys()));
  for(const id of this.evidence.keys())if(!this.store.agents.has(id)){this.evidence.delete(id);this.hookAt.delete(id);this.excluded.delete(id);}
  for(const [id,terminal] of this.links){
   const a=this.store.agents.get(id),t=this.store.agents.get(terminal);
   if(!a?.attached||a.ended||!t?.attached||t.ended)this.links.delete(id);
  }
 }
}
