import {createHash} from 'node:crypto';
import {mkdir,readFile,rename,writeFile,stat} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {decodePng,type Png} from './png';
import {parseAnimData,resolveAnim} from './animdata';
import {creditName} from './dex';
import type {Species,Animation,Pack} from './world';
/** Every fetch is pinned to one SpriteCollab revision, the same one the Python importer uses. */
export const REV='47e5b9920bc5b2b491c53b18076300dc6813f103';
export const RAW=`https://raw.githubusercontent.com/PMDCollab/SpriteCollab/${REV}/`;
export type Fetch=(rel:string)=>Promise<Uint8Array>;
export interface Receipt {file:string;source:string;sha256:string;distribution:string;changes:string}
export interface ImportRequest {id:string;name:string;dex:number;path:string;label:string;element?:string;portraitPath?:string}
export interface ImportResult {species:Species;files:Receipt[];written:Record<string,Uint8Array>}
const REQUIRED=['Idle','Walk','Attack','Sleep'],OPTIONAL=['Shoot'];
/** Fetch one pinned file over HTTPS with a size bound. Nothing else is ever downloaded. */
export async function fetchPinned(rel:string,limit=4_000_000):Promise<Uint8Array> {
 if(!/^[A-Za-z0-9_./-]+$/.test(rel)||rel.includes('..'))throw Error('Invalid source path');
 const response=await fetch(RAW+rel,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('SpriteCollab returned '+response.status+' for '+rel);
 const length=Number(response.headers.get('content-length')||0);if(length>limit)throw Error('Source file too large: '+rel);
 const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>limit)throw Error('Source file too large: '+rel);
 return bytes;
}
/** Read a pinned file from the pack's source cache when present, otherwise fetch it. The cache layout matches the Python importer. */
export function cachedFetch(root:string,fetchRel:Fetch=fetchPinned):Fetch {
 return async rel=>{
  const local=resolve(root,'sources',rel);
  try{if((await stat(local)).isFile())return new Uint8Array(await readFile(local));}catch{}
  return fetchRel(rel);
 };
}
/** Shadow sheets mark each frame's ground anchor with one white pixel; Offsets sheets mark the head with one black pixel. */
export function sheetAnchors(sheet:Png,shadow:Png,offsets:Png,w:number,h:number,frames:number){
 if(sheet.width!==shadow.width||sheet.height!==shadow.height||sheet.width!==offsets.width||sheet.height!==offsets.height||sheet.width!==w*frames||sheet.height%h||![1,8].includes(sheet.height/h))throw Error('Unexpected sheet geometry');
 const rows=sheet.height/h,anchors:number[][][]=[],heads:number[][][]=[];
 const find=(png:Png,row:number,frame:number,r:number,g:number,b:number)=>{
  const points:number[][]=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const o=((row*h+y)*png.width+frame*w+x)*4;if(png.data[o]===r&&png.data[o+1]===g&&png.data[o+2]===b&&png.data[o+3]===255)points.push([x,y]);}
  return points;
 };
 for(let row=0;row<rows;row++){
  anchors.push([]);heads.push([]);
  for(let frame=0;frame<frames;frame++){
   const points=find(shadow,row,frame,255,255,255);if(points.length!==1)throw Error('Missing/ambiguous shadow anchor at row '+row+' frame '+frame);
   const head=find(offsets,row,frame,0,0,0);
   anchors[row].push(points[0]);heads[row].push(head.length===1?head[0]:points[0]);
  }
 }
 return {rows,anchors,heads};
}
/** Contributors named in a credits.txt, resolved through spritebot_credits.txt like the Python importer. */
export function artistsOf(credit:string,names:string){
 const result:string[]=[];
 for(const line of credit.split('\n')){const fields=line.split('\t');if(fields.length<2)continue;const name=creditName(fields[1],names);if(!result.includes(name))result.push(name);}
 return result;
}
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
/** Import one species or form from the pinned revision into memory: unchanged sheets, native timing, measured anchors, credits and receipts. */
export async function importSpecies(req:ImportRequest,get:Fetch,names:string):Promise<ImportResult> {
 if(!/^[a-z0-9-]{1,48}$/.test(req.id)||!/^[0-9]{4}(\/[0-9]{4}){0,4}$/.test(req.path))throw Error('Invalid import request');
 const written:Record<string,Uint8Array>={},files:Receipt[]=[];
 const source=async(rel:string,target='sources/'+rel)=>{const data=await get(rel);written[target]=data;files.push({file:target,source:RAW+rel,sha256:sha(data),distribution:'local-reference-only',changes:'Unmodified'});return data;};
 const root='sprite/'+req.path+'/',dir='dex/'+req.id+'/';
 const data=parseAnimData(new TextDecoder().decode(await source(root+'AnimData.xml')));
 const credit=new TextDecoder().decode(await source(root+'credits.txt'));
 const animations:Record<string,Animation>={};
 for(const action of [...REQUIRED,...OPTIONAL.filter(a=>data.anims.has(a))]){
  const node=resolveAnim(data,action);
  const sheet=decodePng(await source(root+node.name+'-Anim.png',dir+node.name+'.png'));
  const shadow=decodePng(await source(root+node.name+'-Shadow.png')),offsets=decodePng(await source(root+node.name+'-Offsets.png'));
  const {rows,anchors,heads}=sheetAnchors(sheet,shadow,offsets,node.w,node.h,node.durations.length);
  animations[action]={file:dir+node.name+'.png',w:node.w,h:node.h,rows,durations:node.durations,anchors,heads,hit:node.hit??0};
 }
 const portraitPath=req.portraitPath||req.path;
 await source('portrait/'+portraitPath+'/Normal.png',dir+'portrait.png');
 const portraitCredit=new TextDecoder().decode(await source('portrait/'+portraitPath+'/credits.txt'));
 const species:Species={id:req.id,name:req.label&&req.label!=='Normal'?req.name+' ('+req.label+')':req.name,dex:req.dex,form:{path:req.path,label:req.label||'Normal'},element:req.element||'normal',shadow:data.shadowSize,
  source:RAW+root,artists:artistsOf(credit,names),creditRecord:credit,animations,portrait:dir+'portrait.png',portraitCredits:artistsOf(portraitCredit,names),...(portraitPath!==req.path?{portraitFrom:portraitPath}:{})} as Species;
 return {species,files,written};
}
/** Write an import into the pack and append it to the manifest atomically. Existing entries with the same id are replaced. */
export async function writeImport(root:string,result:ImportResult,validate:(root:string,s:Species)=>Promise<void>){
 for(const [rel,bytes] of Object.entries(result.written)){
  if(!/^[-a-zA-Z0-9_./]+$/.test(rel)||rel.includes('..'))throw Error('Invalid pack path');
  const path=resolve(root,rel);await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes);
 }
 await validate(root,result.species);
 const manifestPath=resolve(root,'manifest.json');
 const manifest=JSON.parse(await readFile(manifestPath,'utf8')) as Pack&{files?:Receipt[]};
 manifest.sprites=[...manifest.sprites.filter(s=>s.id!==result.species.id),result.species];
 const known=new Set((manifest.files||[]).map(f=>f.file));
 manifest.files=[...(manifest.files||[]),...result.files.filter(f=>!known.has(f.file))];
 await writeFile(manifestPath+'.tmp',JSON.stringify(manifest)+'\n');await rename(manifestPath+'.tmp',manifestPath);
 return manifest;
}
/** Fetch box portraits (Normal.png) for the storage grid into dex/portraits; receipts go to dex/portraits.json. */
export async function ensurePortraits(root:string,paths:string[],get:Fetch=fetchPinned,fileOf:(path:string)=>string){
 const ready:Record<string,string>={},failed:string[]=[];
 const receiptsPath=resolve(root,'dex','portraits.json');let receipts:Receipt[]=[];
 try{receipts=JSON.parse(await readFile(receiptsPath,'utf8'));if(!Array.isArray(receipts))receipts=[];}catch{}
 const queue=[...paths];
 await Promise.all(Array.from({length:4},async()=>{
  for(let path=queue.shift();path!==undefined;path=queue.shift()){
   const file=fileOf(path),target=resolve(root,file);
   try{
    try{if((await stat(target)).isFile()){ready[path]=file;continue;}}catch{}
    const bytes=await get('portrait/'+path+'/Normal.png');
    if(bytes.length<24||bytes.length>200000||Buffer.from(bytes.buffer,bytes.byteOffset,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Not a portrait');
    await mkdir(dirname(target),{recursive:true});await writeFile(target+'.tmp',bytes);await rename(target+'.tmp',target);
    receipts.push({file,source:RAW+'portrait/'+path+'/Normal.png',sha256:sha(bytes),distribution:'local-reference-only',changes:'Unmodified'});ready[path]=file;
   }catch{failed.push(path);}
  }
 }));
 if(Object.keys(ready).length)await writeFile(receiptsPath,JSON.stringify(receipts)+'\n').catch(()=>{});
 return {ready,failed};
}
