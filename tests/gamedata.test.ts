import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gameAssets,parseTypes,validTypes,ensureFiles,allGameAssets,LAST_ICON} from '../src/gamedata';
test('game assets name pinned PokeAPI files and skip icons the source does not have',()=>{
 assert.deepEqual(gameAssets(25).map(a=>[a.key,a.file]),[['icon:0025','game/icons/0025.png'],['front:0025','game/front/0025.png'],['shiny:0025','game/shiny/0025.png']]);
 assert.ok(gameAssets(25)[0].url.endsWith('/sprites/pokemon/versions/generation-viii/icons/25.png'));
 assert.deepEqual(gameAssets(LAST_ICON+1).map(a=>a.key),['front:0899','shiny:0899'],'Generation IX species have no Generation VIII icon');
 assert.deepEqual(gameAssets(0),[]);assert.deepEqual(gameAssets(1026),[]);
 assert.equal(allGameAssets().length,1025*2+LAST_ICON);
});
test('types come from the CSV trio, keyed by National Dex number in slot order',()=>{
 const pokemon='id,identifier,species_id,height,weight,base_experience,order,is_default\n1,bulbasaur,1,7,69,64,1,1\n6,charizard,6,17,905,267,7,1\n10034,charizard-mega-x,6,17,1105,285,8,0\n';
 const pokemonTypes='pokemon_id,type_id,slot\n1,4,2\n1,12,1\n6,10,1\n6,3,2\n10034,10,1\n10034,16,2\n';
 const types='id,identifier,generation_id,damage_class_id\n3,flying,1,2\n4,poison,1,2\n10,fire,1,3\n12,grass,1,3\n16,dragon,1,3\n';
 const parsed=parseTypes(pokemon,pokemonTypes,types);
 assert.deepEqual(parsed,{'0001':['grass','poison'],'0006':['fire','flying']},'alternate forms are not species');
 assert.ok(validTypes(parsed));assert.equal(validTypes({'0001':['plasma']}),false);
});
test('ensureFiles caches, writes receipts and reports failures without throwing',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pmd-game-'));
 try{
  const png=await readFile('assets/local/eevee/portrait.png').catch(()=>undefined);
  if(!png)return;
  const calls:string[]=[];
  const get=async(url:string)=>{calls.push(url);if(url.includes('/9999'))throw Error('offline');return new Uint8Array(png);};
  const items=[...gameAssets(25),{key:'front:9999',url:'https://example.invalid/9999.png',file:'game/front/9999.png'}];
  let progress=0;
  const first=await ensureFiles(dir,items,get,'game/receipts.json',2,()=>progress++);
  assert.deepEqual(Object.keys(first.ready).sort(),['front:0025','icon:0025','shiny:0025']);assert.deepEqual(first.failed,['front:9999']);assert.equal(progress,4);
  const second=await ensureFiles(dir,gameAssets(25),get,'game/receipts.json');
  assert.equal(Object.keys(second.ready).length,3);assert.equal(calls.length,4,'cached files are not fetched again');
  assert.equal(JSON.parse(await readFile(join(dir,'game','receipts.json'),'utf8')).length,3);
  const escaped=await ensureFiles(dir,[{key:'x',url:'https://example.invalid/x.png',file:'../x.png'}],get,'game/receipts.json');
  assert.deepEqual(escaped.failed,['x']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
