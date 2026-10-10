/** The living Pokédex: SpriteCollab's tracker reduced to one catalog in National Dex order.
 *  Availability comes from the tracker's own file flags; nothing here promises artwork that has not been drawn. */
/** `ready` means the tracker records the sprite set as existing (phase 1 or 2); the importer still verifies every sheet.
 *  `actions` counts animations the tracker lists by name, which older uploads and recolours leave unrecorded (0). */
export interface DexForm {path:string;label:string;id:string;ready:boolean;portrait:boolean;complete:number;credit:string;actions:number}
export interface DexSpecies {dex:number;name:string;id:string;forms:DexForm[]}
export interface Dex {version:1;revision:string;built:string;species:DexSpecies[]}
interface TrackerNode {name:string;canon:boolean;sprite_complete:number;portrait_complete:number;sprite_files:Record<string,boolean>;portrait_files:Record<string,boolean>;sprite_credit:{primary:string};subgroups:Record<string,TrackerNode>}
export const REQUIRED_ACTIONS=['Idle','Walk','Attack','Sleep'];
export const BOX_SIZE=30;
export function slug(name:string){return name.normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
/** Resolve a tracker credit id to its name using spritebot_credits.txt; unknown ids stay as written. */
export function creditName(id:string,credits:string){
 if(!id)return '';
 for(const line of credits.split('\n')){if(line.includes('\t')&&line.includes(id))return line.split('\t')[0];}
 return id;
}
/** One form per tracker node that actually has sprites or a portrait. Container nodes (empty names, nothing drawn) are skipped.
 *  Recolours such as shinies carry a completion phase but no per-file flags, so the phase decides. */
function collect(node:TrackerNode,path:string,labels:string[],out:{path:string;labels:string[];node:TrackerNode}[]){
 const drawn=(node.sprite_complete||0)>0||(node.portrait_complete||0)>0||Object.values(node.sprite_files||{}).some(Boolean)||Object.values(node.portrait_files||{}).some(Boolean);
 if(drawn||!path.includes('/'))out.push({path,labels,node});
 for(const key of Object.keys(node.subgroups||{}).sort()){
  const child=node.subgroups[key],name=(child.name||'').replace(/_/g,' ').trim();
  collect(child,path+'/'+key,name?[...labels,name]:labels,out);
 }
}
export function buildDex(tracker:Record<string,TrackerNode>,credits:string,revision:string,built=new Date().toISOString()):Dex {
 const species:DexSpecies[]=[];
 for(const key of Object.keys(tracker).sort()){
  const node=tracker[key],dex=Number.parseInt(key,10);
  if(!node.canon||!(dex>0)||!node.name)continue;
  const entries:{path:string;labels:string[];node:TrackerNode}[]=[];collect(node,key,[],entries);
  const name=node.name.replace(/_/g,' ').trim(),base=slug(name)||'pokemon-'+dex;
  const forms:DexForm[]=[];const used=new Set<string>();
  for(const e of entries){
   const files=e.node.sprite_files||{};
   const actions=Object.values(files).filter(Boolean).length;
   const label=e.labels.join(' ')||'Normal';
   let id=e.labels.length?base+'-'+slug(e.labels.join(' ')):base;if(id.length>40)id=id.slice(0,40).replace(/-+$/,'');
   if(used.has(id))id=id+'-'+e.path.split('/').slice(1).join('');used.add(id);
   const complete=e.node.sprite_complete||0;
   forms.push({path:e.path,label,id,ready:complete>0||REQUIRED_ACTIONS.every(a=>files[a]),portrait:!!e.node.portrait_files?.Normal||(e.node.portrait_complete||0)>0,complete,credit:creditName(e.node.sprite_credit?.primary||'',credits),actions});
  }
  species.push({dex,name,id:base,forms});
 }
 // Species whose names collapse to one slug (Nidoran♀ / Nidoran♂) carry their number.
 const counts=new Map<string,number>();for(const s of species)counts.set(s.id,(counts.get(s.id)||0)+1);
 for(const s of species)if(counts.get(s.id)!>1){const id=s.id+'-'+s.dex;for(const f of s.forms)f.id=f.id===s.id?id:f.id.replace(s.id+'-',id+'-');s.id=id;}
 return {version:1,revision,built,species};
}
export function validDex(x:unknown):x is Dex {
 const d=x as Dex;
 return !!d&&typeof d==='object'&&d.version===1&&typeof d.revision==='string'&&Array.isArray(d.species)&&d.species.length>0&&d.species.length<=2000&&d.species.every(s=>Number.isInteger(s.dex)&&s.dex>0&&typeof s.name==='string'&&s.name.length<=40&&/^[a-z0-9-]{1,40}$/.test(s.id)&&Array.isArray(s.forms)&&s.forms.length>0&&s.forms.length<=256&&s.forms.every(f=>/^[0-9]{4}(\/[0-9]{4}){0,4}$/.test(f.path)&&typeof f.label==='string'&&f.label.length<=60&&/^[a-z0-9-]{1,48}$/.test(f.id)&&typeof f.ready==='boolean'&&typeof f.portrait==='boolean'&&typeof f.credit==='string'));
}
/** Box n (from 0) holds thirty consecutive species in National Dex order, like the original storage system. */
export function boxOf(dex:Dex,box:number){const count=Math.max(1,Math.ceil(dex.species.length/BOX_SIZE));const n=((box%count)+count)%count;return {index:n,count,species:dex.species.slice(n*BOX_SIZE,(n+1)*BOX_SIZE)};}
export function findSpecies(dex:Dex,query:string){
 const q=query.trim().toLowerCase();if(!q)return undefined;
 const number=Number.parseInt(q.replace(/^#/,''),10);
 if(Number.isInteger(number)&&/^#?\d+$/.test(q))return dex.species.find(s=>s.dex===number);
 return dex.species.find(s=>s.name.toLowerCase().startsWith(q))||dex.species.find(s=>s.name.toLowerCase().includes(q));
}
/** Nearest form with a portrait: the form itself, then its parents up to the species. */
export function portraitPath(species:DexSpecies,path:string){
 const parts=path.split('/');
 for(let n=parts.length;n>0;n--){const p=parts.slice(0,n).join('/');const form=species.forms.find(f=>f.path===p);if(form?.portrait)return p;}
 return undefined;
}
export const portraitFile=(path:string)=>'dex/portraits/'+path.replace(/\//g,'-')+'.png';
