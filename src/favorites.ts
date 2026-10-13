/** Favourites: an ordered list of Pokédex form ids the guild spawns first. Pure, so the host and tests share it. */
const ID=/^[a-z0-9-]{1,48}$/;
export const MAX_FAVORITES=200;

/** A clean favourites list: known id shape, no repeats, original order kept. */
export function sanitizeFavorites(value:unknown):string[]{
 if(!Array.isArray(value))return [];
 const out:string[]=[];
 for(const id of value)if(typeof id==='string'&&ID.test(id)&&!out.includes(id)&&out.length<MAX_FAVORITES)out.push(id);
 return out;
}

/** The Pokémon for a newly spawned teammate: the first favourite in the pack that no active teammate is using, then a random
 *  species nobody is using, then any species when every one is taken. Undefined only for an empty pack. */
export function pickSpawn(favorites:readonly string[],available:readonly string[],inUse:Iterable<string>,random:()=>number=Math.random):string|undefined{
 const have=new Set(available),taken=new Set(inUse);
 for(const id of favorites)if(have.has(id)&&!taken.has(id))return id;
 const free=available.filter(id=>!taken.has(id)),pool=free.length?free:[...available];
 return pool.length?pool[Math.min(pool.length-1,Math.floor(random()*pool.length))]:undefined;
}

/** Give every active teammate without a valid Pokémon one, in arrival order, reviewing who is already on the team first.
 *  Returns true when any assignment changed. */
export function assignSpawns(active:readonly string[],assignments:Record<string,string>,favorites:readonly string[],available:readonly string[],random:()=>number=Math.random):boolean{
 const have=new Set(available),inUse=new Set<string>();
 for(const id of active){const species=assignments[id];if(species&&have.has(species))inUse.add(species);}
 let changed=false;
 for(const id of active){
  if(assignments[id]&&have.has(assignments[id]))continue;
  const species=pickSpawn(favorites,available,inUse,random);if(!species)break;
  assignments[id]=species;inUse.add(species);changed=true;
 }
 return changed;
}
