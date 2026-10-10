/** Fetch every main-series box icon, front sprite and shiny front (PokeAPI sprites, pinned) plus type data into the local pack. */
import {resolve} from 'node:path';
import {allGameAssets,ensureFiles,fetchUrl,loadTypes} from '../src/gamedata';
const root=resolve(process.argv[2]||'assets/local');
const types=await loadTypes(root,fetchUrl);
console.log(`Types for ${Object.keys(types).length} species → ${resolve(root,'game/types.json')}`);
const items=allGameAssets();let last=0;
const result=await ensureFiles(root,items,fetchUrl,'game/receipts.json',8,done=>{if(done-last>=200||done===items.length){last=done;console.log(`${done} / ${items.length}`);}});
console.log(`Ready ${Object.keys(result.ready).length}, failed ${result.failed.length}${result.failed.length?': '+result.failed.slice(0,10).join(', '):''}`);
