import {open,readFile,realpath,stat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import type {Pack,Animation,Species} from './world';
import {terrainSizes} from './navigation';
import {pngSize} from './png';
const PATH=/^[-a-zA-Z0-9_./]+$/;
async function safePath(root:string,name:unknown){
 if(typeof name!=='string'||!PATH.test(name))throw Error('Invalid asset path');
 const path=await realpath(resolve(root,name));
 if(!path.startsWith(root+sep)||(await stat(path)).size>4000000)throw Error('Asset escapes pack or is too large');
 return path;
}
/** Only the PNG header is read, so validating a large pack stays cheap. */
async function header(root:string,name:unknown){
 const handle=await open(await safePath(root,name));
 try{const b=Buffer.alloc(24);const {bytesRead}=await handle.read(b,0,24,0);return b.subarray(0,bytesRead);}finally{await handle.close();}
}
const point=(v:unknown,w:number,h:number)=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)&&v[0]>=0&&v[0]<w&&v[1]>=0&&v[1]<h;
/** One species (or the Substitute dummy): ids, credits, every required sheet's geometry, anchors and timing. */
export async function validateSpecies(root:string,s:Species,dummy=false){
 if(!/^[a-z0-9-]{1,48}$/.test(s.id)||typeof s.name!=='string'||s.name.length>60||!Array.isArray(s.artists)||(!dummy&&!Array.isArray(s.portraitCredits)))throw Error('Invalid species');
 if(s.shadow!==undefined&&![0,1,2].includes(s.shadow))throw Error('Invalid shadow size');
 if(s.form!==undefined&&(typeof s.form!=='object'||!/^[0-9]{4}(\/[0-9]{4}){0,4}$/.test(s.form.path)||typeof s.form.label!=='string'||s.form.label.length>60))throw Error('Invalid form');
 if(!dummy){const p=await header(root,s.portrait);if(!pngSize(p))throw Error('Invalid portrait');}
 const required=dummy?['Idle','Hurt']:['Idle','Walk','Attack','Sleep'];
 for(const action of new Set([...required,...Object.keys(s.animations||{})])) {
  const a:Animation=s.animations?.[action];
  if(!a||![a.w,a.h].every(x=>Number.isInteger(x)&&x>0&&x<=256)||![1,8].includes(a.rows)||!Array.isArray(a.durations)||!a.durations.length||a.durations.length>128||!a.durations.every(d=>Number.isInteger(d)&&d>0&&d<=600))throw Error('Invalid animation');
  if(!Array.isArray(a.anchors)||a.anchors.length!==a.rows||!a.anchors.every(row=>Array.isArray(row)&&row.length===a.durations.length&&row.every(v=>point(v,a.w,a.h))))throw Error('Invalid anchors');
  if(!Number.isInteger(a.hit)||a.hit<0||a.hit>=a.durations.length)throw Error('Invalid hit frame');
  if(a.heads&&(!Array.isArray(a.heads)||a.heads.length!==a.rows||!a.heads.every(row=>Array.isArray(row)&&row.length===a.durations.length&&row.every(v=>point(v,a.w,a.h)))))throw Error('Invalid head offsets');
  const size=pngSize(await header(root,a.file));
  if(!size||size.width!==a.w*a.durations.length||size.height!==a.h*a.rows)throw Error('Sheet geometry mismatch');
 }
}
export async function loadPack(directory:string):Promise<Pack> {
 const root=await realpath(directory);
 const manifestPath=resolve(root,'manifest.json');
 if((await stat(manifestPath)).size>16_000_000)throw Error('Manifest too large');
 const p=JSON.parse(await readFile(manifestPath,'utf8')) as Pack;
 if(p.version!==1||!Array.isArray(p.sprites)||!p.sprites.length||p.sprites.length>1200||!Array.isArray(p.maps)||!p.maps.length||p.maps.length>128)throw Error('Unsupported asset pack');
 const ids=new Set<string>();
 for(const s of [...p.sprites,...(p.dummy?[p.dummy]:[])]) {
  if(typeof s?.id!=='string'||ids.has(s.id))throw Error('Invalid species');ids.add(s.id);
  await validateSpecies(root,s,s===p.dummy);
 }
 const maps=new Set<string>();
 for(const map of p.maps){
  const terrain=terrainSizes[map.id];
  if(!terrain||maps.has(map.id)||map.width!==terrain.width||(map.height!==terrain.height&&!(map.id==='meadow'&&map.height===335))||typeof map.credit!=='string')throw Error('Unsupported map geometry');
  maps.add(map.id);
  const size=pngSize(await header(root,map.file));if(!size||size.width!==map.width||size.height!==map.height)throw Error('Map geometry mismatch');
  if(map.layers&&(!Array.isArray(map.layers)||map.layers.length>16))throw Error('Too many map layers');
  for(const layer of map.layers||[]){
   if(![layer.x,layer.y,layer.w,layer.h,layer.frames].every(Number.isInteger)||layer.x<0||layer.y<0||layer.w<1||layer.h<1||layer.x+layer.w>map.width||layer.y+layer.h>map.height||layer.frames<2||layer.frames>64||typeof layer.credit!=='string')throw Error('Invalid animated layer');
   if(layer.durations ? (!Array.isArray(layer.durations)||layer.durations.length!==layer.frames||!layer.durations.every(d=>Number.isInteger(d)&&d>0&&d<=600)) : (!Number.isInteger(layer.frameMs)||layer.frameMs!<50||layer.frameMs!>2000))throw Error('Invalid layer timing');
   const sheet=pngSize(await header(root,layer.file));if(!sheet||sheet.width!==layer.w*layer.frames||sheet.height!==layer.h)throw Error('Layer geometry mismatch');
  }
 }
 await safePath(root,'PixelifySans.woff2');
 return p;
}
