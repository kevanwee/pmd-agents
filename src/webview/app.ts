import type {Evidence} from '../transcripts';
import {GuildStore,status,type Agent,type Event} from '../core';
import {frameAt,slots,clearPath,facing,type Pack,type Species,type Point} from '../world';
declare global {interface Window {PMD_BOOT:{pack?:Pack;assetBase:string;assetError?:string;mode:string;agents:Agent[];links?:Record<string,string>;diagnostics?:{files:number;unsupported:number;readErrors:number;lastScan:number};observationEnabled?:boolean;evidence?:Record<string,Evidence>;assignments?:Record<string,string>;terminalNames?:Record<string,string>;clients?:{id:string;version:string}[]};acquireVsCodeApi?:()=>{postMessage:(msg:unknown)=>void;getState:()=>any;setState:(s:unknown)=>void};}}
const host=window.acquireVsCodeApi?.();
const boot=window.PMD_BOOT;
const pack=boot.pack;
let agents=boot.agents||[],assignments=boot.assignments||{},terminalNames=boot.terminalNames||{};
let evidence=boot.evidence||{};
let links=boot.links||{},diagnostics=boot.diagnostics,observationEnabled=boot.observationEnabled;
const displayStatus=(a:Agent)=>!demo&&evidence[a.id]?.connection==='paused'?'Observation paused':!demo&&evidence[a.id]?.connection==='unavailable'?'Observation unavailable':status(a);
const sourceLabel=(a:Agent)=>{const e=evidence[a.id];return e?.source==='transcript'?'Local transcript · '+(e.client||'client')+' '+(e.version||'')+(e.partial?' · partial history':''):e?.source==='hook'?'Observer hook':'Shell integration';};
let selected='',demo=false,quiet=host?.getState()?.quiet??false,visible=true,area=0;
let tab:'team'|'connections'|'credits'='team';
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<header><div class="brand"><span class="guild-mark" aria-hidden="true">✦</span><div><span class="eyebrow">EXPLORATION GUILD</span><h1>PMD Agents</h1></div></div><div class="header-actions"><span id="mode" class="mode">Current window</span><button id="quiet" aria-pressed="false" title="Pause world animations">Quiet</button><button id="demo">Try demo</button></div></header>
<main><section class="world-panel" aria-label="Guild world"><div class="scene-heading"><div><span class="eyebrow">FRIEND AREA 01</span><h2>Thunder Meadow</h2></div><span class="scene-tag">Training ground</span></div><div class="canvas-wrap"><canvas aria-label="Pokémon guild. Use the team list to select a session."></canvas><div id="empty" class="empty"></div><div class="world-tools"><span id="population"></span><button id="area" hidden>Next clearing</button></div></div><section id="details" class="dialogue" aria-label="Selected session"></section></section><aside><nav aria-label="Guild information"><button data-tab="team" aria-pressed="true">Team</button><button data-tab="connections">Connections</button><button data-tab="credits">Credits</button></nav><div id="sidebar"></div></aside></main><footer><span>Unofficial, non-commercial fan project</span><button id="credits">Credits & sources</button><span id="live-status" role="status" aria-live="polite"></span></footer>`;
const canvas=app.querySelector('canvas')!;
const ctx=canvas.getContext('2d')!;
const sidebar=app.querySelector<HTMLDivElement>('#sidebar')!;
const details=app.querySelector<HTMLDivElement>('#details')!;
const empty=app.querySelector<HTMLDivElement>('#empty')!;
const imageCache=new Map<string,HTMLImageElement>();
const failedImages=new Set<string>();
const actors=new Map<string,{p:Point;target:Point;slot:number;direction:number;elapsed:number;rest:number}>();
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let frame=0,last=0,drawCount=0;
const send=(msg:unknown)=>host?.postMessage(msg);
const img=(file:string)=>{
 if(!imageCache.has(file)){const el=new Image();el.onload=()=>{draw(0);};el.onerror=()=>{failedImages.add(file);render();};el.src=boot.assetBase+file;imageCache.set(file,el);}
 const el=imageCache.get(file)!;return el.complete&&el.naturalWidth?el:undefined;
};
const button=(text:string,action:()=>void,className='')=>{const b=document.createElement('button');b.textContent=text;b.className=className;b.dataset.focusKey=className+':'+text;b.onclick=action;return b;};
const node=(tag:string,text:string,className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
const species=(a:Agent):Species|undefined=>pack?.sprites.find(s=>s.id===assignments[a.id])||pack?.sprites[[...a.id].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0)%pack.sprites.length];
const label=(a:Agent)=>a.provider==='terminal'?(terminalNames[a.id]||'Terminal'):a.provider==='codex'?'Codex':'Claude Code';
const shown=()=>{const linked=new Set(demo?[]:Object.entries(links).filter(([id])=>agents.some(a=>a.id===id&&a.attached&&!a.ended)).map(([,terminal])=>terminal));return agents.filter(a=>a.attached&&!a.ended&&!linked.has(a.id));};
function ensureActors(){
 const ids=new Set(shown().map(a=>a.id));for(const id of actors.keys())if(!ids.has(id))actors.delete(id);
 for(const [n,a] of shown().entries()){
  const old=actors.get(a.id),p=slots[n%slots.length];
  if(!old||old.slot!==n)actors.set(a.id,{p:{...p},target:{...p},slot:n,direction:old?.direction||0,elapsed:old?.elapsed||0,rest:0});
 }
}
function focusLabel(a:Agent){return a.provider==='terminal'||links[a.id]?'Focus terminal':'Open '+label(a)+' panel';}
function render() {
 ensureActors();
 // Keep a native select open while asynchronous activity arrives.
 if(document.activeElement instanceof HTMLSelectElement&&app.contains(document.activeElement))return;
 const focusKey=(document.activeElement as HTMLElement)?.dataset?.focusKey;
 const scrollTop=sidebar.scrollTop;
 const team=shown(),candidates=agents.filter(a=>!a.attached&&!a.ended);
 if(!team.some(a=>a.id===selected))selected=team[0]?.id||'';
 app.querySelector('#mode')!.textContent=demo?'DEMO · simulated sessions':'Current window';
 app.querySelector('#mode')!.className='mode'+(demo?' demo':'');
 app.querySelector('#demo')!.textContent=demo?'Exit demo':'Try demo';
 app.querySelector('#quiet')!.setAttribute('aria-pressed',String(quiet));
 app.querySelector('#quiet')!.textContent=quiet?'Resume motion':'Quiet';
 const pages=Math.max(1,Math.ceil(team.length/slots.length));
 area=Math.min(area,pages-1);
 app.querySelector('#population')!.textContent=team.length+' '+(team.length===1?'session':'sessions')+(pages>1?' · clearing '+(area+1)+' / '+pages:'');
 (app.querySelector('#area') as HTMLButtonElement).hidden=pages===1;
 empty.replaceChildren();empty.hidden=!!pack&&team.length>0&&!failedImages.size;
 if(!empty.hidden){empty.append(node('h3',failedImages.size?'An artwork file could not load':!pack?'Your guild is ready':'A quiet moment'));
  empty.append(node('p',failedImages.size?'Choose the complete asset pack again.':!pack?boot.assetError||'Choose your local PMD asset pack.':'No sessions connected. Open a terminal or connect your agents.'));
  if(!pack||failedImages.size)empty.append(button('Choose asset pack',()=>send({type:'assets'}),'primary'));
  else empty.append(button('Connect agents',()=>{tab='connections';render();},'primary'));
 }
 details.replaceChildren();
 const a=team.find(x=>x.id===selected);
 if(a){
  const sp=species(a);if(sp){const portrait=document.createElement('img');portrait.src=boot.assetBase+sp.portrait;portrait.alt=sp.name;portrait.className='portrait';details.append(portrait);}
  const body=node('div','','dialogue-body');
  body.append(node('div',label(a)+(sp?' · '+sp.name:''),'speaker'));
  body.append(node('h3',displayStatus(a)));
  body.append(node('p',demo?'Simulated activity':sourceLabel(a)+' · last seen '+new Date(a.lastSeen).toLocaleTimeString()+(links[a.id]?' · linked to '+(terminalNames[links[a.id]]||'terminal'):'')));
  details.append(body);
  const actions=node('div','','detail-actions');
  if(!demo)actions.append(button(focusLabel(a),()=>send({type:'focus',id:a.id}),'primary'));
  if(!demo)actions.append(button('Manage session',()=>{tab='connections';render();}));
  if(pack){const select=document.createElement('select');select.dataset.focusKey='species:'+a.id;select.setAttribute('aria-label','Pokémon for selected session');
   for(const s of pack.sprites){const o=document.createElement('option');o.value=s.id;o.textContent=s.name;select.append(o);}
   select.value=sp!.id;select.onchange=()=>{assignments[a.id]=select.value;if(!demo)send({type:'character',id:a.id,species:select.value});render();};actions.append(select);}
  details.append(actions);
 }else{details.append(node('span','✦','dialogue-star'),node('div','Select a teammate to see its activity.','dialogue-body'));}
 sidebar.replaceChildren();
 app.querySelectorAll('[data-tab]').forEach(el=>el.setAttribute('aria-pressed',String(el.getAttribute('data-tab')===tab)));
 if(tab==='team'){
  sidebar.append(node('div','EXPLORATION TEAM','section-label'));
  if(!team.length)sidebar.append(node('p','Connected sessions will appear here.','muted'));
  for(const member of team){
   const sp=species(member);
   const row=button('',()=>{selected=member.id;area=Math.floor(team.findIndex(a=>a.id===member.id)/slots.length);render();},'team-row');
   row.dataset.focusKey='team:'+member.id;
   row.setAttribute('aria-pressed',String(selected===member.id));
   if(sp){const portrait=document.createElement('img');portrait.src=boot.assetBase+sp.portrait;portrait.alt='';row.append(portrait);}
   const text=node('div','','team-text');text.append(node('strong',sp?.name||label(member)),node('span',label(member)+(links[member.id]?' · linked terminal':''),'provider'),node('span',displayStatus(member),'state'));row.append(text);
   if(member.attention!=='none')row.append(node('span',member.attention==='input'?'?':'!','attention'));
   sidebar.append(row);
  }
  if(candidates.length)sidebar.append(button(candidates.length+' sessions available to attach',()=>{tab='connections';render();},'attach-summary'));
 }else if(tab==='connections'){
  sidebar.append(node('div','PROVIDER CONNECTIONS','section-label'));
  sidebar.append(node('h3','Keep your own chats'),node('p','Recent local Codex and Claude chat activity appears here automatically for supported client versions. Attach a session to bring it into your guild.','muted'));
  sidebar.append(button('Set up observer hooks',()=>send({type:'setup'}),'primary'));
  sidebar.append(node('p','Hooks provide stronger lifecycle and approval signals. Codex hooks must be trusted in Codex. PMD Agents never answers approval prompts.','muted'));
  for(const c of boot.clients||[])sidebar.append(node('p',(c.id==='openai.chatgpt'?'Codex':'Claude Code')+' · '+c.version,'client-version'));
  if(!demo){
   sidebar.append(node('h3','Local observation'));
   sidebar.append(node('p',observationEnabled===false?'Local chat observation is disabled in settings.':diagnostics?diagnostics.files+' chat files watched · '+diagnostics.unsupported+' unsupported · '+diagnostics.readErrors+' read errors':'Waiting for local discovery.','muted'));
   if(diagnostics?.lastScan)sidebar.append(node('p','Last scan '+new Date(diagnostics.lastScan).toLocaleTimeString(),'client-version'));
   const scan=button('Scan for chats',()=>send({type:'rescan'}));scan.disabled=observationEnabled===false;sidebar.append(scan);
   sidebar.append(node('h3','Manage guild'));
   sidebar.append(node('p','Link an agent to the terminal that runs it to use one Pokémon. Removing a session only removes it from this guild.','muted'));
   for(const member of agents.filter(a=>a.attached&&!a.ended)){
    const card=node('div','','candidate');card.append(node('strong',label(member)+' · '+member.id.slice(-6)));
    if(member.provider!=='terminal'){
     const select=document.createElement('select');select.dataset.focusKey='terminal:'+member.id;select.setAttribute('aria-label','Terminal for '+label(member)+' '+member.id.slice(-6));
     const none=document.createElement('option');none.value='';none.textContent='Separate / native chat';select.append(none);
     for(const t of agents.filter(a=>a.provider==='terminal'&&a.attached&&!a.ended)){const o=document.createElement('option');o.value=t.id;o.textContent=terminalNames[t.id]||'Terminal';select.append(o);}
     select.value=links[member.id]||'';select.onchange=()=>send({type:'link',id:member.id,terminal:select.value});card.append(select);
    }
    const remove=button('Remove from guild',()=>send({type:'detach',id:member.id}));remove.dataset.focusKey='remove:'+member.id;card.append(remove);sidebar.append(card);
   }
  }
  sidebar.append(node('h3','Available sessions'));
  sidebar.append(node('p','Choose which unassigned sessions belong to this window. Folder matches alone are not used to attach.','muted'));
  if(!candidates.length)sidebar.append(node('p','No unassigned events received yet.','muted'));
  for(const c of candidates){const card=node('div','','candidate');card.append(node('strong',label(c)+' · '+c.id.slice(-6)),node('p',displayStatus(c)+' · '+new Date(c.lastSeen).toLocaleTimeString()),node('p',sourceLabel(c)+(evidence[c.id]?.project?' · '+evidence[c.id].project:''),'muted'),button('Attach to this window',()=>send({type:'attach',id:c.id})));sidebar.append(card);}
  sidebar.append(button('Choose asset pack',()=>send({type:'assets'})));
 }else{
  sidebar.append(node('div','CREDITS & SOURCES','section-label'),node('h3','A PMD fan project'));
  sidebar.append(node('p','Unaffiliated with Nintendo, Creatures Inc., GAME FREAK, The Pokémon Company or Spike Chunsoft. Pokémon and game artwork belong to their respective owners.','muted'));
  sidebar.append(node('p','Inspired by Pixel Agents — Pablo De Lucca and contributors. Built by Kevan Wee, drawing on Voracity.','muted'));
  const link=document.createElement('a');link.href='https://github.com/pixel-agents-hq/pixel-agents';link.textContent='Pixel Agents';sidebar.append(link);
  for(const s of pack?.sprites||[])sidebar.append(node('h3',s.name),node('p',[...s.artists,...s.portraitCredits].join(' · '),'credit-text'));
  sidebar.append(node('p','SpriteCollab: individual asset terms are preserved in the local pack. Original game sprites are not automatically covered by the fan-art licence.','muted'));
  sidebar.append(node('p',pack?.maps[0].credit||'No local artwork loaded.','muted'),node('p','Pixelify Sans Project Authors · SIL OFL. Training dummy: original procedural prop.','muted'));
 }
 const live=team.filter(a=>a.attention!=='none').length;
 app.querySelector('#live-status')!.textContent=live?live+' session'+(live===1?'':'s')+' need attention':'';
 sidebar.scrollTop=scrollTop;
 if(focusKey)app.querySelector<HTMLElement>('[data-focus-key="'+CSS.escape(focusKey)+'"]')?.focus({preventScroll:true});
 draw(0);
}
function dummy(p:Point,hit:boolean) {
 ctx.fillStyle='#403121';ctx.fillRect(p.x-1,p.y-21,3,22);ctx.fillRect(p.x-10,p.y-16,20,3);
 ctx.fillStyle=hit?'#fff0a8':'#c6a562';ctx.fillRect(p.x-6,p.y-28,13,12);
 ctx.fillStyle='#7a512e';ctx.fillRect(p.x-3,p.y-25,7,6);ctx.fillStyle='#e5cf88';ctx.fillRect(p.x-1,p.y-23,3,2);
 ctx.fillStyle='#5e4731';ctx.fillRect(p.x-5,p.y,11,2);
 if(hit){ctx.fillStyle='#fff4be';ctx.fillRect(p.x-10,p.y-31,2,3);ctx.fillRect(p.x+10,p.y-25,3,2);}
}
function draw(delta:number){
 ensureActors();
 drawCount++;
 const box=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;
 if(!box.width||!box.height)return;
 const w=Math.round(box.width*dpr),h=Math.round(box.height*dpr);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#132022';ctx.fillRect(0,0,w,h);
 if(!pack)return;
 const map=pack.maps[0],bg=img(map.file);
 const scale=Math.max(1,Math.round(Math.min(w/map.width,h/map.height)));
 const ox=Math.round((w-map.width*scale)/2),oy=Math.round((h-map.height*scale)/2);
 ctx.translate(ox,oy);ctx.scale(scale,scale);ctx.imageSmoothingEnabled=false;
 if(bg)ctx.drawImage(bg,0,0);
 const list=shown().slice(area*slots.length,(area+1)*slots.length);
 const now=Date.now(),still=quiet||reduced.matches;
 for(const a of list){
  const actor=actors.get(a.id)!;
  const sp=species(a);if(!sp)continue;
  actor.elapsed+=still?0:delta;
  const uncertain=['Status unconfirmed','Observation unavailable','Observation paused'].includes(displayStatus(a)),attention=a.attention!=='none'||uncertain;
  const canMove=!still&&!attention&&['working','reading','running'].includes(a.activity);
  const home=slots[actor.slot%slots.length];
  if(canMove){
   if(Math.hypot(actor.p.x-actor.target.x,actor.p.y-actor.target.y)<1){
    actor.rest+=delta;
    if(actor.rest>650){
     const phase=Math.floor(actor.elapsed/2400)%2;
     const target={x:home.x+(phase?14:-14),y:home.y+(phase?-6:6)};
     actor.target=clearPath(actor.p,target)?target:{...home};actor.rest=0;
    }
   }else{
    actor.direction=facing(actor.p,actor.target);
    const dist=Math.hypot(actor.p.x-actor.target.x,actor.p.y-actor.target.y),step=Math.min(dist,delta*.025);
    const next={x:actor.p.x+(actor.target.x-actor.p.x)*step/dist,y:actor.p.y+(actor.target.y-actor.p.y)*step/dist};
    if(clearPath(actor.p,next))actor.p=next;else actor.target={...actor.p};
   }
  }else{actor.target={...actor.p};actor.direction=attention?0:2;}
 }
 for(const a of [...list].sort((a,b)=>actors.get(a.id)!.p.y-actors.get(b.id)!.p.y)){
  const actor=actors.get(a.id)!,sp=species(a);if(!sp)continue;
  const uncertain=['Status unconfirmed','Observation unavailable','Observation paused'].includes(displayStatus(a)),attention=a.attention!=='none'||uncertain;
  const editing=a.activity==='editing'&&!attention;
  const attack=sp.animations.Attack,cycle=actor.elapsed%1800;
  const attacking=editing&&!still&&cycle<attack.durations.reduce((x,y)=>x+y,0)*1000/60;
  let action=attacking?'Attack':!still&&!attention&&['working','reading','running'].includes(a.activity)?'Walk':a.activity==='idle'&&!attention&&now-a.lastSeen>30000?'Sleep':'Idle';
  const anim=sp.animations[action],f=still?0:frameAt(anim,attacking?cycle:actor.elapsed),row=anim.rows===1?0:actor.direction;
  const sheet=img(anim.file);
  if(editing)dummy({x:actor.p.x+23,y:actor.p.y},attacking&&f===attack.hit);
  const x=Math.round(actor.p.x),y=Math.round(actor.p.y);
  if(a.id===selected){ctx.strokeStyle='#fff2a8';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y+1,12,4,0,0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle='#17252355';ctx.beginPath();ctx.ellipse(x,y,7,2,0,0,Math.PI*2);ctx.fill();
  if(sheet){const anchor=anim.anchors[row][f];ctx.drawImage(sheet,f*anim.w,row*anim.h,anim.w,anim.h,x-anchor[0],y-anchor[1],anim.w,anim.h);}
  if(attention){
   ctx.fillStyle='#f7e8b6';ctx.fillRect(x-6,y-38,13,14);ctx.fillRect(x-2,y-24,4,3);
   ctx.fillStyle='#432e24';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText(uncertain?'…':a.attention==='input'?'?':'!',x+1,y-27);
  }
 }
 canvas.dataset.drawCount=String(drawCount);
 canvas.dataset.simulationTime=String([...actors.values()].reduce((sum,a)=>sum+a.elapsed,0));
 canvas.dataset.actors=String(list.length);
 canvas.dataset.positions=JSON.stringify(list.map(a=>{const p=actors.get(a.id)!.p;return {id:a.id,x:Math.round(p.x),y:Math.round(p.y)};}));
}
function loop(time:number){frame=0;if(!visible||document.hidden||quiet||reduced.matches)return;draw(Math.min(50,last?time-last:0));last=time;frame=requestAnimationFrame(loop);}
function restart(){cancelAnimationFrame(frame);frame=0;last=0;draw(0);if(visible&&!document.hidden&&!quiet&&!reduced.matches)frame=requestAnimationFrame(loop);}
new ResizeObserver(()=>draw(0)).observe(canvas);
document.addEventListener('visibilitychange',restart);reduced.addEventListener('change',restart);
app.addEventListener('focusout',e=>{if(e.target instanceof HTMLSelectElement)setTimeout(render,0);});
app.querySelector('#quiet')!.addEventListener('click',()=>{quiet=!quiet;host?.setState({quiet});render();restart();});
app.querySelector('#area')!.addEventListener('click',()=>{area=(area+1)%Math.max(1,Math.ceil(shown().length/slots.length));render();});
app.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>{tab=el.getAttribute('data-tab') as typeof tab;render();}));
app.querySelector('#credits')!.addEventListener('click',()=>{tab='credits';render();});
let saved:Agent[]=[];let demoTimer:ReturnType<typeof setInterval>|undefined;
let demoStore=new GuildStore();let demoTurn=0;
function demoStep(){
 const id='demo-codex',turn='turn-'+(++demoTurn);
 const emit=(session:string,kind:Event['kind'],extra:Partial<Event>={})=>demoStore.apply({v:1,id:crypto.randomUUID(),session,provider:session===id?'codex':'claude',at:Date.now(),kind,...extra},true);
 emit(id,'turn',{turn});emit(id,'tool-start',{turn,tool:'edit',activity:'editing'});
 emit('demo-claude','turn');emit('demo-claude','tool-start',{tool:'read-'+demoTurn,activity:'reading'});
 emit('demo-review','turn');emit('demo-review','approval');
 agents=demoStore.snapshot();render();
}
app.querySelector('#demo')!.addEventListener('click',()=>{
 demo=!demo;area=0;actors.clear();
 if(demo){saved=agents;demoStore=new GuildStore();Object.assign(assignments,{'demo-codex':'eevee','demo-claude':'riolu','demo-review':'ceruledge'});demoStep();demoTimer=setInterval(()=>{
  const a=demoStore.agents.get('demo-review')!;a.attention=a.attention==='approval'?'input':'approval';agents=demoStore.snapshot();render();
 },8000);}else{clearInterval(demoTimer);agents=saved;render();send({type:'ready'});}
});
window.addEventListener('message',event=>{
 const m=event.data;
 if(m.type==='snapshot'){links=m.links||{};diagnostics=m.diagnostics;observationEnabled=m.observationEnabled;evidence=m.evidence||{};if(demo){saved=m.agents;return;}agents=m.agents;assignments=m.assignments||{};terminalNames=m.terminalNames||{};render();}
 if(m.type==='visibility'){visible=m.visible;restart();}
});
canvas.addEventListener('click',event=>{
 const rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1,scale=Math.max(1,Math.round(Math.min(canvas.width/456,canvas.height/335)));
 const x=((event.clientX-rect.left)*dpr-(canvas.width-456*scale)/2)/scale,y=((event.clientY-rect.top)*dpr-(canvas.height-335*scale)/2)/scale;
 const hit=shown().slice(area*6,(area+1)*6).find(a=>{const p=actors.get(a.id)!.p;return Math.abs(p.x-x)<16&&y<p.y+5&&y>p.y-45;});
 if(hit){selected=hit.id;render();}
});
render();restart();send({type:'ready'});
// Update freshness labels without advancing simulation or inventing completions.
setInterval(()=>{if(visible&&!document.hidden)render();},15000);
