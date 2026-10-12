import {GuildStore,type Event} from './core';
import type {Evidence} from './transcripts';
import {ActivityJournal} from './journal';

/** Window-local membership and source arbitration. Never infer ownership from cwd. */
export class Sessions {
 readonly store=new GuildStore();
 readonly evidence=new Map<string,Evidence>();
 readonly links=new Map<string,string>();
 readonly journal=new ActivityJournal();
 readonly membership=new Map<string,'window'|'manual'|'workspace'|'auto'>();
 private excluded=new Set<string>();
 private hookAt=new Map<string,number>();
 constructor(excluded:string[]=[]){this.excluded=new Set(excluded.slice(-128));}
 exclusions(){return [...this.excluded].slice(-128);}
 autoConnect(eligible:Set<string>){
  for(const a of this.store.agents.values()){
   const source=this.evidence.get(a.id),allowed=!!source?.workspace&&eligible.has(source.workspace)&&!a.ended&&!this.excluded.has(a.id);
   if(allowed&&source?.connection==='observing'&&(!a.attached||this.membership.get(a.id)==='auto')){this.store.attach(a.id);this.membership.set(a.id,'workspace');}
   if(!allowed&&this.membership.get(a.id)==='workspace'){this.store.detach(a.id);this.membership.delete(a.id);this.links.delete(a.id);}
  }
 }
 /** Auto-attach: every discovered live session joins the guild as it appears, whatever its source. This is a disclosed
  *  convenience, not proof of which window owns a chat; the host disables it while guild windows overlap. Exclusions,
  *  manual and window-bound membership are untouched. Turning it off releases only the sessions it attached. */
 autoAttach(enabled:boolean){
  for(const a of this.store.agents.values()){
   const member=this.membership.get(a.id);
   if(enabled&&!a.attached&&!a.ended&&!this.excluded.has(a.id)&&this.evidence.get(a.id)?.connection==='observing'){this.store.attach(a.id);this.membership.set(a.id,'auto');}
   if(!enabled&&member==='auto'){this.store.detach(a.id);this.membership.delete(a.id);this.links.delete(a.id);}
  }
 }

 receive(event:Event,direct:boolean,source:Evidence,now=Date.now()) {
  if(this.store.hasSeen(event.id))return;
  const previous=this.evidence.get(event.session),lastHook=this.hookAt.get(event.session);
  // Stronger hook activity must not prevent a verified transcript parser from
  // supplying workspace eligibility for automatic connection.
  if(source.workspace&&previous&&!previous.workspace)this.evidence.set(event.session,{...previous,workspace:source.workspace});
  if(source.source==='transcript'&&lastHook!==undefined){
   // Silence alone is insufficient: recovery also requires a newer transcript event.
   if(now-lastHook<120000||event.at<=lastHook||now-event.at>120000)return;
   this.hookAt.delete(event.session);
   this.store.resetObservation(event.session);
   source={...source,partial:true};
  }
  if(source.source==='hook'&&event.kind==='session'&&previous){
   if(direct&&!this.excluded.has(event.session))this.attach(event.session,'window');
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
   this.evidence.set(event.session,{...source,workspace:source.workspace||previous?.workspace||(event.parent?this.evidence.get(event.parent)?.workspace:undefined),connection:'observing'});
   if(direct&&!this.excluded.has(event.session))this.membership.set(event.session,'window');
   else if(parentAttached&&!this.membership.has(event.session))this.membership.set(event.session,this.membership.get(event.parent!)||'window');
   this.journal.record(event,source.source);
  }
  this.prune();
 }
 attach(id:string,membership:'manual'|'window'='manual'){
  const a=this.store.agents.get(id);if(!a||a.ended)return;
  this.excluded.delete(id);this.store.attach(id);
  this.membership.set(id,membership);
  for(const child of this.store.agents.values())if(child.parent===id&&!child.ended&&!this.excluded.has(child.id)){this.store.attach(child.id);this.membership.set(child.id,membership);}
 }
 detach(id:string){
  if(!this.store.agents.has(id))return;
  this.excluded.add(id);this.store.detach(id);this.links.delete(id);
  this.membership.delete(id);
  for(const child of this.store.agents.values())if(child.parent===id){this.excluded.add(child.id);this.store.detach(child.id);this.links.delete(child.id);this.membership.delete(child.id);}
  while(this.excluded.size>128)this.excluded.delete(this.excluded.values().next().value!);
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
  for(const id of this.evidence.keys())if(!this.store.agents.has(id)){this.evidence.delete(id);this.hookAt.delete(id);this.membership.delete(id);}
  for(const [id,terminal] of this.links){
   const a=this.store.agents.get(id),t=this.store.agents.get(terminal);
   if(!a?.attached||a.ended||!t?.attached||t.ended)this.links.delete(id);
  }
 }
}
