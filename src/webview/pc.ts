import {boxOf,findSpecies,portraitPath,BOX_SIZE,type Dex,type DexSpecies,type DexForm} from '../dex';
import type {Pack,Species} from '../world';
/** The guild's storage system: every species in National Dex order, thirty to a box, with forms and credits behind a menu.
 *  Portraits and sheets arrive from the host (pinned SpriteCollab fetches into the local pack); nothing is drawn from guesses. */
export interface PcHost {send:(msg:unknown)=>void;assetBase:string;pack:()=>Pack|undefined;session:()=>{id:string;label:string;species?:string}|undefined;choose:(id:string)=>void}
const SOURCE='https://github.com/PMDCollab/SpriteCollab/tree/';
const el=(tag:string,className='',text='')=>{const n=document.createElement(tag);if(className)n.className=className;if(text)n.textContent=text;return n;};
export class PokemonPc {
 private root:HTMLElement;private body:HTMLElement;private title:HTMLElement;private search:HTMLInputElement;
 private dex?:Dex;private error?:string;private requested=false;
 private box=0;private cursor=0;private menu:'none'|'main'|'forms'|'summary'='none';
 private portraits=new Map<string,string|'pending'|'failed'>();private importing?:string;private note='';private opener?:HTMLElement;
 constructor(parent:HTMLElement,private host:PcHost){
  this.root=el('section','pc');this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.setAttribute('aria-label','Pokémon storage');this.root.hidden=true;
  const frame=el('div','pc-frame'),head=el('header','pc-head');
  const heading=el('div');heading.append(el('span','eyebrow','POKÉMON STORAGE SYSTEM'));this.title=el('h2','','Box 1');heading.append(this.title);
  const form=el('form','pc-search');form.setAttribute('role','search');this.search=document.createElement('input');this.search.type='search';this.search.placeholder='Name or #number';this.search.setAttribute('aria-label','Find a Pokémon by name or number');
  const find=el('button','','Find');(find as HTMLButtonElement).type='submit';form.append(this.search,find);
  form.onsubmit=e=>{e.preventDefault();this.find(this.search.value);};
  const close=el('button','pc-close','Close');close.setAttribute('aria-label','Close storage');close.onclick=()=>this.close();
  head.append(heading,form,close);
  this.body=el('div','pc-body');
  const foot=el('footer','pc-foot','Box portraits and chosen sheets are fetched from PMD SpriteCollab at the pinned revision into your local pack, with credits and receipts. Nothing is bundled or uploaded.');
  frame.append(head,this.body,foot);this.root.append(frame);parent.append(this.root);
  this.root.addEventListener('keydown',e=>this.key(e));
  this.root.addEventListener('click',e=>{if(e.target===this.root)this.close();});
 }
 isOpen(){return !this.root.hidden;}
 open(from?:HTMLElement){
  this.opener=from;this.root.hidden=false;this.note='';
  if(!this.dex&&!this.requested){this.requested=true;this.host.send({type:'dex'});}
  const current=this.host.session()?.species,pack=this.host.pack();
  const assigned=pack?.sprites.find(s=>s.id===current);
  if(assigned?.dex&&this.dex){const index=this.dex.species.findIndex(s=>s.dex===assigned.dex);if(index>=0){this.box=Math.floor(index/BOX_SIZE);this.cursor=index%BOX_SIZE;}}
  this.menu='none';this.render();this.focusCursor();
 }
 close(){this.root.hidden=true;this.menu='none';this.opener?.focus();}
 setDex(m:{dex?:Dex;error?:string}){this.dex=m.dex;this.error=m.error;this.requested=!!m.dex;if(this.isOpen()){this.open(this.opener);}}
 portraitsReady(m:{ready?:Record<string,string>;failed?:string[]}){
  for(const [path,file] of Object.entries(m.ready||{}))this.portraits.set(path,file);
  for(const path of m.failed||[])this.portraits.set(path,'failed');
  if(this.isOpen())this.render();
 }
 imported(m:{path:string;id:string;species?:Species;error?:string}){
  if(this.importing!==m.id)return;this.importing=undefined;
  if(m.species){this.host.choose(m.id);this.note='';this.close();return;}
  this.note=m.error||'Import failed.';if(this.isOpen())this.render();
 }
 private find(query:string){
  if(!this.dex)return;const hit=findSpecies(this.dex,query);
  if(!hit){this.note='No Pokémon matches "'+query+'".';this.render();return;}
  const index=this.dex.species.indexOf(hit);this.box=Math.floor(index/BOX_SIZE);this.cursor=index%BOX_SIZE;this.menu='none';this.note='';this.render();this.focusCursor();
 }
 private focusCursor(){this.body.querySelector<HTMLElement>('.pc-slot[data-index="'+this.cursor+'"]')?.focus({preventScroll:true});}
 private move(delta:number,boxes=0){
  if(!this.dex)return;const page=boxOf(this.dex,this.box+boxes);
  if(boxes){this.box=page.index;this.cursor=Math.min(this.cursor,page.species.length-1);}
  else this.cursor=Math.max(0,Math.min(page.species.length-1,this.cursor+delta));
  this.menu='none';this.render();this.focusCursor();
 }
 private key(e:KeyboardEvent){
  // Escape steps back one level, like B in the games: submenu → menu → box → closed.
  if(e.key==='Escape'){e.preventDefault();if(this.menu==='forms'||this.menu==='summary'){this.menu='main';this.render();this.body.querySelector<HTMLElement>('.pc-menu button')?.focus();}else if(this.menu==='main'){this.menu='none';this.render();this.focusCursor();}else this.close();return;}
  if(e.target instanceof HTMLInputElement)return;
  const keys:Record<string,()=>void>={ArrowLeft:()=>this.move(-1),ArrowRight:()=>this.move(1),ArrowUp:()=>this.move(-6),ArrowDown:()=>this.move(6),PageUp:()=>this.move(0,-1),PageDown:()=>this.move(0,1),Home:()=>this.move(-BOX_SIZE),End:()=>this.move(BOX_SIZE)};
  if(keys[e.key]){e.preventDefault();keys[e.key]();}
 }
 /** The portrait file for a species' nearest drawn portrait: the pack's own copy when the form is imported, otherwise a fetched box portrait. */
 private portraitFor(species:DexSpecies,form:DexForm):string|undefined{
  const imported=this.host.pack()?.sprites.find(s=>s.id===form.id);if(imported)return imported.portrait;
  const path=portraitPath(species,form.path);if(!path)return undefined;
  const state=this.portraits.get(path);return typeof state==='string'&&state!=='pending'&&state!=='failed'?state:undefined;
 }
 private status(form:DexForm){const pack=this.host.pack();return pack?.sprites.some(s=>s.id===form.id)?'In roster':form.ready?'Ready':form.portrait?'Portrait only':'Not drawn yet';}
 private choose(species:DexSpecies,form:DexForm){
  const session=this.host.session();if(!session){this.note='Select a teammate in the guild first, then choose its Pokémon here.';this.render();return;}
  if(this.host.pack()?.sprites.some(s=>s.id===form.id)){this.host.choose(form.id);this.close();return;}
  if(!form.ready){this.note=species.name+' ('+form.label+') has no complete Idle, Walk, Attack and Sleep sheets yet.';this.render();return;}
  if(this.importing)return;
  this.importing=form.id;this.note='';this.host.send({type:'dexImport',path:form.path,id:form.id});this.render();
 }
 private render(){
  // Portraits and imports arrive while the user navigates; rebuilding the box must not drop keyboard focus.
  const active=document.activeElement,onSlot=!!active?.classList.contains('pc-slot'),menuIndex=active?.closest('.pc-menu')?[...this.body.querySelectorAll('.pc-menu button')].indexOf(active as Element):-1;
  this.draw();
  if(onSlot)this.focusCursor();else if(menuIndex>=0)this.body.querySelectorAll<HTMLElement>('.pc-menu button')[menuIndex]?.focus({preventScroll:true});
 }
 private draw(){
  this.body.replaceChildren();
  if(!this.dex){
   const empty=el('div','pc-empty');empty.append(el('h3','',this.error?'The catalog is unavailable':'Opening the storage system…'),el('p','muted',this.error||'Reading the National Dex from PMD SpriteCollab (pinned revision).'));
   if(this.error){const retry=el('button','primary','Try again');retry.onclick=()=>{this.error=undefined;this.requested=true;this.host.send({type:'dex'});this.render();};empty.append(retry);}
   this.body.append(empty);this.title.textContent='Storage';return;
  }
  const page=boxOf(this.dex,this.box);this.box=page.index;this.cursor=Math.max(0,Math.min(page.species.length-1,this.cursor));
  const first=page.species[0]?.dex??0,last=page.species[page.species.length-1]?.dex??0;
  this.title.textContent='Box '+(page.index+1);
  const boxPanel=el('div','pc-box'),nav=el('div','pc-box-nav');
  const prev=el('button','','◀');prev.setAttribute('aria-label','Previous box');prev.onclick=()=>this.move(0,-1);
  const next=el('button','','▶');next.setAttribute('aria-label','Next box');next.onclick=()=>this.move(0,1);
  nav.append(prev,el('span','pc-box-range','BOX '+(page.index+1)+' / '+page.count+' · #'+String(first).padStart(3,'0')+'–#'+String(last).padStart(3,'0')),next);
  const grid=el('div','pc-grid');grid.setAttribute('role','group');grid.setAttribute('aria-label','Box '+(page.index+1));
  const wanted:string[]=[];const pack=this.host.pack(),session=this.host.session();
  page.species.forEach((species,i)=>{
   const form=species.forms[0];const slot=el('button','pc-slot');slot.dataset.index=String(i);slot.dataset.dex=String(species.dex);
   slot.setAttribute('aria-label','#'+String(species.dex).padStart(3,'0')+' '+species.name+' · '+this.status(form));slot.setAttribute('aria-pressed',String(i===this.cursor));
   if(pack?.sprites.some(s=>s.dex===species.dex))slot.classList.add('in-roster');
   if(session?.species&&pack?.sprites.find(s=>s.id===session.species)?.dex===species.dex)slot.classList.add('chosen');
   const file=this.portraitFor(species,form);
   if(file){const img=document.createElement('img');img.src=this.host.assetBase+file;img.alt='';img.width=40;img.height=40;slot.append(img);}
   else{const path=portraitPath(species,form.path);if(path&&!this.portraits.has(path)){this.portraits.set(path,'pending');wanted.push(path);}slot.append(el('span','pc-dot',species.name.slice(0,3).toUpperCase()));}
   slot.append(el('span','pc-no',String(species.dex).padStart(3,'0')));
   slot.onclick=()=>{this.cursor=i;this.menu='main';this.note='';this.render();this.body.querySelector<HTMLElement>('.pc-menu button')?.focus({preventScroll:true});};
   grid.append(slot);
  });
  if(wanted.length)this.host.send({type:'dexPortraits',paths:wanted.slice(0,40)});
  boxPanel.append(nav,grid);
  const panel=el('aside','pc-panel');const species=page.species[this.cursor];
  if(species){
   const base=species.forms[0],card=el('div','pc-card');
   const file=this.portraitFor(species,base);
   if(file){const img=document.createElement('img');img.src=this.host.assetBase+file;img.alt=species.name;img.className='pc-portrait';card.append(img);}
   else card.append(el('div','pc-portrait pc-portrait-missing',this.portraits.get(portraitPath(species,base.path)||'')==='failed'?'offline':'…'));
   const text=el('div','pc-card-text');text.append(el('span','pc-card-no','No. '+String(species.dex).padStart(3,'0')),el('strong','',species.name),el('span','pc-card-state',this.status(base)+' · '+species.forms.length+(species.forms.length===1?' form':' forms')));
   card.append(text);panel.append(card);
   const menu=el('div','pc-menu');menu.setAttribute('aria-label',species.name+' menu');
   const item=(text:string,action:()=>void,disabled=false)=>{const b=document.createElement('button');b.textContent=text;b.disabled=disabled;b.onclick=action;menu.append(b);return b;};
   if(this.menu==='forms'){
    for(const form of species.forms)item(form.label+' · '+(this.importing===form.id?'Importing…':this.status(form)),()=>this.choose(species,form),!form.ready&&!pack?.sprites.some(s=>s.id===form.id));
    item('Back',()=>{this.menu='main';this.render();this.body.querySelector<HTMLElement>('.pc-menu button')?.focus();});
   }else if(this.menu==='summary'){
    const list=el('dl','pc-summary');const row=(k:string,v:string)=>{list.append(el('dt','',k),el('dd','',v));};
    row('Forms drawn',String(species.forms.length));row('Ready to train',String(species.forms.filter(f=>f.ready).length));row('Animations',base.actions+' in the base set');
    row('Sprite credit',base.credit||'Not recorded');row('Portrait',base.portrait?'Drawn':portraitPath(species,base.path)?'Borrowed from another form':'None yet');
    const link=document.createElement('a');link.href=SOURCE+this.dex.revision+'/sprite/'+base.path;link.textContent='Source on SpriteCollab';link.target='_blank';link.rel='noreferrer';
    const dd=el('dd');dd.append(link);list.append(el('dt','','Provenance'),dd);menu.append(list);
    item('Back',()=>{this.menu='main';this.render();this.body.querySelector<HTMLElement>('.pc-menu button')?.focus();});
   }else if(this.menu==='main'){
    const inPack=!!pack?.sprites.some(s=>s.id===base.id);
    item(this.importing===base.id?'Importing…':inPack?'Choose':base.ready?'Import & choose':'No complete sheets yet',()=>this.choose(species,base),(!inPack&&!base.ready)||!!this.importing);
    item('Forms ('+species.forms.length+')',()=>{this.menu='forms';this.render();this.body.querySelector<HTMLElement>('.pc-menu button')?.focus();});
    item('Summary',()=>{this.menu='summary';this.render();this.body.querySelector<HTMLElement>('.pc-menu button')?.focus();});
    item('Back',()=>{this.menu='none';this.render();this.focusCursor();});
   }else menu.append(el('p','muted',session?'Choosing for '+session.label+'. Open a Pokémon to pick it or one of its forms.':'Browsing. Select a teammate in the guild to assign a Pokémon.'));
   panel.append(menu);
  }
  if(this.note)panel.append(el('p','pc-note',this.note));
  this.body.append(boxPanel,panel);
 }
}
