import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import type {Pack,Animation} from './world';
export async function loadPack(directory:string):Promise<Pack> {
 const root=await realpath(directory);
 const manifestPath=resolve(root,'manifest.json');
 if((await stat(manifestPath)).size>2000000)throw Error('Manifest too large');
 const p=JSON.parse(await readFile(manifestPath,'utf8')) as Pack;
 if(p.version!==1||!Array.isArray(p.sprites)||!p.sprites.length||p.sprites.length>32||!Array.isArray(p.maps)||p.maps.length!==1)throw Error('Unsupported asset pack');
 async function file(name:string) {
  if(typeof name!=='string'||!/^[-a-zA-Z0-9_./]+$/.test(name))throw Error('Invalid asset path');
  const path=await realpath(resolve(root,name));
  if(!path.startsWith(root+sep)||(await stat(path)).size>4000000)throw Error('Asset escapes pack or is too large');
  return readFile(path);
 }
 const ids=new Set<string>();
 for(const s of p.sprites) {
  if(!/^[a-z0-9-]{1,30}$/.test(s.id)||ids.has(s.id)||typeof s.name!=='string'||s.name.length>60||!Array.isArray(s.artists)||!Array.isArray(s.portraitCredits))throw Error('Invalid species');
  ids.add(s.id);
  await file(s.portrait);
  for(const action of ['Idle','Walk','Attack','Sleep']) {
   const a:Animation=s.animations?.[action];
   if(!a||![a.w,a.h].every(x=>Number.isInteger(x)&&x>0&&x<=256)||![1,8].includes(a.rows)||!Array.isArray(a.durations)||!a.durations.length||a.durations.length>128||!a.durations.every(d=>Number.isInteger(d)&&d>0&&d<=600))throw Error('Invalid animation');
   if(!Array.isArray(a.anchors)||a.anchors.length!==a.rows||!a.anchors.every(row=>Array.isArray(row)&&row.length===a.durations.length&&row.every(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)&&v[0]>=0&&v[0]<a.w&&v[1]>=0&&v[1]<a.h)))throw Error('Invalid anchors');
   const b=await file(a.file);
   if(b.length<24||b.toString('hex',0,8)!=='89504e470d0a1a0a'||b.readUInt32BE(16)!==a.w*a.durations.length||b.readUInt32BE(20)!==a.h*a.rows)throw Error('Sheet geometry mismatch');
  }
 }
 const map=p.maps[0];
 if(map.id!=='meadow'||map.width!==456||map.height!==335||typeof map.credit!=='string')throw Error('This version supports the measured Thunder Meadow geometry only');
 const b=await file(map.file);if(b.readUInt32BE(16)!==456||b.readUInt32BE(20)!==335)throw Error('Map geometry mismatch');
 await file('PixelifySans.woff2');
 return p;
}
