import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,writeFile,mkdir,cp} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {importSpecies,writeImport,ensurePortraits,artistsOf,cachedFetch} from '../src/importer';
import {validateSpecies,loadPack} from '../src/assets';
import {portraitFile} from '../src/dex';
const hasPack=existsSync('assets/local/manifest.json');
/** Serve the pinned files from the local pack instead of the network: Anim sheets live beside the runtime copy, the rest under sources/. */
function localFetch(species:string){
 return async(rel:string)=>{
  const anim=rel.match(/^sprite\/\d{4}\/([A-Za-z]+)-Anim\.png$/);
  const manifest=JSON.parse(await readFile('assets/local/manifest.json','utf8'));
  const entry=manifest.sprites.find((s:any)=>s.id===species);
  const sheet=anim&&Object.values(entry.animations).find((a:any)=>a.file.endsWith('/'+anim[1]+'.png')) as any;
  const path=anim?'assets/local/'+sheet.file:rel.startsWith('portrait/')&&rel.endsWith('Normal.png')?'assets/local/'+species+'/portrait.png':'assets/local/sources/'+rel;
  return new Uint8Array(await readFile(path));
 };
}
test('an in-memory import reproduces the Python importer\'s metadata for Eevee',{skip:!hasPack},async()=>{
 const names=await readFile('assets/local/sources/spritebot_credits.txt','utf8');
 const result=await importSpecies({id:'eevee-check',name:'Eevee',dex:133,path:'0133',label:'Normal',element:'normal'},localFetch('eevee'),names);
 const manifest=JSON.parse(await readFile('assets/local/manifest.json','utf8')),eevee=manifest.sprites.find((s:any)=>s.id==='eevee');
 for(const action of Object.keys(eevee.animations)){
  const {file:_f,...expected}=eevee.animations[action],{file,...actual}=result.species.animations[action];
  assert.deepEqual(actual,expected,action);assert.equal(file,'dex/eevee-check/'+_f.split('/').pop());
 }
 assert.deepEqual(Object.keys(result.species.animations).sort(),Object.keys(eevee.animations).sort());
 assert.deepEqual(result.species.artists,eevee.artists);assert.deepEqual(result.species.portraitCredits,eevee.portraitCredits);
 assert.equal(result.species.shadow,1);assert.equal(result.species.name,'Eevee');assert.deepEqual(result.species.form,{path:'0133',label:'Normal'});
 assert.ok(result.files.every(f=>f.source.startsWith('https://raw.githubusercontent.com/PMDCollab/SpriteCollab/47e5b9920bc5b2b491c53b18076300dc6813f103/')&&/^[0-9a-f]{64}$/.test(f.sha256)));
 assert.ok(Object.keys(result.written).includes('dex/eevee-check/Idle.png')&&Object.keys(result.written).includes('sources/sprite/0133/Idle-Shadow.png'));
 assert.rejects(importSpecies({id:'Bad Id',name:'x',dex:1,path:'0001',label:''},localFetch('eevee'),names),/Invalid import request/);
});
test('writing an import validates it, appends receipts and keeps the manifest loadable',{skip:!hasPack},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pmd-pack-'));
 try{
  await cp('assets/local/maps',join(dir,'maps'),{recursive:true});await cp('assets/local/eevee',join(dir,'eevee'),{recursive:true});await cp('assets/local/substitute',join(dir,'substitute'),{recursive:true});
  await writeFile(join(dir,'PixelifySans.woff2'),await readFile('assets/local/PixelifySans.woff2'));
  const full=JSON.parse(await readFile('assets/local/manifest.json','utf8'));
  const portrait=full.sprites.find((s:any)=>s.id==='eevee').portrait;await mkdir(dirname(join(dir,portrait)),{recursive:true});await cp(join('assets/local',portrait),join(dir,portrait));
  for(const a of Object.values(full.sprites.find((s:any)=>s.id==='eevee').animations) as any[]){await mkdir(dirname(join(dir,a.file)),{recursive:true});await cp(join('assets/local',a.file),join(dir,a.file));}
  await writeFile(join(dir,'manifest.json'),JSON.stringify({version:1,sprites:full.sprites.filter((s:any)=>s.id==='eevee'),dummy:full.dummy,maps:full.maps,files:[]}));
  const names=await readFile('assets/local/sources/spritebot_credits.txt','utf8');
  const result=await importSpecies({id:'eevee-shiny',name:'Eevee',dex:133,path:'0133',label:'Shiny'},localFetch('eevee'),names);
  const manifest=await writeImport(dir,result,validateSpecies);
  assert.deepEqual(manifest.sprites.map(s=>s.id),['eevee','eevee-shiny']);assert.equal(manifest.sprites[1].name,'Eevee (Shiny)');
  assert.ok(manifest.files!.some(f=>f.file==='dex/eevee-shiny/Walk.png'));
  const pack=await loadPack(dir);assert.equal(pack.sprites.length,2);
  // A repeat import replaces the entry without duplicating receipts.
  const again=await writeImport(dir,result,validateSpecies);assert.equal(again.sprites.length,2);assert.equal(again.files!.length,manifest.files!.length);
  // Portrait fetches are cached per file and failures are reported, never thrown.
  const calls:string[]=[];
  const get=async(rel:string)=>{calls.push(rel);if(rel.includes('9999'))throw Error('offline');return new Uint8Array(await readFile('assets/local/eevee/portrait.png'));};
  const first=await ensurePortraits(dir,['0133','9999'],get,portraitFile);
  assert.deepEqual(first,{ready:{'0133':'dex/portraits/0133.png'},failed:['9999']});
  const second=await ensurePortraits(dir,['0133'],get,portraitFile);assert.deepEqual(second.ready,{'0133':'dex/portraits/0133.png'});
  assert.equal(calls.filter(c=>c.includes('0133')).length,1,'cached portraits are not fetched twice');
  assert.equal(JSON.parse(await readFile(join(dir,'dex','portraits.json'),'utf8')).length,1);
  // The source cache serves pinned files before any network request.
  await mkdir(join(dir,'sources','sprite','0133'),{recursive:true});await writeFile(join(dir,'sources','sprite','0133','credits.txt'),'cached');
  const cached=cachedFetch(dir,async()=>new Uint8Array([1]));
  assert.equal(new TextDecoder().decode(await cached('sprite/0133/credits.txt')),'cached');assert.deepEqual([...await cached('sprite/0133/other.txt')],[1]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('credit lines resolve through spritebot names and keep unknown ids',()=>{
 const names='Audino\tDiscord:<@!117780585635643396>\tContact:x\n';
 assert.deepEqual(artistsOf('2020-10-07\tCHUNSOFT\tCUR\tUnspecified\tWalk\n2021-01-01\t<@!117780585635643396>\tCUR\tUnspecified\tIdle\n2021-01-02\t<@!117780585635643396>\tOLD\t\tIdle\n',names),['CHUNSOFT','Audino']);
});
