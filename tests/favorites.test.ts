import test from 'node:test';
import assert from 'node:assert/strict';
import {assignSpawns,pickSpawn,sanitizeFavorites} from '../src/favorites';

const pack=['eevee','riolu','ceruledge','appletun','diancie','squirtle','charmander'];

test('favourites spawn first, in order, skipping ones already on the team',()=>{
 assert.equal(pickSpawn(['appletun','diancie'],pack,[]),'appletun');
 assert.equal(pickSpawn(['appletun','diancie'],pack,['appletun']),'diancie');
 // A favourite that is not in the pack yet is skipped, not invented.
 assert.equal(pickSpawn(['umbreon','squirtle'],pack,[]),'squirtle');
});

test('past the favourites pool, spawns are random among unused species, then any species',()=>{
 const seen=new Set<string>();
 for(let i=0;i<200;i++){const r=(i%50)/50;seen.add(pickSpawn(['appletun'],pack,['appletun'],()=>r)!);}
 assert.ok(!seen.has('appletun'));assert.equal(seen.size,pack.length-1,'every unused species can appear');
 assert.ok(pack.includes(pickSpawn([],pack,pack,()=>.99)!),'a full team still gets a Pokémon');
 assert.equal(pickSpawn([],[],[]),undefined);
});

test('a new team is no longer always Eevee or Riolu',()=>{
 const assignments:Record<string,string>={};
 assignSpawns(['a','b','c','d','e'],assignments,[],pack,(()=>{let s=7;return ()=>(s=(s*16807)%2147483647)/2147483647;})());
 assert.equal(new Set(Object.values(assignments)).size,5,'five teammates, five different Pokémon');
});

test('assignments review the active team and keep existing choices',()=>{
 const assignments:Record<string,string>={a:'appletun',gone:'diancie'};
 const changed=assignSpawns(['a','b','c'],assignments,['appletun','diancie','squirtle'],pack);
 assert.equal(changed,true);
 // Diancie's session ended, so it is free again; Appletun stays with its teammate.
 assert.deepEqual([assignments.a,assignments.b,assignments.c],['appletun','diancie','squirtle']);
 assert.equal(assignSpawns(['a','b','c'],assignments,['appletun'],pack),false,'stable once assigned');
 // A choice whose sheets left the pack is replaced.
 const stale:Record<string,string>={x:'missingno'};assignSpawns(['x'],stale,['eevee'],pack);assert.equal(stale.x,'eevee');
});

test('favourites settings are sanitised',()=>{
 assert.deepEqual(sanitizeFavorites(['appletun','appletun','Bad Id',3,'pawmot-shiny']),['appletun','pawmot-shiny']);
 assert.deepEqual(sanitizeFavorites('appletun'),[]);
});
