import {atomicWrite,mergeReceipts} from './storage';
import {readBounded} from './download';
import {createHash} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import type {Receipt,Fetch} from './importer';
/** Main-series game sprites and box icons come from PokeAPI's sprite repository, and types from PokeAPI's CSV data, both pinned. */
export const SPRITES_REV='35fdbe9bdec8f519f882c3edc3c0185f08af4d86';
export const DATA_REV='c80757193bd0889054e36f4209762360bdaa4b95';
export const SPRITES_RAW=`https://raw.githubusercontent.com/PokeAPI/sprites/${SPRITES_REV}/sprites/`;
export const DATA_RAW=`https://raw.githubusercontent.com/PokeAPI/pokeapi/${DATA_REV}/data/v2/csv/`;
/** Generation VIII box icons stop at Calyrex; later species fall back to a scaled front sprite in the view. */
export const LAST_ICON=898;
export const LAST_DEX=1025;
export const TYPES=['normal','fire','water','grass','electric','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];
export type GameTypes=Record<string,string[]>;
export interface GameAsset {key:string;url:string;file:string;limit?:number}
const pad=(n:number)=>String(n).padStart(4,'0');
/** The two or three files the storage view shows per species: box icon, front sprite and its shiny. */
export function gameAssets(dex:number):GameAsset[] {
 if(!Number.isInteger(dex)||dex<1||dex>LAST_DEX)return [];
 const out:GameAsset[]=[{key:'front:'+pad(dex),url:SPRITES_RAW+'pokemon/'+dex+'.png',file:'game/front/'+pad(dex)+'.png'},{key:'shiny:'+pad(dex),url:SPRITES_RAW+'pokemon/shiny/'+dex+'.png',file:'game/shiny/'+pad(dex)+'.png'}];
 if(dex<=LAST_ICON)out.unshift({key:'icon:'+pad(dex),url:SPRITES_RAW+'pokemon/versions/generation-viii/icons/'+dex+'.png',file:'game/icons/'+pad(dex)+'.png'});
 return out;
}
/** Fetch one URL with a size bound. */
export async function fetchUrl(url:string,limit=4_000_000):Promise<Uint8Array> {
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('Source returned '+response.status+' for '+url);
 return readBounded(response,limit);
}
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
/** Fetch missing files into the pack with receipts; existing files are served from disk. Download failures are reported per file; receipt persistence failures are thrown. */
export async function ensureFiles(root:string,items:GameAsset[],get:(url:string,limit?:number)=>Promise<Uint8Array>,receiptsFile:string,concurrency=6,onProgress?:(done:number)=>void){
 const ready:Record<string,string>={},failed:string[]=[];
 const receiptsPath=resolve(root,receiptsFile);const receipts:Receipt[]=[];
 const queue=[...items];let done=0,added=0;
 await Promise.all(Array.from({length:concurrency},async()=>{
  for(let item=queue.shift();item!==undefined;item=queue.shift()){
   const target=resolve(root,item.file);
   try{
    if(!/^[-a-zA-Z0-9_./]+$/.test(item.file)||item.file.includes('..')||item.file.startsWith('/'))throw Error('Invalid pack path');
    try{if((await stat(target)).isFile()){ready[item.key]=item.file;continue;}}catch{}
    const bytes=await get(item.url,item.limit||400000);
    if(bytes.length<24||Buffer.from(bytes.buffer,bytes.byteOffset,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Not a PNG');
    await atomicWrite(target,bytes);
    receipts.push({file:item.file,source:item.url,sha256:sha(bytes),distribution:'local-reference-only',changes:'Unmodified'});added++;ready[item.key]=item.file;
   }catch{failed.push(item.key);}
   finally{done++;onProgress?.(done);}
  }
 }));
 if(added)await mergeReceipts(receiptsPath,receipts);
 return {ready,failed};
}
/** Parse PokeAPI's pokemon.csv, pokemon_types.csv and types.csv into National Dex number → type names. */
export function parseTypes(pokemonCsv:string,pokemonTypesCsv:string,typesCsv:string):GameTypes {
 const rows=(csv:string)=>csv.split('\n').slice(1).map(l=>l.trim().split(',')).filter(f=>f.length>1);
 const typeNames=new Map(rows(typesCsv).map(f=>[f[0],f[1]]));
 const species=new Map<string,number>();
 for(const f of rows(pokemonCsv)){const id=Number(f[0]),speciesId=Number(f[2]);if(id===speciesId&&id>=1&&id<=LAST_DEX)species.set(f[0],id);}
 const out:GameTypes={};
 for(const f of rows(pokemonTypesCsv)){
  const dex=species.get(f[0]),name=typeNames.get(f[1]);if(!dex||!name||!TYPES.includes(name))continue;
  (out[pad(dex)]??=[])[Number(f[2])-1]=name;
 }
 for(const k of Object.keys(out))out[k]=out[k].filter(Boolean);
 return out;
}
export const validTypes=(x:unknown):x is GameTypes=>!!x&&typeof x==='object'&&Object.entries(x as object).every(([k,v])=>/^\d{4}$/.test(k)&&Array.isArray(v)&&v.length>=1&&v.length<=2&&v.every(t=>TYPES.includes(t)));
/** The pack's game/types.json, built once from the pinned CSVs. */
export async function loadTypes(root:string,get:(url:string,limit?:number)=>Promise<Uint8Array>=fetchUrl):Promise<GameTypes> {
 const path=resolve(root,'game','types.json');
 try{const saved=JSON.parse(await readFile(path,'utf8'));if(saved?.revision===DATA_REV&&validTypes(saved.types)&&Object.keys(saved.types).length>=1000)return saved.types;}catch{}
 const text=async(name:string)=>new TextDecoder().decode(await get(DATA_RAW+name,2_000_000));
 const types=parseTypes(await text('pokemon.csv'),await text('pokemon_types.csv'),await text('types.csv'));
 if(!validTypes(types)||Object.keys(types).length<1000)throw Error('PokeAPI type data could not be parsed');
 await atomicWrite(path,JSON.stringify({revision:DATA_REV,source:DATA_RAW,licence:'PokeAPI data, BSD-3-Clause',types})+'\n');
 return types;
}
/** Every species' icon, front and shiny front: about 2,900 files at the pinned revision. */
export function allGameAssets(){const out:GameAsset[]=[];for(let dex=1;dex<=LAST_DEX;dex++)out.push(...gameAssets(dex));return out;}
