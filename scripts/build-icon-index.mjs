// Map every National Dex number to its box icon in Smogon's sprite repository (pinned).
// Gen 6/7-style menu sprites cover every species; Generation VIII and IX icons are the
// community's in the same style (`-vsmogon`). Writes src/smogon-icons.json.
import {writeFile} from 'node:fs/promises';
const REV='bad55c7b7e7292f459366505460d41dcab08d4cd',DATA_REV='c80757193bd0889054e36f4209762360bdaa4b95';
const DIR='src/minisprites/pokemon/gen6';
const json=async url=>{const r=await fetch(url,{headers:{accept:'application/vnd.github+json'}});if(!r.ok)throw Error(r.status+' '+url);return r.json();};
// Walk the tree by hashes: the repository is too large for one recursive listing.
let sha=(await json(`https://api.github.com/repos/smogon/sprites/commits/${REV}`)).commit.tree.sha;
for(const part of DIR.split('/'))sha=(await json(`https://api.github.com/repos/smogon/sprites/git/trees/${sha}`)).tree.find(t=>t.path===part).sha;
const files=new Set((await json(`https://api.github.com/repos/smogon/sprites/git/trees/${sha}`)).tree.map(t=>t.path));
const csv=await (await fetch(`https://raw.githubusercontent.com/PokeAPI/pokeapi/${DATA_REV}/data/v2/csv/pokemon_species.csv`)).text();
const icons={},missing=[];
for(const line of csv.split('\n').slice(1)){
 const [id,identifier]=line.split(',');const dex=Number(id);if(!dex||dex>1025)continue;
 const names=[identifier.replaceAll('-','_'),identifier.replaceAll('-','')];
 const file=names.flatMap(n=>['s'+n+'.png','s'+n+'-vsmogon.png']).find(f=>files.has(f));
 if(file)icons[dex]=file;else missing.push(identifier);
}
if(missing.length||Object.keys(icons).length!==1025)throw Error('No icon for: '+missing.join(', '));
await writeFile('src/smogon-icons.json',JSON.stringify({revision:REV,directory:DIR,icons})+'\n');
console.log('Indexed 1025 box icons at smogon/sprites '+REV.slice(0,7));
