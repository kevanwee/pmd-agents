import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import type {Pack,Animation} from './world';
import {terrains} from './navigation';
export async function loadPack(directory:string):Promise<Pack> {
 const root=await realpath(directory);
 const manifestPath=resolve(root,'manifest.json');
 if((await stat(manifestPath)).size>2000000)throw Error('Manifest too large');
 const p=JSON.parse(await readFile(manifestPath,'utf8')) as Pack;
 if(p.version!==1||!Array.isArray(p.sprites)||!p.sprites.length||p.sprites.length>32||!Array.isArray(p.maps)||!p.maps.length||p.maps.length>2)throw Error('Unsupported asset pack');
 async function file(name:string) {
  if(typeof name!=='string'||!/^[-a-zA-Z0-9_./]+$/.test(name))throw Error('Invalid asset path');
  const path=await realpath(resolve(root,name));
  if(!path.startsWith(root+sep)||(await stat(path)).size>4000000)throw Error('Asset escapes pack or is too large');
  return readFile(path);
 }
 const ids=new Set<string>();
 for(const s of [...p.sprites,...(p.dummy?[p.dummy]:[])]) {
  if(!/^[a-z0-9-]{1,30}$/.test(s.id)||ids.has(s.id)||typeof s.name!=='string'||s.name.length>60||!Array.isArray(s.artists)||(s!==p.dummy&&!Array.isArray(s.portraitCredits)))throw Error('Invalid species');
  ids.add(s.id);
  if(s!==p.dummy)await file(s.portrait);
  const required=s===p.dummy?['Idle','Hurt']:['Idle','Walk','Attack','Sleep'];
  for(const action of [...required,...(s.animations?.Shoot?['Shoot']:[])]) {
   const a:Animation=s.animations?.[action];
   if(!a||![a.w,a.h].every(x=>Number.isInteger(x)&&x>0&&x<=256)||![1,8].includes(a.rows)||!Array.isArray(a.durations)||!a.durations.length||a.durations.length>128||!a.durations.every(d=>Number.isInteger(d)&&d>0&&d<=600))throw Error('Invalid animation');
   if(!Array.isArray(a.anchors)||a.anchors.length!==a.rows||!a.anchors.every(row=>Array.isArray(row)&&row.length===a.durations.length&&row.every(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)&&v[0]>=0&&v[0]<a.w&&v[1]>=0&&v[1]<a.h)))throw Error('Invalid anchors');
   if(!Number.isInteger(a.hit)||a.hit<0||a.hit>=a.durations.length)throw Error('Invalid hit frame');
   if(a.heads&&(!Array.isArray(a.heads)||a.heads.length!==a.rows||!a.heads.every(row=>Array.isArray(row)&&row.length===a.durations.length&&row.every(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)&&v[0]>=0&&v[0]<a.w&&v[1]>=0&&v[1]<a.h))))throw Error('Invalid head offsets');
   const b=await file(a.file);
   if(b.length<24||b.toString('hex',0,8)!=='89504e470d0a1a0a'||b.readUInt32BE(16)!==a.w*a.durations.length||b.readUInt32BE(20)!==a.h*a.rows)throw Error('Sheet geometry mismatch');
  }
 }
 const maps=new Set<string>();
 for(const map of p.maps){
  const terrain=terrains[map.id];
  if(!terrain||maps.has(map.id)||map.width!==terrain.width||map.height!==terrain.height||typeof map.credit!=='string')throw Error('Unsupported map geometry');
  maps.add(map.id);
  const b=await file(map.file);if(b.length<24||b.toString('hex',0,8)!=='89504e470d0a1a0a'||b.readUInt32BE(16)!==map.width||b.readUInt32BE(20)!==map.height)throw Error('Map geometry mismatch');
  if(map.layers&&(!Array.isArray(map.layers)||map.layers.length>8))throw Error('Too many map layers');
  for(const layer of map.layers||[]){
   if(![layer.x,layer.y,layer.w,layer.h,layer.frames,layer.frameMs].every(Number.isInteger)||layer.x<0||layer.y<0||layer.w<1||layer.h<1||layer.x+layer.w>map.width||layer.y+layer.h>map.height||layer.frames<2||layer.frames>64||layer.frameMs<50||layer.frameMs>2000||typeof layer.credit!=='string')throw Error('Invalid animated layer');
   const sheet=await file(layer.file);if(sheet.length<24||sheet.toString('hex',0,8)!=='89504e470d0a1a0a'||sheet.readUInt32BE(16)!==layer.w*layer.frames||sheet.readUInt32BE(20)!==layer.h)throw Error('Layer geometry mismatch');
  }
 }
 await file('PixelifySans.woff2');
 return p;
}
