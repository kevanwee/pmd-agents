import {boxOf,findSpecies,portraitPath,BOX_SIZE,type Dex,type DexSpecies,type DexForm} from '../dex';
import type {Pack,Species} from '../world';
/** The guild's storage system: every species in National Dex order, thirty to a box, with forms and credits behind a menu.
 *  Two views share one cursor: the game view (main-series front sprites and box icons, the primary) and the guild view
 *  (SpriteCollab portraits). Portraits, sprites and imports arrive from the host; nothing is drawn from guesses. */
export interface PcHost {
 send:(msg:unknown)=>void;assetBase:string;pack:()=>Pack|undefined;
 session:()=>{id:string;label:string;species?:string}|undefined;sessions:()=>{id:string;label:string;species?:string}[];select:(id:string)=>void;
 choose:(id:string,sessionId:string)=>void;favorites:()=>string[];setFavorites:(ids:string[])=>void;recall:()=>{view?:string}|undefined;remember:(state:{view:string})=>void;
}
const SOURCE='https://github.com/PMDCollab/SpriteCollab/tree/';
const pad=(n:number)=>String(n).padStart(4,'0');
const el=(tag:string,className='',text='')=>{const n=document.createElement(tag);if(className)n.className=className;if(text)n.textContent=text;return n;};
const image=(src:string,alt:string,className:string)=>{const img=document.createElement('img');img.src=src;img.alt=alt;img.className=className;img.draggable=false;return img;};
type AssetState=string|'pending'|'failed';
export class PokemonPc {
 private root:HTMLElement;private body:HTMLElement;private title:HTMLElement;private search:HTMLInputElement;private viewButton:HTMLButtonElement;
 private dex?:Dex;private error?:string;private requested=false;
 private view:'game'|'guild'='game';private box=0;private cursor=0;private menu:'none'|'main'|'forms'|'summary'='none';private party=false;private favs=false;private shiny=false;
 private portraits=new Map<string,AssetState>();private game=new Map<string,AssetState>();private types?:Record<string,string[]>;private typesRequested=false;
 private importing?:string;private importTarget?:{id:string;label:string};private note='';private opener?:HTMLElement;private progress?:{done:number;total:number;failed?:number;complete?:boolean};
 constructor(parent:HTMLElement,private host:PcHost){
  this.view=host.recall()?.view==='guild'?'guild':'game';
  this.root=el('section','pc');this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.setAttribute('aria-label','Pokémon storage');this.root.hidden=true;
  const frame=el('div','pc-frame'),head=el('header','pc-head');
  const heading=el('div');heading.append(el('span','eyebrow','POKÉMON STORAGE SYSTEM'));this.title=el('h2','','Box 1');heading.append(this.title);
  const form=el('form','pc-search');form.setAttribute('role','search');this.search=document.createElement('input');this.search.type='search';this.search.placeholder='Name or #number';this.search.setAttribute('aria-label','Find a Pokémon by name or number');
  const find=el('button','','Find');(find as HTMLButtonElement).type='submit';form.append(this.search,find);
  form.onsubmit=e=>{e.preventDefault();this.find(this.search.value);};
  this.viewButton=document.createElement('button');this.viewButton.className='pc-view';this.viewButton.onclick=()=>{this.view=this.view==='game'?'guild':'game';this.host.remember({view:this.view});this.party=false;this.render();this.focusCursor();};
  const close=el('button','pc-close','Close');close.setAttribute('aria-label','Close storage');close.onclick=()=>this.close();
  head.append(heading,form,this.viewButton,close);
  this.body=el('div','pc-body');
  const foot=el('footer','pc-foot','Box icons come from Smogon\'s sprite repository and front sprites and types from PokeAPI\'s, all pinned; PMD portraits and chosen sheets from PMD SpriteCollab\'s pinned revision. Everything lands in your local pack with receipts. Nothing is bundled or uploaded.');
  frame.append(head,this.body,foot);this.root.append(frame);parent.append(this.root);
  this.root.addEventListener('keydown',e=>this.key(e));
  this.root.addEventListener('click',e=>{if(e.target===this.root)this.close();});
 }
 isOpen(){return !this.root.hidden;}
 open(from?:HTMLElement){
  this.opener=from;this.root.hidden=false;this.note='';this.party=false;this.favs=false;this.shiny=false;
  if(!this.dex&&!this.requested){this.requested=true;this.host.send({type:'dex'});}
  if(!this.types&&!this.typesRequested){this.typesRequested=true;this.host.send({type:'gameTypes'});}
  const current=this.host.session()?.species,pack=this.host.pack();
  const assigned=pack?.sprites.find(s=>s.id===current);
  if(assigned?.dex&&this.dex){const index=this.dex.species.findIndex(s=>s.dex===assigned.dex);if(index>=0){this.box=Math.floor(index/BOX_SIZE);this.cursor=index%BOX_SIZE;}}
  this.menu='none';this.render();this.focusCursor();
 }
 close(){this.root.hidden=true;this.menu='none';this.party=false;this.favs=false;this.opener?.focus();}
 favoritesChanged(){if(this.isOpen())this.render();}
 /** Favourites spawn first, top to bottom; the host imports any that are not in the pack yet. */
 private setFavorites(ids:string[],note:string){this.host.setFavorites(ids);this.note=note;this.render();}
 private toggleFavorite(species:DexSpecies,form:DexForm){
  const ids=this.host.favorites(),name=species.name+(form.label==='Normal'?'':' ('+form.label+')');
  if(ids.includes(form.id))this.setFavorites(ids.filter(id=>id!==form.id),name+' left your favorites.');
  else if(!form.ready&&!this.host.pack()?.sprites.some(s=>s.id===form.id)){this.note=name+' has no complete sheets yet, so it cannot spawn.';this.render();}
  else this.setFavorites([...ids,form.id],name+' is favorite #'+(ids.length+1)+'.');
 }
 private favoriteName(id:string){
  const species=this.dex?.species.find(s=>s.forms.some(f=>f.id===id)),form=species?.forms.find(f=>f.id===id);
  return {species,form,name:species?species.name+(form&&form.label!=='Normal'?' ('+form.label+')':''):id};
 }
 setDex(m:{dex?:Dex;error?:string}){this.dex=m.dex;this.error=m.error;this.requested=!!m.dex;if(this.isOpen()){if(m.dex)this.open(this.opener);else this.render();}}
 setTypes(m:{types?:Record<string,string[]>;error?:string}){this.types=m.types;this.typesRequested=!!m.types;if(m.error)this.note=m.error;if(this.isOpen())this.render();}
 portraitsReady(m:{ready?:Record<string,string>;failed?:string[];error?:string}){
  if(m.error)this.note=m.error;
  for(const [path,file] of Object.entries(m.ready||{}))this.portraits.set(path,file);
  for(const path of m.failed||[])this.portraits.set(path,'failed');
  if(this.isOpen())this.render();
 }
 gameReady(m:{ready?:Record<string,string>;failed?:string[];error?:string}){
  if(m.error)this.note=m.error;
  for(const [key,file] of Object.entries(m.ready||{}))this.game.set(key,file);
  for(const key of m.failed||[])this.game.set(key,'failed');
  if(this.isOpen())this.render();
 }
 gameProgress(m:{done:number;total:number;failed?:number;complete?:boolean;error?:string}){
  if(m.error)this.note=m.error;
  this.progress=m;if(m.complete&&!m.error)for(const [key,state] of this.game)if(state==='failed'||state==='pending')this.game.delete(key);
  if(this.isOpen())this.render();
 }
 imported(m:{path:string;id:string;species?:Species;error?:string}){
  if(this.importing!==m.id)return;this.importing=undefined;const target=this.importTarget;this.importTarget=undefined;
  if(m.species&&target){
   if(!this.host.sessions().some(s=>s.id===target.id)){this.note='Imported to the roster. The original teammate is no longer connected.';if(this.isOpen())this.render();return;}
   this.chosen(target.label,m.id,target.id);return;
  }
  this.note=m.error||'Import failed.';if(this.isOpen())this.render();
 }
 /** While the Guild team panel is open the storage stays open, so the whole team can be dressed in one visit. */
 private chosen(label:string,id:string,sessionId:string){
  this.host.choose(id,sessionId);this.menu='none';
  if(!this.party){this.note='';this.close();return;}
  const name=this.host.pack()?.sprites.find(s=>s.id===id)?.name||id;this.note=label+' now has '+name+'.';this.render();this.focusCursor();
 }
 private find(query:string){
  if(!this.dex)return;const hit=findSpecies(this.dex,query);
  if(!hit){this.note='No Pokémon matches "'+query+'".';this.render();return;}
  const index=this.dex.species.indexOf(hit);this.box=Math.floor(index/BOX_SIZE);this.cursor=index%BOX_SIZE;this.menu='none';this.party=false;this.note='';this.render();this.focusCursor();
 }
 private focusCursor(){this.body.querySelector<HTMLElement>('.pc-slot[data-index="'+this.cursor+'"]')?.focus({preventScroll:true});}
 private focusMenu(){this.body.querySelector<HTMLElement>('.pc-menu button')?.focus({preventScroll:true});}
 private move(delta:number,boxes=0){
  if(!this.dex)return;const page=boxOf(this.dex,this.box+boxes);
  if(boxes){this.box=page.index;this.cursor=Math.min(this.cursor,page.species.length-1);}
  else this.cursor=Math.max(0,Math.min(page.species.length-1,this.cursor+delta));
  this.menu='none';this.shiny=false;this.render();this.focusCursor();
 }
 private key(e:KeyboardEvent){
  // Escape steps back one level, like B in the games: submenu → menu → box → closed.
  if(e.key==='Escape'){e.preventDefault();
   if(this.menu==='forms'||this.menu==='summary'){this.menu='main';this.shiny=false;this.render();this.focusMenu();}
   else if(this.menu==='main'){this.menu='none';this.render();this.focusCursor();}
   else if(this.party||this.favs){this.party=false;this.favs=false;this.render();this.focusCursor();}else this.close();return;}
  if(e.target instanceof HTMLInputElement)return;
  const keys:Record<string,()=>void>={ArrowLeft:()=>this.move(-1),ArrowRight:()=>this.move(1),ArrowUp:()=>this.move(-6),ArrowDown:()=>this.move(6),PageUp:()=>this.move(0,-1),PageDown:()=>this.move(0,1),Home:()=>this.move(-BOX_SIZE),End:()=>this.move(BOX_SIZE)};
  if(keys[e.key]){e.preventDefault();keys[e.key]();}
 }
 /** The portrait file for a species' nearest drawn portrait: the pack's own copy when the form is imported, otherwise a fetched box portrait. */
 private portraitFor(species:DexSpecies,form:DexForm):string|undefined{
  const imported=this.host.pack()?.sprites.find(s=>s.id===form.id);if(imported)return imported.portrait;
  const path=portraitPath(species,form.path);if(!path)return undefined;
  const state=this.portraits.get(path);return state&&state!=='pending'&&state!=='failed'?state:undefined;
 }
 private asset(kind:'icon'|'front'|'shiny',dex:number){const state=this.game.get(kind+':'+pad(dex));return state&&state!=='pending'&&state!=='failed'?state:undefined;}
 /** Ask the host for the game sprites of species whose state is unknown, at most one request per render. */
 private requestGame(dexes:number[]){
  const wanted=dexes.filter(dex=>!this.game.has('front:'+pad(dex)));
  for(const dex of wanted){this.game.set('front:'+pad(dex),'pending');this.game.set('shiny:'+pad(dex),'pending');this.game.set('icon:'+pad(dex),'pending');}
  if(wanted.length)this.host.send({type:'gameAssets',dexes:wanted.slice(0,40)});
 }
 private status(form:DexForm){const pack=this.host.pack();return pack?.sprites.some(s=>s.id===form.id)?'In roster':form.ready?'Ready':form.portrait?'Portrait only':'Not drawn yet';}
 private choose(species:DexSpecies,form:DexForm){
  const session=this.host.session();if(!session){this.note='Select a teammate in the guild first (Guild team), then choose its Pokémon here.';this.render();return;}
  if(this.importing)return;
  if(this.host.pack()?.sprites.some(s=>s.id===form.id)){this.chosen(session.label,form.id,session.id);return;}
  if(!form.ready){this.note=species.name+' ('+form.label+') has no complete Idle, Walk, Attack and Sleep sheets yet.';this.render();return;}
  this.importing=form.id;this.importTarget={id:session.id,label:session.label};this.note='';this.host.send({type:'dexImport',path:form.path,id:form.id});this.render();
 }
 /** The PMD-style menu for the species under the cursor; the same element serves both views. */
 private menuElement(species:DexSpecies){
  const base=species.forms[0],pack=this.host.pack(),session=this.host.session();
  const menu=el('div','pc-menu');menu.setAttribute('aria-label',species.name+' menu');
  const item=(text:string,action:()=>void,disabled=false)=>{const b=document.createElement('button');b.textContent=text;b.disabled=disabled;b.onclick=action;menu.append(b);return b;};
  const back=(to:'main'|'none')=>{this.menu=to;this.shiny=false;this.render();if(to==='main')this.focusMenu();else this.focusCursor();};
  if(this.menu==='forms'){
   for(const form of species.forms){
    const b=item(form.label+' · '+(this.importing===form.id?'Importing…':this.status(form)),()=>this.choose(species,form),!form.ready&&!pack?.sprites.some(s=>s.id===form.id));
    const isShiny=/\bShiny\b/.test(form.label);
    b.onfocus=b.onmouseenter=()=>{if(this.shiny!==isShiny){this.shiny=isShiny;this.updateFront(species);}};
    item((this.host.favorites().includes(form.id)?'★ Unfavorite ':'☆ Favorite ')+form.label,()=>this.toggleFavorite(species,form));
   }
   item('Back',()=>back('main'));
  }else if(this.menu==='summary'){
   const list=el('dl','pc-summary');const row=(k:string,v:string)=>{list.append(el('dt','',k),el('dd','',v));};
   const types=this.types?.[pad(species.dex)];
   if(types)row('Type',types.map(t=>t[0].toUpperCase()+t.slice(1)).join(' / '));
   row('Forms drawn',String(species.forms.length));row('Ready to train',String(species.forms.filter(f=>f.ready).length));row('Animations',base.actions?base.actions+' in the base set':'Not listed by the tracker');
   row('Sprite credit',base.credit||'Not recorded');row('Portrait',base.portrait?'Drawn':portraitPath(species,base.path)?'Borrowed from another form':'None yet');
   const link=document.createElement('a');link.href=SOURCE+(this.dex?.revision||'master')+'/sprite/'+base.path;link.textContent='Source on SpriteCollab';link.target='_blank';link.rel='noreferrer';
   const dd=el('dd');dd.append(link);list.append(el('dt','','Provenance'),dd);menu.append(list);
   item('Back',()=>back('main'));
  }else if(this.menu==='main'){
   const inPack=!!pack?.sprites.some(s=>s.id===base.id);
   item(this.importing===base.id?'Importing…':inPack?'Choose':base.ready?'Import & choose':'No complete sheets yet',()=>this.choose(species,base),(!inPack&&!base.ready)||!!this.importing);
   item(this.host.favorites().includes(base.id)?'★ Remove from favorites':'☆ Add to favorites',()=>this.toggleFavorite(species,base));
   item('Forms ('+species.forms.length+')',()=>{this.menu='forms';this.render();this.focusMenu();});
   item('Summary',()=>{this.menu='summary';this.render();this.focusMenu();});
   item('Back',()=>back('none'));
  }else menu.append(el('p','muted',session?'Choosing for '+session.label+'. Open a Pokémon to pick it or one of its forms.':'Browsing. Choose a teammate under Guild team to assign a Pokémon.'));
  return menu;
 }
 private updateFront(species:DexSpecies){const img=this.body.querySelector<HTMLImageElement>('.gs-front');if(!img)return;const file=this.asset(this.shiny?'shiny':'front',species.dex);if(file){img.src=this.host.assetBase+file;img.alt=species.name+(this.shiny?' (Shiny)':'');}}
 private render(){
  // Portraits, sprites and imports arrive while the user navigates; rebuilding the box must not drop keyboard focus.
  const active=document.activeElement,onSlot=!!active?.classList.contains('pc-slot'),menuIndex=active?.closest('.pc-menu')?[...this.body.querySelectorAll('.pc-menu button')].indexOf(active as Element):-1;
  const key=active instanceof HTMLElement&&this.body.contains(active)?active.dataset.key:undefined,wasInside=!!active&&this.root.contains(active);
  this.draw();
  if(onSlot)this.focusCursor();else if(menuIndex>=0)this.body.querySelectorAll<HTMLElement>('.pc-menu button')[menuIndex]?.focus({preventScroll:true});
  else if(key)this.body.querySelector<HTMLElement>('[data-key="'+CSS.escape(key)+'"]')?.focus({preventScroll:true});
  // A control that vanished or became disabled (fetching, importing) must not strand keyboard focus outside the dialog.
  if(wasInside&&!this.root.contains(document.activeElement))this.focusCursor();
 }
 private draw(){
  this.body.replaceChildren();this.body.dataset.view=this.view;
  this.viewButton.textContent=this.view==='game'?'Guild view':'Game view';this.viewButton.setAttribute('aria-label',this.view==='game'?'Switch to the guild view with PMD portraits':'Switch to the game view with main-series sprites');
  if(!this.dex){
   const empty=el('div','pc-empty');empty.append(el('h3','',this.error?'The catalog is unavailable':'Opening the storage system…'),el('p','muted',this.error||'Reading the National Dex from PMD SpriteCollab (pinned revision).'));
   if(this.error){const retry=el('button','primary','Try again');retry.onclick=()=>{this.error=undefined;this.requested=true;this.host.send({type:'dex'});this.render();};empty.append(retry);}
   this.body.append(empty);this.title.textContent='Storage';return;
  }
  const page=boxOf(this.dex,this.box);this.box=page.index;this.cursor=Math.max(0,Math.min(page.species.length-1,this.cursor));
  this.title.textContent='Box '+(page.index+1);
  if(this.view==='game')this.drawGame(page);else this.drawGuild(page);
 }
 private boxNav(page:{index:number;count:number;species:DexSpecies[]},className:string){
  const first=page.species[0]?.dex??0,last=page.species[page.species.length-1]?.dex??0;
  const nav=el('div',className);
  const prev=el('button','','◀');prev.setAttribute('aria-label','Previous box');prev.onclick=()=>this.move(0,-1);
  const next=el('button','','▶');next.setAttribute('aria-label','Next box');next.onclick=()=>this.move(0,1);
  nav.append(prev,el('span','pc-box-range','Box '+(page.index+1)+' / '+page.count+' · #'+String(first).padStart(3,'0')+'–#'+String(last).padStart(3,'0')),next);
  return nav;
 }
 private slotButton(species:DexSpecies,i:number,extra:string){
  const form=species.forms[0],pack=this.host.pack(),session=this.host.session();
  const slot=el('button','pc-slot '+extra);slot.dataset.index=String(i);slot.dataset.dex=String(species.dex);
  slot.setAttribute('aria-label','#'+String(species.dex).padStart(3,'0')+' '+species.name+' · '+this.status(form));slot.setAttribute('aria-pressed',String(i===this.cursor));
  if(pack?.sprites.some(s=>s.dex===species.dex))slot.classList.add('in-roster');
  if(session?.species&&pack?.sprites.find(s=>s.id===session.species)?.dex===species.dex)slot.classList.add('chosen');
  slot.onclick=()=>{this.cursor=i;this.menu='main';this.shiny=false;this.note='';this.render();this.focusMenu();};
  return slot;
 }
 /** The primary view: a main-series box with icons on the right, the species' front sprite and types on the left. */
 private drawGame(page:{index:number;count:number;species:DexSpecies[]}){
  const wrap=el('div','gs');const species=page.species[this.cursor];
  this.requestGame(page.species.map(s=>s.dex));
  const summary=el('aside','gs-summary');summary.setAttribute('aria-label',this.party?'Guild team':this.favs?'Favorites':'Selected Pokémon');
  if(this.favs){
   summary.append(el('h3','gs-party-title','Favorites'),el('p','muted','New teammates spawn as the first favorite nobody is using, top to bottom; past the list they spawn at random. Add from any Pokémon’s menu.'));
   const ids=this.host.favorites();if(!ids.length)summary.append(el('p','muted','No favorites yet.'));
   const list=el('ol','gs-favs');
   ids.forEach((id,i)=>{
    const {species,name}=this.favoriteName(id),inPack=!!this.host.pack()?.sprites.some(s=>s.id===id);
    const li=el('li','gs-fav');li.dataset.fav=id;
    const icon=species?this.asset('icon',species.dex):undefined;if(icon)li.append(image(this.host.assetBase+icon,'','gs-party-icon'));else li.append(el('span','gs-party-icon'));
    li.append(el('span','gs-party-text',(i+1)+'. '+name+(inPack?'':' · importing')));
    const act=(text:string,label:string,fn:()=>void,disabled=false)=>{const b=document.createElement('button');b.className='gs-fav-act';b.textContent=text;b.setAttribute('aria-label',label);b.dataset.key='fav:'+id+':'+text;b.disabled=disabled;b.onclick=fn;li.append(b);};
    const swap=(j:number)=>{const next=[...ids];[next[i],next[j]]=[next[j],next[i]];this.setFavorites(next,name+' is now favorite #'+(j+1)+'.');};
    act('▲','Move '+name+' up',()=>swap(i-1),i===0);act('▼','Move '+name+' down',()=>swap(i+1),i===ids.length-1);
    act('✕','Remove '+name+' from favorites',()=>this.setFavorites(ids.filter(x=>x!==id),name+' left your favorites.'));
    if(species)this.requestGame([species.dex]);
    list.append(li);
   });
   summary.append(list);
  }else if(this.party){
   // The team panel takes the summary's place so the box stays browsable while the whole team is dressed.
   summary.append(el('h3','gs-party-title','Guild team'),el('p','muted','Pick the teammate you are dressing, then choose from the box.'));
   const sessions=this.host.sessions();if(!sessions.length)summary.append(el('p','muted','No sessions are connected.'));
   for(const s of sessions){
    const sp=this.host.pack()?.sprites.find(x=>x.id===s.species);
    const b=document.createElement('button');b.className='gs-party-row';b.dataset.key='party:'+s.id;b.setAttribute('aria-pressed',String(this.host.session()?.id===s.id));
    const icon=sp?.dex?this.asset('icon',sp.dex):undefined,front=!icon&&sp?.dex?this.asset('front',sp.dex):undefined;
    b.append(image(this.host.assetBase+(icon||front||sp?.portrait||''),'',icon?'gs-party-icon':front?'gs-party-icon gs-party-front':'gs-party-icon gs-party-portrait'),el('span','gs-party-text',s.label+(sp?' · '+sp.name:'')));
    b.onclick=()=>{this.host.select(s.id);this.menu='none';this.render();};summary.append(b);
    if(sp?.dex)this.requestGame([sp.dex]);
   }
  }else if(species){
   const base=species.forms[0];
   const frame=el('div','gs-sprite');const front=this.asset(this.shiny?'shiny':'front',species.dex);
   if(front)frame.append(image(this.host.assetBase+front,species.name+(this.shiny?' (Shiny)':''),'gs-front'));
   else{const portrait=this.portraitFor(species,base);if(portrait)frame.append(image(this.host.assetBase+portrait,species.name+' (PMD portrait)','gs-front gs-front-portrait'));else frame.append(el('span','gs-front-missing',this.game.get('front:'+pad(species.dex))==='failed'?'Sprite unavailable':'…'));}
   summary.append(frame);
   const name=el('div','gs-name');name.append(el('strong','',species.name),el('span','','No. '+String(species.dex).padStart(3,'0')));summary.append(name);
   const types=el('div','gs-types');const list=this.types?.[pad(species.dex)];
   if(list)for(const t of list)types.append(el('span','type type-'+t,t.toUpperCase()));else types.append(el('span','type type-unknown',this.types?'TYPE UNKNOWN':'…'));
   summary.append(types);
   const rows=el('dl','gs-rows');const row=(k:string,v:string)=>{rows.append(el('dt','',k),el('dd','',v));};
   row('Guild',this.status(base)+' · '+species.forms.length+(species.forms.length===1?' form':' forms'));
   const session=this.host.session();row('Trainer',session?session.label+(session.species?' · '+(this.host.pack()?.sprites.find(s=>s.id===session.species)?.name||''):''):'No teammate selected');
   summary.append(rows);
  }
  const boxPanel=el('section','gs-box');boxPanel.setAttribute('aria-label','Box '+(page.index+1));
  boxPanel.append(this.boxNav(page,'gs-box-head'));
  {
   const gridWrap=el('div','gs-grid-wrap'),grid=el('div','gs-grid');grid.setAttribute('role','group');grid.setAttribute('aria-label','Box '+(page.index+1)+' Pokémon');
   page.species.forEach((s,i)=>{
    const slot=this.slotButton(s,i,'gs-slot');
    const icon=this.asset('icon',s.dex),front=this.asset('front',s.dex);
    if(icon)slot.append(image(this.host.assetBase+icon,'','gs-icon'));
    else if(front)slot.append(image(this.host.assetBase+front,'','gs-icon gs-icon-front'));
    else{const portrait=this.portraitFor(s,s.forms[0]);if(portrait)slot.append(image(this.host.assetBase+portrait,'','gs-icon gs-icon-portrait'));else slot.append(el('span','gs-icon-missing',s.name.slice(0,3).toUpperCase()));}
    grid.append(slot);
   });
   for(let i=page.species.length;i<BOX_SIZE;i++)grid.append(el('span','gs-slot gs-empty'));
   gridWrap.append(grid);
   if(species&&this.menu!=='none'){
    const popup=el('div','gs-popup');const col=this.cursor%6,row=Math.floor(this.cursor/6);
    popup.style.top=Math.min(row,2)*20+'%';if(col<3)popup.style.left=(col+1)*16.66+'%';else popup.style.right=(6-col)*16.66+'%';
    popup.append(this.menuElement(species));gridWrap.append(popup);
   }
   boxPanel.append(gridWrap);
  }
  const bar=el('div','gs-bar');
  const team=el('button','gs-tab','Guild team');team.setAttribute('aria-pressed',String(this.party));team.onclick=()=>{this.party=!this.party;this.favs=false;this.menu='none';this.note='';this.render();};
  const favs=el('button','gs-tab','Favorites');favs.setAttribute('aria-pressed',String(this.favs));favs.onclick=()=>{this.favs=!this.favs;this.party=false;this.menu='none';this.note='';this.render();};favs.dataset.key='favs';
  const fetchAll=el('button','gs-tab',this.progress&&!this.progress.complete?'Fetching '+this.progress.done+' / '+this.progress.total:this.progress?.complete?'Game sprites fetched'+(this.progress.failed?' · '+this.progress.failed+' missing':''):'Fetch all game sprites');
  (fetchAll as HTMLButtonElement).disabled=!!this.progress&&!this.progress.complete;fetchAll.onclick=()=>{this.progress={done:0,total:1};this.host.send({type:'gameImportAll'});this.render();};
  const back=el('button','gs-tab gs-return','Return');back.onclick=()=>this.close();
  team.dataset.key='team';fetchAll.dataset.key='fetch';back.dataset.key='return';
  bar.append(team,favs,fetchAll,back);boxPanel.append(bar);
  if(this.note)boxPanel.append(el('p','pc-note',this.note));
  wrap.append(summary,boxPanel);this.body.append(wrap);
 }
 /** The guild view: SpriteCollab portraits in the slots, a dialogue card and the menu beside the box. */
 private drawGuild(page:{index:number;count:number;species:DexSpecies[]}){
  const boxPanel=el('div','pc-box');
  const grid=el('div','pc-grid');grid.setAttribute('role','group');grid.setAttribute('aria-label','Box '+(page.index+1));
  const wanted:string[]=[];
  page.species.forEach((species,i)=>{
   const form=species.forms[0];const slot=this.slotButton(species,i,'');
   const file=this.portraitFor(species,form);
   if(file)slot.append(image(this.host.assetBase+file,'',''));
   else{const path=portraitPath(species,form.path);if(path&&!this.portraits.has(path)){this.portraits.set(path,'pending');wanted.push(path);}slot.append(el('span','pc-dot',species.name.slice(0,3).toUpperCase()));}
   slot.append(el('span','pc-no',String(species.dex).padStart(3,'0')));
   grid.append(slot);
  });
  if(wanted.length)this.host.send({type:'dexPortraits',paths:wanted.slice(0,40)});
  boxPanel.append(this.boxNav(page,'pc-box-nav'),grid);
  const panel=el('aside','pc-panel');const species=page.species[this.cursor];
  if(species){
   const base=species.forms[0],card=el('div','pc-card');
   const file=this.portraitFor(species,base);
   if(file)card.append(image(this.host.assetBase+file,species.name,'pc-portrait'));
   else card.append(el('div','pc-portrait pc-portrait-missing',this.portraits.get(portraitPath(species,base.path)||'')==='failed'?'offline':'…'));
   const text=el('div','pc-card-text');text.append(el('span','pc-card-no','No. '+String(species.dex).padStart(3,'0')),el('strong','',species.name),el('span','pc-card-state',this.status(base)+' · '+species.forms.length+(species.forms.length===1?' form':' forms')));
   card.append(text);panel.append(card);panel.append(this.menuElement(species));
  }
  if(this.note)panel.append(el('p','pc-note',this.note));
  this.body.append(boxPanel,panel);
 }
}
