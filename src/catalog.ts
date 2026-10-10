import {readFile,rename,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildDex,validDex,type Dex} from './dex';
import {fetchPinned,REV,type Fetch} from './importer';
/** The pack's dex.json, built once from the pinned tracker and credits list. The tracker itself (about 10 MB) is not kept. */
export async function loadDex(root:string,get:Fetch=fetchPinned,refresh=false):Promise<Dex> {
 const path=resolve(root,'dex.json');
 if(!refresh){
  try{if((await stat(path)).size<=8_000_000){const dex=JSON.parse(await readFile(path,'utf8'));if(validDex(dex)&&dex.revision===REV)return dex;}}catch{}
 }
 const tracker=JSON.parse(new TextDecoder().decode(await get('tracker.json')));
 const credits=new TextDecoder().decode(await get('spritebot_credits.txt'));
 const dex=buildDex(tracker,credits,REV);
 if(!validDex(dex))throw Error('The SpriteCollab tracker could not be reduced to a catalog');
 await writeFile(path+'.tmp',JSON.stringify(dex)+'\n');await rename(path+'.tmp',path);
 return dex;
}
export const trackerFetch:Fetch=rel=>fetchPinned(rel,rel==='tracker.json'?40_000_000:4_000_000);
