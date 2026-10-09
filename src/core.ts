export type Provider = 'codex' | 'claude' | 'terminal';
export type Activity = 'idle' | 'working' | 'reading' | 'editing' | 'running';
export type Kind = 'session' | 'turn' | 'tool-start' | 'tool-end' | 'approval' | 'input' | 'finish' | 'failure' | 'interrupt' | 'end';
export interface Event {
 v:1; id:string; session:string; provider:Provider; kind:Kind; at:number;
 tool?:string; turn?:string; parent?:string; activity?:Activity;
}
export interface Agent {
 id:string; provider:Provider; parent?:string; attached:boolean; activity:Activity;
 attention:'none'|'approval'|'input'|'error'; outcome:''|'finished'|'failed'|'interrupted';
 attentionTool?:string;
 ended:boolean; lastSeen:number; tools:Record<string,Activity>; turn?:string;
}
const kinds:Kind[]=['session','turn','tool-start','tool-end','approval','input','finish','failure','interrupt','end'];
export function validEvent(x:unknown):x is Event {
 if(!x || typeof x!=='object') return false;
 const e=x as Event;
 const keys=['v','id','session','provider','kind','at','tool','turn','parent','activity'];
 return Object.keys(e).every(k=>keys.includes(k)) && e.v===1 &&
 ['codex','claude','terminal'].includes(e.provider) && kinds.includes(e.kind) &&
 [e.id,e.session].every(v=>typeof v==='string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(v)) &&
 ['tool','turn','parent'].every(k=>e[k as keyof Event]===undefined || /^[a-zA-Z0-9:_-]{1,160}$/.test(String(e[k as keyof Event]))) &&
 Number.isFinite(e.at) && Math.abs(Date.now()-e.at)<86400000 &&
 (e.activity===undefined || ['idle','working','reading','editing','running'].includes(e.activity)) &&
 (!['tool-start','tool-end'].includes(e.kind) || !!e.tool);
}
export class GuildStore {
 agents=new Map<string,Agent>();
 private seen=new Set<string>();
 private done=new Set<string>();
 private settled=new Set<string>();
 apply(e:Event,attached=false) {
  if(this.seen.has(e.id)) return;
  this.seen.add(e.id); if(this.seen.size>4096) this.seen.delete(this.seen.values().next().value!);
  let a=this.agents.get(e.session);
  if(!a) {
   if(this.agents.size>=128) {
    const old=[...this.agents.values()].find(s=>s.ended||!s.attached);
    if(!old) return; this.agents.delete(old.id);
   }
   a={id:e.session,provider:e.provider,parent:e.parent,attached,activity:'idle',attention:'none',outcome:'',ended:false,lastSeen:e.at,tools:{}};
   this.agents.set(a.id,a);
  }
  a.attached ||= attached;
  if(e.parent) a.parent=e.parent;
  if(a.ended) return;
  const turnKey=e.session+':'+(e.turn||'');
  if(e.turn && this.settled.has(turnKey) && !['end','session'].includes(e.kind)) return;
  if(e.turn && a.turn && e.turn!==a.turn && e.at<a.lastSeen) return;
  if(e.turn && e.turn!==a.turn) {a.turn=e.turn; a.tools={}; a.attention='none'; a.attentionTool=undefined; a.outcome='';}
  a.lastSeen=Math.max(a.lastSeen,e.at);
  const key=turnKey+':'+e.tool;
  switch(e.kind) {
   case 'session': break;
   case 'turn': a.activity='working';a.attention='none';a.attentionTool=undefined;a.outcome='';break;
   case 'tool-start':
    if(!this.done.has(key)) {a.tools[e.tool!]=e.activity||'working';if(!a.attentionTool||a.attentionTool===e.tool){a.attention='none';a.attentionTool=undefined;}a.outcome='';}
    a.activity=this.activity(a);break;
   case 'tool-end':
    this.done.add(key);delete a.tools[e.tool!];if(a.attentionTool===e.tool){a.attention='none';a.attentionTool=undefined;}
    a.activity=Object.keys(a.tools).length?this.activity(a):(e.provider==='terminal'?'idle':'working');break;
   case 'approval': if(!e.tool||!this.done.has(key)){a.attention='approval';a.attentionTool=e.tool;}break;
   case 'input': a.attention='input';a.attentionTool=e.tool;break;
   case 'finish': case 'failure': case 'interrupt':
    a.tools={};a.activity='idle';a.attention=e.kind==='failure'?'error':'none';
    a.outcome=e.kind==='finish'?'finished':e.kind==='failure'?'failed':'interrupted';
    if(e.turn)this.settled.add(turnKey);break;
   case 'end': a.ended=true;a.activity='idle';a.tools={};a.attention='none';break;
  }
  for(const set of [this.done,this.settled]) if(set.size>4096)set.delete(set.values().next().value!);
 }
 private activity(a:Agent):Activity {
  const values=Object.values(a.tools);
  return values.includes('editing')?'editing':values.includes('running')?'running':values.includes('reading')?'reading':'working';
 }
 attach(id:string) {const a=this.agents.get(id);if(a)a.attached=true;}
 snapshot(){return [...this.agents.values()].map(a=>({...a,tools:{...a.tools}}));}
}
export function status(a:Agent,now=Date.now()) {
 if(a.ended)return 'Session closed';
 if(now-a.lastSeen>120000 && a.activity!=='idle')return 'Status unconfirmed';
 if(a.attention==='approval')return 'Approval needed';
 if(a.attention==='input')return 'Needs input';
 if(a.attention==='error')return 'Failed';
 if(a.outcome)return {finished:a.provider==='terminal'?'Command exited 0':'Turn finished',failed:'Failed',interrupted:'Interrupted'}[a.outcome];
 if(a.provider==='terminal'&&a.activity==='idle')return 'Terminal present';
 return {idle:'Idle',working:'Working',reading:'Reading / searching',editing:'Editing',running:'Running command'}[a.activity];
}
