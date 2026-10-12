/** Upgrade an existing local pack without replacing its roster, maps or assignments. */
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadPack,validateSpecies} from '../src/assets';
import {cachedFetch,importSpecies,writeImport,RAW} from '../src/importer';
const output=process.argv.indexOf('--output');
if(output>=0&&!process.argv[output+1])throw Error('--output needs a pack directory');
const root=resolve(output>=0?process.argv[output+1]:'assets/local');
const pack=await loadPack(root),get=cachedFetch(root);
const names=new TextDecoder().decode(await get('spritebot_credits.txt'));
const manifest=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
for(const species of pack.sprites){
 const previous=manifest.sprites.find((s:any)=>s.id===species.id);
 const path=species.form?.path||(typeof previous.source==='string'&&previous.source.startsWith(RAW+'sprite/')?previous.source.slice((RAW+'sprite/').length).replace(/\/$/,''):undefined);
 if(!path)throw Error('No pinned SpriteCollab source for '+species.id);
 const result=await importSpecies({id:species.id,name:species.name,dex:species.dex??Number(path.split('/')[0]),path,label:'Normal',element:species.element,portraitPath:species.portraitFrom},get,names);
 // Keep the user's name and form identity while replacing validated sheets and receipts.
 result.species={...result.species,name:species.name,...(species.form?{form:species.form}:{})};
 await writeImport(root,result,validateSpecies);
 console.log('Updated '+species.id+': '+Object.keys(result.species.animations).join(', '));
}
await loadPack(root);
console.log('Training pack validated. Reload PMD Agents to use the new sheets.');
