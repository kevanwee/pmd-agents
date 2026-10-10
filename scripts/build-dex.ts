/** Build or refresh the pack's living Pokédex catalog (dex.json) from the pinned SpriteCollab tracker. */
import {resolve} from 'node:path';
import {loadDex,trackerFetch} from '../src/catalog';
const root=resolve(process.argv[2]||'assets/local');
const dex=await loadDex(root,trackerFetch,true);
const forms=dex.species.reduce((n,s)=>n+s.forms.length,0),ready=dex.species.reduce((n,s)=>n+s.forms.filter(f=>f.ready).length,0);
console.log(`Catalog ${dex.revision.slice(0,7)}: ${dex.species.length} species, ${forms} drawn forms, ${ready} with Idle/Walk/Attack/Sleep → ${resolve(root,'dex.json')}`);
