import {connectionStatus,attachmentReason} from '../connectionStatus';
import type {Evidence} from '../transcripts';
import {GuildStore,status,type Agent,type Event} from '../core';
import {ActivityJournal,journalText,type JournalEntry} from '../journal';
import {trainingAt} from '../training';
import {Placement} from '../placement';
import {Navigator,terrains,segment,canStand} from '../navigation';
import {frameAt,facing,type Pack,type Species,type Point} from '../world';
import {PokemonPc} from './pc';
declare global {interface Window {PMD_BOOT:{presentation?:'full'|'widget'|'desktop';quiet?:boolean;workspaces?:string[];scene?:string;autoConnect?:boolean;autoAttach?:boolean;autoState?:string;exclusions?:string[];membership?:Record<string,string>;pack?:Pack;assetBase:string;assetError?:string;mode:string;agents:Agent[];journal?:Record<string,JournalEntry[]>;links?:Record<string,string>;diagnostics?:{files:number;outsideWorkspace?:number;unsupported:number;readErrors:number;lastScan:number;historyFolders?:number;historyChecked?:number;historyCapped?:boolean};observationEnabled?:boolean;evidence?:Record<string,Evidence>;assignments?:Record<string,string>;terminalNames?:Record<string,string>;clients?:{id:string;version:string}[]};acquireVsCodeApi?:()=>{postMessage:(msg:unknown)=>void;getState:()=>any;setState:(s:unknown)=>void};}}
const host=window.acquireVsCodeApi?.();
const boot=window.PMD_BOOT;
const pack=boot.pack;
let sceneId=boot.scene||host?.getState()?.scene||'forest';
const scene=()=>pack?.maps.find(m=>m.id===sceneId)||pack?.maps[0];
const terrain=()=>terrains[scene()?.id||'meadow'];
const navigation=new Map<string,Navigator>();
const navigator=()=>{const id=scene()?.id||'meadow';if(!navigation.has(id))navigation.set(id,new Navigator(terrain()));return navigation.get(id)!;};
let workspaces=boot.workspaces;
let autoConnect=boot.autoConnect??true,autoAttach=boot.autoAttach??true,autoState=boot.autoState,membership=boot.membership||{};
let exclusions=boot.exclusions||[];
let worldTime=0,showPaths=false,zoom=1,pan={x:0,y:0},view={x:0,y:0,scale:1};

let agents=boot.agents||[],assignments=boot.assignments||{},terminalNames=boot.terminalNames||{};
let evidence=boot.evidence||{};
let journal=boot.journal||{};
let links=boot.links||{},diagnostics=boot.diagnostics,observationEnabled=boot.observationEnabled;
const displayStatus=(a:Agent)=>a.ended?status(a):!demo&&evidence[a.id]?.connection==='paused'?'Observation paused':!demo&&evidence[a.id]?.connection==='unavailable'?'Observation unavailable':status(a);
const sourceLabel=(a:Agent)=>{const e=evidence[a.id];return e?.source==='transcript'?'Local transcript · '+(e.client||'client')+' '+(e.version||'')+(e.partial?' · partial history':''):e?.source==='hook'?'Observer hook':'Shell integration';};
let selected='',selectedByUser=false,demo=false,quiet=boot.quiet??host?.getState()?.quiet??false,visible=true,area=0;
let hookSetup:{id:string;provider:string;remove?:boolean;file:string;preview:string;installing?:boolean}|undefined;
let hookResult:{provider?:string;remove?:boolean;error?:string}|undefined,reviewOpen=false;
let tab:'team'|'activity'|'connections'|'credits'='team';
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<header><div class="brand"><span class="guild-mark" aria-hidden="true">✦</span><div><span class="eyebrow">EXPLORATION GUILD</span><h1>PMD Agents</h1></div></div><div class="header-actions"><span id="mode" class="mode">Current window</span><button id="quiet" aria-pressed="false" title="Pause world animations">Quiet</button><button id="demo">Try demo</button></div></header>
<main><section class="world-panel" aria-label="Guild world"><div class="scene-heading"><div><span class="eyebrow">FRIEND AREA 01</span><h2>Thunder Meadow</h2></div><div class="scene-controls"><select id="scene" aria-label="Friend area"></select><button id="zoom">Zoom in</button><button id="paths" aria-pressed="false">Walkable area</button></div></div><div class="canvas-wrap"><canvas aria-label="Pokémon guild. Use the team list to select a session."></canvas><div id="empty" class="empty"></div><div class="world-tools"><span id="population"></span><button id="area" hidden>Next clearing</button></div></div><section id="details" class="dialogue" aria-label="Selected session"></section></section><aside><nav aria-label="Guild information"><button data-tab="team" aria-pressed="true">Team</button><button data-tab="activity">Activity</button><button data-tab="connections">Connections</button><button data-tab="credits">Credits</button></nav><div id="sidebar"></div></aside></main><footer><span>Unofficial, non-commercial fan project</span><button id="credits">Credits & sources</button><span id="live-status" role="status" aria-live="polite"></span></footer>`;
const canvas=app.querySelector('canvas')!;
const compact=boot.presentation==='widget'||boot.presentation==='desktop';
if(compact){
 document.body.classList.add('compact');
 app.insertAdjacentHTML('afterbegin','<div class="widget-toolbar"><button id="widget-open" title="Open the full guild">Open guild</button><button id="widget-quiet" aria-pressed="false">Quiet</button>'+(boot.presentation==='widget'?'<button id="widget-desktop" title="Show desktop widget">Pop out</button>':'')+'</div>');
 app.querySelector('#widget-open')!.addEventListener('click',()=>send({type:'openGuild'}));
 app.querySelector('#widget-desktop')?.addEventListener('click',()=>send({type:'desktop'}));
 app.querySelector('#widget-quiet')!.addEventListener('click',()=>app.querySelector<HTMLButtonElement>('#quiet')!.click());
}
const ctx=canvas.getContext('2d')!;
const sidebar=app.querySelector<HTMLDivElement>('#sidebar')!;
const details=app.querySelector<HTMLDivElement>('#details')!;
const empty=app.querySelector<HTMLDivElement>('#empty')!;
const imageCache=new Map<string,HTMLImageElement>();
const failedImages=new Set<string>();
const actors=new Map<string,{p:Point;target:Point;slot:number;direction:number;elapsed:number;trainingElapsed:number;rest:number;path:Point[];mode:string;walking:boolean;trip:number}>();
const placement=new Placement();
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let frame=0,last=0,drawCount=0;
const send=(msg:unknown)=>host?.postMessage(msg);
const img=(file:string)=>{
 if(!imageCache.has(file)){const el=new Image();el.onload=()=>{draw(0);};el.onerror=()=>{failedImages.add(file);render();};el.src=boot.assetBase+file;imageCache.set(file,el);}
 const el=imageCache.get(file)!;return el.complete&&el.naturalWidth?el:undefined;
};
const button=(text:string,action:()=>void,className='')=>{const b=document.createElement('button');b.textContent=text;b.className=className;b.dataset.focusKey=className+':'+text;b.onclick=action;return b;};
const node=(tag:string,text:string,className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
const species=(a:Agent):Species|undefined=>pack?.sprites.find(s=>s.id===assignments[a.id])||pack?.sprites[[...a.id].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0)%Math.min(3,pack.sprites.length)];
const label=(a:Agent)=>a.provider==='terminal'?(terminalNames[a.id]||'Terminal'):a.provider==='codex'?'Codex':'Claude Code';
/** The storage system chooses a Pokémon (or form) for the selected session; imports arrive from the host and join the pack. */
const pc=new PokemonPc(app,{send,assetBase:boot.assetBase,pack:()=>pack,
 session:()=>{const a=agents.find(x=>x.id===selected&&x.attached&&!x.ended);return a?{id:a.id,label:label(a),species:species(a)?.id}:undefined;},
 sessions:()=>shown().map(a=>({id:a.id,label:label(a),species:species(a)?.id})),
 select:id=>{if(!agents.some(a=>a.id===id))return;selectedByUser=true;selected=id;area=placement.page(id);render();},
 choose:(id,sessionId)=>{if(!agents.some(a=>a.id===sessionId&&a.attached&&!a.ended)||!pack?.sprites.some(s=>s.id===id))return;assignments[sessionId]=id;if(!demo)send({type:'character',id:sessionId,species:id});render();},
 recall:()=>host?.getState()?.pc,remember:state=>host?.setState({...host.getState(),pc:state})});
/** Move colours by type: two tones per type, original decorative values. */
const MOVE_COLORS:Record<string,string[]>={normal:['#ebc8ff','#fff0ff'],fire:['#ff9843','#fff1a5'],water:['#70d5ff','#e2faff'],grass:['#7ec950','#ddf899'],electric:['#ffe45c','#fffbd1'],ice:['#a8ecf5','#f0fdff'],fighting:['#ffd287','#fff7d1'],poison:['#d78cf0','#f6e3ff'],ground:['#e6c37a','#fff3cf'],flying:['#c2b8ff','#f1eeff'],psychic:['#ff8fb8','#ffe3ee'],bug:['#c6e05a','#f3ffc6'],rock:['#d2bd7c','#f5ecd0'],ghost:['#9a86d9','#e6dfff'],dragon:['#8f7cff','#e3deff'],dark:['#8d7f7a','#e4d9d5'],steel:['#c9c9e8','#f3f3ff'],fairy:['#ffb3cf','#ffe9f1']};
const shown=()=>{const linked=new Set(demo?[]:Object.entries(links).filter(([id])=>agents.some(a=>a.id===id&&a.attached&&!a.ended)).map(([,terminal])=>terminal));return agents.filter(a=>a.attached&&!a.ended&&!linked.has(a.id));};
const inClearing=()=>{const pages=placement.pages(),page=pages.includes(area)?area:pages[0]??0;return shown().filter(a=>placement.page(a.id)===page);};
function ensureActors(){
 const team=shown(),ids=new Set(team.map(a=>a.id));placement.sync([...ids]);for(const id of actors.keys())if(!ids.has(id))actors.delete(id);
 for(const a of team){
  const n=placement.slots.get(a.id)!;
  const old=actors.get(a.id),p=terrain().stations[n%6];
  if(!old||old.slot!==n)actors.set(a.id,{p:{...p},target:{...p},slot:n,direction:old?.direction||0,elapsed:old?.elapsed||0,trainingElapsed:0,rest:0,path:[],mode:'',walking:false,trip:n});
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
 if(!selectedByUser&&team.find(a=>a.id===selected)?.provider==='terminal'){const chat=team.find(a=>a.provider!=='terminal');if(chat)selected=chat.id;}
 if(!team.some(a=>a.id===selected)&&!(tab==='activity'&&agents.some(a=>a.id===selected&&a.attached&&a.ended)))selected=(team.find(a=>a.provider!=='terminal')||team[0])?.id||'';
 app.querySelector('#mode')!.textContent=demo?'DEMO · simulated sessions':autoAttach?'Auto-attach':autoConnect?'Workspace auto':'Current window';
 app.querySelector('.scene-heading h2')!.textContent=scene()?.name||'Exploration guild';
 const mapSelect=app.querySelector<HTMLSelectElement>('#scene')!;
 if(!mapSelect.options.length)for(const map of pack?.maps||[]){const option=document.createElement('option');option.value=map.id;option.textContent=map.name;mapSelect.append(option);}
 mapSelect.value=scene()?.id||'';
 app.querySelector('#zoom')!.textContent=zoom===1?'Zoom in':'Fit map';
 app.querySelector('#paths')!.setAttribute('aria-pressed',String(showPaths));
 app.querySelector('#mode')!.className='mode'+(demo?' demo':'');
 app.querySelector('#demo')!.textContent=demo?'Exit demo':'Try demo';
 app.querySelector('#quiet')!.setAttribute('aria-pressed',String(quiet));
 app.querySelector('#quiet')!.textContent=quiet?'Resume motion':'Quiet';
 const widgetQuiet=app.querySelector('#widget-quiet');if(widgetQuiet){widgetQuiet.textContent=quiet?'Resume':'Quiet';widgetQuiet.setAttribute('aria-pressed',String(quiet));}
 const pages=Math.max(1,placement.pages().length);
 if(!placement.pages().includes(area))area=placement.pages()[0]??0;
 app.querySelector('#population')!.textContent=team.length+' '+(team.length===1?'session':'sessions')+(pages>1?' · clearing '+(placement.pages().indexOf(area)+1)+' / '+pages:'');
 (app.querySelector('#area') as HTMLButtonElement).hidden=pages===1;
 empty.replaceChildren();empty.hidden=!!pack&&team.length>0&&!failedImages.size;
 if(!empty.hidden){empty.append(node('h3',failedImages.size?'An artwork file could not load':!pack?'Your guild is ready':'A quiet moment'));
  empty.append(node('p',failedImages.size?'Choose the complete asset pack again.':!pack?boot.assetError||'Choose your local PMD asset pack.':connectionStatus({workspaces,autoConnect,autoAttach,autoState,observationEnabled,diagnostics})));
  if(compact)empty.append(button('Open guild',()=>send({type:'openGuild'}),'primary'));
  else if(!pack||failedImages.size)empty.append(button('Choose asset pack',()=>send({type:'assets'}),'primary'));
  else {empty.append(button('Connection details',()=>{tab='connections';render();},'primary'));if(!workspaces?.length||diagnostics?.outsideWorkspace)empty.append(button('Add project folder',()=>send({type:'addWorkspaceFolder'})));}
 }
 details.replaceChildren();
 const a=team.find(x=>x.id===selected)||(tab==='activity'?agents.find(x=>x.id===selected&&x.attached&&x.ended):undefined);
 if(a){
  const sp=species(a);if(sp){const portrait=document.createElement('img');portrait.src=boot.assetBase+sp.portrait;portrait.alt=sp.name;portrait.className='portrait';details.append(portrait);}
  const body=node('div','','dialogue-body');
  body.append(node('div',label(a)+(sp?' · '+sp.name:''),'speaker'));
  body.append(node('h3',displayStatus(a)));
  body.append(node('p',demo?'Simulated activity':(membership[a.id]==='workspace'?'Auto-connected · ':membership[a.id]==='auto'?'Auto-attached · ':'')+sourceLabel(a)+' · last seen '+new Date(a.lastSeen).toLocaleTimeString()+(links[a.id]?' · linked to '+(terminalNames[links[a.id]]||'terminal'):'')));
  details.append(body);
  const actions=node('div','','detail-actions');
  if(!demo&&!a.ended)actions.append(button(focusLabel(a),()=>send({type:'focus',id:a.id}),'primary'));
  if(!demo&&!a.ended)actions.append(button('Manage session',()=>{tab='connections';render();}));
  if(pack){const select=document.createElement('select');select.dataset.focusKey='species:'+a.id;select.setAttribute('aria-label','Pokémon for selected session');
   for(const s of pack.sprites){const o=document.createElement('option');o.value=s.id;o.textContent=s.name;select.append(o);}
   select.value=sp!.id;select.onchange=()=>{assignments[a.id]=select.value;if(!demo)send({type:'character',id:a.id,species:select.value});render();};actions.append(select);
   const storage=button('Pokémon PC',()=>pc.open(storage));storage.setAttribute('aria-label','Open the Pokémon storage system to choose a species or form');actions.append(storage);}
  details.append(actions);
 }else{details.append(node('span','✦','dialogue-star'),node('div','Select a teammate to see its activity.','dialogue-body'));}
 sidebar.replaceChildren();
 app.querySelectorAll('[data-tab]').forEach(el=>el.setAttribute('aria-pressed',String(el.getAttribute('data-tab')===tab)));
 if(tab==='team'){
  sidebar.append(node('div','EXPLORATION TEAM','section-label'));
  if(!team.length)sidebar.append(node('p','Connected sessions will appear here.','muted'));
  const rank=(a:Agent)=>({approval:0,input:1,error:2,none:3}[a.attention]);
  for(const member of [...team].sort((a,b)=>rank(a)-rank(b))){
   const sp=species(member);
   const row=button('',()=>{selectedByUser=true;selected=member.id;area=placement.page(member.id);render();},'team-row');
   row.dataset.focusKey='team:'+member.id;
   row.setAttribute('aria-pressed',String(selected===member.id));
   if(sp){const portrait=document.createElement('img');portrait.src=boot.assetBase+sp.portrait;portrait.alt='';row.append(portrait);}
   const text=node('div','','team-text');text.append(node('strong',sp?.name||label(member)),node('span',label(member)+(links[member.id]?' · linked terminal':''),'provider'),node('span',displayStatus(member),'state'));row.append(text);
   if(member.attention!=='none')row.append(node('span',member.attention==='input'?'?':'!','attention'));
   sidebar.append(row);
  }
  if(candidates.length)sidebar.append(button(candidates.length+' sessions available to attach',()=>{tab='connections';render();},'attach-summary'));
  if(pack){const storage=button('Browse the Pokémon PC',()=>pc.open(storage),'attach-summary');sidebar.append(storage);}
 }else if(tab==='activity'){
  sidebar.append(node('div','GUILD JOURNAL','section-label'));
  if(!a)sidebar.append(node('p','Select a teammate to see its observed activity.','muted'));
  else{
   sidebar.append(node('h3',label(a)+' · '+(species(a)?.name||'Session')),node('p',displayStatus(a),'activity-status'));
   const sourceSelect=document.createElement('select');sourceSelect.setAttribute('aria-label','Activity source');sourceSelect.dataset.focusKey='activity-source';
   for(const member of team){const option=document.createElement('option');option.value=member.id;option.textContent=label(member)+' · '+(species(member)?.name||'Session');sourceSelect.append(option);}
   sourceSelect.value=a.id;sourceSelect.onchange=()=>{selectedByUser=true;selected=sourceSelect.value;area=placement.page(selected);render();};sidebar.append(sourceSelect);
   if(a.provider==='terminal')sidebar.append(node('p','Showing terminal events. Choose Codex or Claude above for chat activity.','muted'));
   const frozen=quiet||reduced.matches||a.attention!=='none'||['Status unconfirmed','Observation unavailable','Observation paused'].includes(displayStatus(a));
   const motion=a.ended?'Left the clearing':frozen?'Movement paused':['working','editing','running'].includes(a.activity)?'Training and exploration circuit':a.activity==='idle'?'Resting':'Patrolling the clearing';
   sidebar.append(node('p',motion+' · '+Object.keys(a.tools).length+' active tools','muted'));
   if(a.parent)sidebar.append(node('p','Child of '+a.parent.slice(-6),'muted'));
   sidebar.append(node('p',demo?'Simulated activity for this demo.':'Observed events only. Chat text and commands are not retained.','muted'));
   const entries=(demo?demoJournal.snapshot():journal)[a.id]||[];
   if(!entries.length)sidebar.append(node('p','No activity recorded yet.','muted'));
   const list=document.createElement('ol');list.className='journal';list.setAttribute('aria-label','Recent session activity');
   for(const entry of [...entries].reverse()){
    const row=node('li','','journal-entry'),time=document.createElement('time');time.dateTime=new Date(entry.at).toISOString();time.textContent=new Date(entry.at).toLocaleTimeString();time.title=new Date(entry.at).toLocaleString();
    row.append(node('strong',journalText(entry,a.provider)),time,node('span',entry.source==='transcript'?'Local transcript':entry.source==='hook'?'Observer hook':'Shell integration','journal-source'));list.append(row);
   }
   sidebar.append(list);
  }
  const recent=agents.filter(a=>a.attached&&a.ended).sort((a,b)=>b.lastSeen-a.lastSeen).slice(0,8);
  if(recent.length){sidebar.append(node('h3','Recently closed'));for(const ended of recent)sidebar.append(button(label(ended)+' · '+ended.id.slice(-6),()=>{selected=ended.id;render();},'recent-session'));}
 }else if(tab==='connections'){
  sidebar.append(node('div','PROVIDER CONNECTIONS','section-label'));
  sidebar.append(node('h3','Keep your own chats'),node('p','Supported local chats are discovered continuously. Workspace auto mode brings them into the guild without scanning or adding each one.','muted'));
  const spawn=button(autoAttach?'Auto-attach: on':'Auto-attach: off',()=>send({type:'autoAttach',enabled:!autoAttach}));spawn.setAttribute('aria-pressed',String(autoAttach));sidebar.append(spawn);
  sidebar.append(node('p',autoAttach?'Every discovered session spawns a Pokémon as it appears, whatever its source. This is a convenience, not proof of which window owns a chat; it pauses while another guild window shares these folders.':'Only window-bound terminals and hooks, workspace chats and sessions you attach join the guild.','muted'));
  const auto=button(autoConnect?'Workspace auto-connect: on':'Workspace auto-connect: off',()=>send({type:'autoConnect',enabled:!autoConnect}));auto.setAttribute('aria-pressed',String(autoConnect));sidebar.append(auto);
  sidebar.append(node('p',workspaces?.length?'Workspace: '+workspaces.join(', '):'No workspace folder open','muted'));
  sidebar.append(button('Add project folder',()=>send({type:'addWorkspaceFolder'})));
  sidebar.append(node('p',autoState==='ambiguous'?'Another guild window shares these folders. Automatic attachment is paused for overlapping folders; choose the intended sessions below.':autoState==='unavailable'?'Checking which guild windows share this workspace…':autoConnect?'Workspace chats reconnect automatically. This includes matching local chats, not verified native-window ownership. Removed sessions stay excluded.':'Automatic attachment is off. Window-bound terminals and hooks still connect automatically.','muted'));
  sidebar.append(node('p','Observer hooks are optional for local transcript observation. Install once for richer lifecycle signals.','muted'));
  for(const provider of ['codex','claude'])sidebar.append(button('Connect '+(provider==='codex'?'Codex':'Claude'),()=>send({type:'setup',provider}),'primary'));
  if(hookSetup){
   const card=node('section','','candidate hook-setup');card.setAttribute('aria-label','Hook installation');
   card.append(node('h3',(hookSetup.remove?'Remove':'Install')+' '+hookSetup.provider+' observer'),node('p','Settings file: '+hookSetup.file,'hook-path'),node('p','PMD Agents writes the settings for you. Existing settings are preserved and backed up when changed. No copying or saving JSON is needed.','muted'));
   const review=document.createElement('details');review.open=reviewOpen;review.ontoggle=()=>{reviewOpen=review.open;};review.append(node('summary','Review observer entries'),node('pre',hookSetup.preview));card.append(review);
   const plan=hookSetup;
   const install=button(plan.installing?'Installing…':plan.remove?'Remove hooks':'Install hooks',()=>{send({type:'installHooks',id:plan.id});plan.installing=true;render();},'primary');install.disabled=!!plan.installing;card.append(install);
   if(!hookSetup.installing)card.append(button('Cancel',()=>{send({type:'cancelHooks'});hookSetup=undefined;render();}));sidebar.append(card);
  }
  if(hookResult){const receipt=node('div','','candidate');receipt.setAttribute('role','status');receipt.append(node('h3',hookResult.error?'Setup needs attention':hookResult.remove?'Observer removed':'Observer installed'),node('p',hookResult.error||(hookResult.remove?'Other provider settings were preserved.':hookResult.provider==='codex'?'Trust the new observer in Codex’s hooks controls, then start a new turn. PMD Agents cannot grant that trust for you.':'Start a new Claude Code session to load the observer.')));sidebar.append(receipt);}
  sidebar.append(node('p','Hooks provide stronger lifecycle and approval signals. Codex hooks must be trusted in Codex. PMD Agents never answers approval prompts.','muted'));
  for(const c of boot.clients||[])sidebar.append(node('p',(c.id==='openai.chatgpt'?'Codex':'Claude Code')+' · '+c.version,'client-version'));
  if(!demo){
   sidebar.append(node('h3','Local observation'));
   sidebar.append(node('p',observationEnabled===false?'Local chat observation is disabled in settings.':diagnostics?diagnostics.files+' chat files watched · '+diagnostics.unsupported+' unsupported · '+diagnostics.readErrors+' read errors':'Waiting for local discovery.','muted'));
   if(diagnostics?.outsideWorkspace)sidebar.append(node('p',diagnostics.outsideWorkspace+' recent chat files outside this workspace. Add their project folder to observe them here.','muted'));
   if(diagnostics?.historyFolders)sidebar.append(node('p','Older Codex folders checked: '+diagnostics.historyChecked+' / '+diagnostics.historyFolders+(diagnostics.historyCapped?' · history scan capped':''),'client-version'));
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
  sidebar.append(node('p','Sessions normally connect automatically. Each card explains what is preventing connection.','muted'));
  if(!candidates.length)sidebar.append(node('p','No unassigned events received yet.','muted'));
  for(const c of candidates){const card=node('div','','candidate');card.append(node('strong',label(c)+' · '+c.id.slice(-6)),node('p',displayStatus(c)+' · '+new Date(c.lastSeen).toLocaleTimeString()),node('p',sourceLabel(c)+(evidence[c.id]?.project?' · '+evidence[c.id].project:''),'muted'),node('p',attachmentReason({excluded:exclusions.includes(c.id),autoState,autoAttach,autoConnect,workspace:evidence[c.id]?.workspace,connection:evidence[c.id]?.connection}),'muted'),button('Attach to this window',()=>send({type:'attach',id:c.id})));sidebar.append(card);}
  sidebar.append(button('Choose asset pack',()=>send({type:'assets'})));
 }else{
  sidebar.append(node('div','CREDITS & SOURCES','section-label'),node('h3','A PMD fan project'));
  sidebar.append(node('p','Unaffiliated with Nintendo, Creatures Inc., GAME FREAK, The Pokémon Company or Spike Chunsoft. Pokémon and game artwork belong to their respective owners.','muted'));
  sidebar.append(node('p','Inspired by Pixel Agents — Pablo De Lucca and contributors. Built by Kevan Wee.','muted'));
  const link=document.createElement('a');link.href='https://github.com/pixel-agents-hq/pixel-agents';link.textContent='Pixel Agents';sidebar.append(link);
  for(const s of [...(pack?.sprites||[]),...(pack?.dummy?[pack.dummy]:[])])sidebar.append(node('h3',s.name),node('p',[...s.artists,...(s.portraitCredits||[])].join(' · '),'credit-text'));
  sidebar.append(node('p','SpriteCollab: individual asset terms are preserved in the local pack. Original game sprites are not automatically covered by the fan-art licence.','muted'));
  for(const map of pack?.maps||[]){sidebar.append(node('h3',map.name),node('p',map.credit,'muted'));for(const layer of map.layers||[])sidebar.append(node('p',layer.credit,'muted'));}
  sidebar.append(node('p','Scenery uses native Red Rescue Team palette frames and timings. Map geometry is authored for this project, not extracted game collision data.','muted'),node('p','Pixelify Sans Project Authors · SIL OFL. Substitute: SpriteCollab source credits above. Move particles: original decorative effects.','muted'));
  sidebar.append(node('h3','Storage system'),node('p','Box icons come from the Smogon / Pokémon Showdown sprite repository (pinned): Gen 6/7 menu sprites, with Generation VIII and IX icons drawn by the Smogon community in the same style. Front and shiny sprites come from the PokeAPI sprites repository (pinned), whose later-generation fronts are the Smogon Sprite Project’s Gen 5-style sprites. All artwork depicts Nintendo, Creatures Inc. and GAME FREAK characters and is kept only in your local pack. Types come from PokeAPI data (BSD-3-Clause). The storage frames, wallpaper and menus are original CSS.','muted'));
 }
 const live=team.filter(a=>a.attention!=='none').length;
 app.querySelector('#live-status')!.textContent=live?live+' session'+(live===1?'':'s')+' need attention':'';
 sidebar.scrollTop=scrollTop;
 if(focusKey)app.querySelector<HTMLElement>('[data-focus-key="'+CSS.escape(focusKey)+'"]')?.focus({preventScroll:true});
 draw(0);
}
function dummy(p:Point,hit:boolean,elapsed:number) {
 if(pack?.dummy){const anim=pack.dummy.animations[hit?'Hurt':'Idle'],row=anim.rows===1?0:6,f=frameAt(anim,elapsed),sheet=img(anim.file),anchor=anim.anchors[row][f];if(sheet)ctx.drawImage(sheet,f*anim.w,row*anim.h,anim.w,anim.h,Math.round(p.x-anchor[0]),Math.round(p.y-anchor[1]),anim.w,anim.h);return;}

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
 const map=scene()!,bg=img(map.file);
 const scale=Math.min(w/map.width,h/map.height)*zoom;
 pan.x=Math.max(-Math.max(0,(map.width*scale-w)/2),Math.min(Math.max(0,(map.width*scale-w)/2),pan.x));
 pan.y=Math.max(-Math.max(0,(map.height*scale-h)/2),Math.min(Math.max(0,(map.height*scale-h)/2),pan.y));
 const ox=Math.round((w-map.width*scale)/2+pan.x),oy=Math.round((h-map.height*scale)/2+pan.y);view={x:ox,y:oy,scale};
 ctx.translate(ox,oy);ctx.scale(scale,scale);ctx.imageSmoothingEnabled=false;
 if(bg)ctx.drawImage(bg,0,0);
 if(!quiet&&!reduced.matches)worldTime+=delta;
 const environmentFrames=[];
 for(const layer of map.layers||[]){const sheet=img(layer.file),f=layer.durations?frameAt({...layer,durations:layer.durations,rows:1,anchors:[],hit:0},worldTime):Math.floor(worldTime/layer.frameMs!)%layer.frames;environmentFrames.push(f);if(sheet)ctx.drawImage(sheet,f*layer.w,0,layer.w,layer.h,layer.x,layer.y,layer.w,layer.h);}
 if(showPaths){ctx.fillStyle='#70dab72b';ctx.strokeStyle='#70dab7';for(const [index,polygon] of [...(terrain().zones??[terrain().ground]),...terrain().obstacles].entries()){ctx.beginPath();polygon.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=index>=(terrain().zones?.length??1)?'#e86c664d':'#70dab72b';ctx.fill();ctx.stroke();}}
 canvas.dataset.map=map.id;canvas.dataset.environment=JSON.stringify(environmentFrames);canvas.dataset.worldTime=String(worldTime);
 const list=inClearing();
 const now=Date.now(),still=quiet||reduced.matches;
 for(const a of list){
  const actor=actors.get(a.id)!;
  const sp=species(a);if(!sp)continue;
  actor.elapsed+=still?0:delta;
  const uncertain=['Status unconfirmed','Observation unavailable','Observation paused'].includes(displayStatus(a)),attention=a.attention!=='none'||uncertain;
  const training=['working','editing','running'].includes(a.activity),home=terrain().stations[actor.slot%6];
  const exploring=training&&(actor.elapsed+actor.slot*1100)%24000>15000;
  const roaming=a.activity==='reading'||exploring||a.activity==='idle'&&now-a.lastSeen<45000;
  const mode=attention?'attention':roaming?'roam':training?'train':'rest';
  if(mode!==actor.mode){actor.path=[];actor.mode=mode;actor.rest=0;if(mode==='train')actor.path=navigator().route(actor.p,home);}
  actor.walking=false;
  if(!still&&!attention){
   if(mode==='roam'&&!actor.path.length){actor.rest+=delta;if(actor.rest>700){actor.path=navigator().wander(actor.p,++actor.trip,[...actors.values()].filter(v=>v!==actor).map(v=>v.p));actor.rest=0;}}
   if(actor.path.length){
    const target=actor.path[0],dist=Math.hypot(target.x-actor.p.x,target.y-actor.p.y),step=Math.min(dist,delta*.032);
    if(dist<.1){actor.path.shift();}else{
     actor.direction=facing(actor.p,target);const next={x:actor.p.x+(target.x-actor.p.x)*step/dist,y:actor.p.y+(target.y-actor.p.y)*step/dist};
     if(segment(actor.p,next,terrain())){actor.p=next;actor.walking=true;if(step===dist)actor.path.shift();}else actor.path=[];
    }
   }else actor.direction=training?2:actor.direction;
  }
  if(attention)actor.direction=0;
  if(showPaths&&actor.path.length){ctx.strokeStyle='#fff0a8aa';ctx.beginPath();ctx.moveTo(actor.p.x,actor.p.y);for(const p of actor.path)ctx.lineTo(p.x,p.y);ctx.stroke();}
 }

 const trainingFrames:unknown[]=[];
 for(const a of [...list].sort((a,b)=>actors.get(a.id)!.p.y-actors.get(b.id)!.p.y)){
  const actor=actors.get(a.id)!,sp=species(a);if(!sp)continue;
  const uncertain=['Status unconfirmed','Observation unavailable','Observation paused'].includes(displayStatus(a)),attention=a.attention!=='none'||uncertain;
  const training=['working','editing','running'].includes(a.activity);
  const home=terrain().stations[actor.slot%6],atHome=Math.hypot(actor.p.x-home.x,actor.p.y-home.y)<=1;
  const active=training&&!attention&&!still&&atHome&&actor.mode==='train';
  if(!active)actor.trainingElapsed=0;
  const motion=trainingAt(sp,actor.trainingElapsed);
  if(active)actor.trainingElapsed+=delta;
  const attacking=active&&motion.attacking;
  const walking=!still&&!attention&&actor.walking;
  const action=attacking?motion.action:walking?'Walk':a.activity==='idle'&&!attention&&now-a.lastSeen>30000?'Sleep':'Idle';
  if(active)actor.direction=2;
  const anim=sp.animations[action],f=still?0:frameAt(anim,attacking?motion.cycle:actor.elapsed),row=anim.rows===1?0:actor.direction;
  const sheet=img(anim.file),target={x:home.x+29,y:home.y};
  if(training)dummy(target,active&&motion.hit,active?motion.hit?motion.hurtTime:actor.elapsed:0);
  trainingFrames.push({id:a.id,action,frame:f,hit:active&&motion.hit,projectile:active?motion.projectile:undefined});
  const x=Math.round(actor.p.x),y=Math.round(actor.p.y);
  if(a.id===selected){ctx.strokeStyle='#fff2a8';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y+1,12,4,0,0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle='#17252355';ctx.beginPath();ctx.ellipse(x,y,7,2,0,0,Math.PI*2);ctx.fill();
  if(sheet){const anchor=anim.anchors[row][f];ctx.drawImage(sheet,f*anim.w,row*anim.h,anim.w,anim.h,x-anchor[0],y-anchor[1],anim.w,anim.h);}
  if(active&&(motion.hit||motion.projectile!==undefined)){
   const color=MOVE_COLORS[sp.element||'normal']||MOVE_COLORS.normal;
   if(motion.projectile!==undefined){const anchor=anim.anchors[row][f],head=anim.heads?.[row]?.[f]||anchor;const from={x:x-anchor[0]+head[0],y:y-anchor[1]+head[1]},t=motion.projectile;const px=Math.round(from.x+(target.x-from.x)*t),py=Math.round(from.y+(target.y-12-from.y)*t);ctx.fillStyle=color[0];ctx.fillRect(px-3,py-3,7,5);ctx.fillStyle=color[1];ctx.fillRect(px,py-2,3,3);}
   if(motion.hit){const spread=5+Math.floor(motion.hurtTime/35);ctx.fillStyle=color[0];for(let n=0;n<6;n++){const angle=n*Math.PI/3;ctx.fillRect(Math.round(target.x+Math.cos(angle)*spread),Math.round(target.y-12+Math.sin(angle)*spread),2,3);}ctx.fillStyle=color[1];ctx.fillRect(target.x-2,target.y-14,4,4);}
  }
  if(attention){
   ctx.fillStyle='#f7e8b6';ctx.fillRect(x-6,y-38,13,14);ctx.fillRect(x-2,y-24,4,3);
   ctx.fillStyle='#432e24';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText(uncertain?'…':a.attention==='input'?'?':'!',x+1,y-27);
  }
 }
 canvas.dataset.training=JSON.stringify(trainingFrames);
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
app.querySelector('#quiet')!.addEventListener('click',()=>{quiet=!quiet;send({type:'quiet',quiet});host?.setState({...host.getState(),quiet,scene:scene()?.id});render();restart();});
app.querySelector('#scene')!.addEventListener('change',()=>{sceneId=(app.querySelector('#scene') as HTMLSelectElement).value;actors.clear();pan={x:0,y:0};worldTime=0;host?.setState({...host.getState(),quiet,scene:sceneId});send({type:'scene',id:sceneId});render();});
app.querySelector('#zoom')!.addEventListener('click',()=>{zoom=zoom===1?1.75:1;pan={x:0,y:0};render();});
app.querySelector('#paths')!.addEventListener('click',()=>{showPaths=!showPaths;render();});
app.querySelector('#area')!.addEventListener('click',()=>{const pages=placement.pages();area=pages[(pages.indexOf(area)+1)%Math.max(1,pages.length)]??0;render();});
app.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>{tab=el.getAttribute('data-tab') as typeof tab;render();}));
app.querySelector('#credits')!.addEventListener('click',()=>{tab='credits';render();});
let saved:Agent[]=[];let demoTimer:ReturnType<typeof setInterval>|undefined;
let demoStore=new GuildStore();let demoTurn=0;
let demoJournal=new ActivityJournal();
function demoStep(){
 const id='demo-codex',turn='turn-'+(++demoTurn);
 const emit=(session:string,kind:Event['kind'],extra:Partial<Event>={})=>{const e:Event={v:1,id:crypto.randomUUID(),session,provider:session===id?'codex':'claude',at:Date.now(),kind,...extra};if(demoStore.apply(e,true))demoJournal.record(e,'hook');};
 emit(id,'turn',{turn});emit(id,'tool-start',{turn,tool:'edit',activity:'editing'});
 emit('demo-claude','turn');emit('demo-claude','tool-start',{tool:'read-'+demoTurn,activity:'reading'});
 emit('demo-review','turn');emit('demo-review','approval');
 agents=demoStore.snapshot();render();
}
app.querySelector('#demo')!.addEventListener('click',()=>{
 demo=!demo;selectedByUser=false;area=0;actors.clear();placement.clear();
 if(demo){saved=agents;demoStore=new GuildStore();demoJournal=new ActivityJournal();Object.assign(assignments,{'demo-codex':'eevee','demo-claude':'riolu','demo-review':'ceruledge'});demoStep();demoTimer=setInterval(()=>{
  const a=demoStore.agents.get('demo-review')!,e:Event={v:1,id:crypto.randomUUID(),session:a.id,provider:a.provider,kind:a.attention==='approval'?'input':'approval',at:Date.now()};
  if(demoStore.apply(e,true))demoJournal.record(e,'hook');agents=demoStore.snapshot();render();
 },8000);}else{clearInterval(demoTimer);agents=saved;render();send({type:'ready'});}
});
window.addEventListener('message',event=>{
 const m=event.data;
 if(m.type==='hookSetup'){hookSetup=m;hookResult=undefined;tab='connections';render();}
 if(m.type==='hookResult'){hookSetup=undefined;hookResult=m;tab='connections';render();}
 if(m.type==='snapshot'){const motionChanged=(typeof m.quiet==='boolean'&&m.quiet!==quiet)||(m.scene&&m.scene!==sceneId);if(typeof m.quiet==='boolean')quiet=m.quiet;if(m.scene&&m.scene!==sceneId){sceneId=m.scene;actors.clear();pan={x:0,y:0};worldTime=0;}if(motionChanged)restart();workspaces=m.workspaces??workspaces;autoConnect=m.autoConnect??autoConnect;autoAttach=m.autoAttach??autoAttach;autoState=m.autoState;exclusions=m.exclusions||[];membership=m.membership||{};journal=m.journal||{};links=m.links||{};diagnostics=m.diagnostics;observationEnabled=m.observationEnabled;evidence=m.evidence||{};if(demo){saved=m.agents;return;}agents=m.agents;assignments=m.assignments||{};terminalNames=m.terminalNames||{};render();}
 if(m.type==='visibility'){visible=m.visible;restart();}
 if(m.type==='dex')pc.setDex(m);
 if(m.type==='dexPortraits')pc.portraitsReady(m);
 if(m.type==='gameTypes')pc.setTypes(m);
 if(m.type==='gameAssets')pc.gameReady(m);
 if(m.type==='gameImport')pc.gameProgress(m);
 if(m.type==='dexImport'){if(m.species&&pack&&!pack.sprites.some(s=>s.id===m.species.id))pack.sprites.push(m.species);pc.imported(m);}
});
let drag:{x:number;y:number;px:number;py:number}|undefined,moved=false;
canvas.addEventListener('pointerdown',e=>{if(zoom>1){drag={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};moved=false;canvas.setPointerCapture(e.pointerId);}});
canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>3)moved=true;pan={x:drag.px+dx*devicePixelRatio,y:drag.py+dy*devicePixelRatio};draw(0);});
canvas.addEventListener('pointerup',()=>{drag=undefined;});canvas.addEventListener('pointercancel',()=>{drag=undefined;});
canvas.addEventListener('click',event=>{
 if(moved){moved=false;return;}
 const rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;
 const x=((event.clientX-rect.left)*dpr-view.x)/view.scale,y=((event.clientY-rect.top)*dpr-view.y)/view.scale;
 const hit=inClearing().find(a=>{const p=actors.get(a.id)!.p;return Math.abs(p.x-x)<16&&y<p.y+5&&y>p.y-45;});
 if(hit&&compact){send({type:'openGuild'});return;}
 if(hit){selectedByUser=true;selected=hit.id;render();}
});
render();restart();send({type:'ready'});
// Update freshness labels without advancing simulation or inventing completions.
setInterval(()=>{if(visible&&!document.hidden)render();},15000);
