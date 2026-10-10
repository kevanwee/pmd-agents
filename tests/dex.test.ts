import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDex,boxOf,findSpecies,portraitPath,validDex,slug,creditName,portraitFile} from '../src/dex';
const files=(on:boolean,names=['Walk','Attack','Sleep','Idle','Shoot','Hurt'])=>Object.fromEntries(names.map(n=>[n,on]));
const node=(name:string,sprite:Record<string,boolean>,portrait:boolean,credit='',subgroups:Record<string,any>={},canon=true)=>({name,canon,sprite_complete:Object.values(sprite).some(Boolean)?2:0,portrait_complete:portrait?2:0,sprite_files:sprite,portrait_files:portrait?{Normal:true,Happy:true}:{},sprite_credit:{primary:credit,secondary:[],total:credit?1:0},subgroups});
const credits='Audino\tDiscord:<@!117780585635643396>\tContact:x\nKevin\tDiscord:<@!555>\tContact:y\n';
const tracker={
 '0000':node('Missingno_',files(true),true,'',{},false),
 '0025':node('Pikachu',files(true),true,'CHUNSOFT',{
  // The shiny recolour is phase 2 in the tracker but, like every recolour, has no per-file flags.
  '0000':node('',{},false,'',{'0000':node('',{},false,'',{'0002':node('Female',files(true),false,'<@!555>')}),'0001':{...node('Shiny',files(false),true,'<@!117780585635643396>',{'0002':node('Female',files(true),false,'<@!555>')}),sprite_complete:2}}),
  '0001':node('Gigantamax',{},true),
  '0002':node('Rock_Star',files(false),false),
  '0007':node('Cosplay',files(true,['Walk','Attack','Sleep','Idle']),false,'<@!999>'),
 }),
 '0029':node('Nidoran',files(true),true,'CHUNSOFT'),
 '0032':node('Nidoran',files(true),true,'CHUNSOFT'),
 '0122':node('Mr_Mime',files(true),true,'CHUNSOFT'),
 '0133':node('Eevee',files(true),true,'CHUNSOFT'),
};
test('builds National Dex order with forms, availability from file flags and resolved credits',()=>{
 const dex=buildDex(tracker as any,credits,'rev',  '2026-10-10T00:00:00.000Z');
 assert.ok(validDex(dex));
 assert.deepEqual(dex.species.map(s=>s.dex),[25,29,32,122,133],'Missingno is not canon');
 assert.equal(dex.species[3].name,'Mr Mime');assert.equal(dex.species[3].id,'mr-mime');
 const pikachu=dex.species[0];
 assert.deepEqual(pikachu.forms.map(f=>[f.path,f.label,f.id,f.ready,f.portrait]),[
  ['0025','Normal','pikachu',true,true],
  ['0025/0000/0000/0002','Female','pikachu-female',true,false],
  ['0025/0000/0001','Shiny','pikachu-shiny',true,true],
  ['0025/0000/0001/0002','Shiny Female','pikachu-shiny-female',true,false],
  ['0025/0001','Gigantamax','pikachu-gigantamax',false,true],
  ['0025/0007','Cosplay','pikachu-cosplay',true,false],
 ],'empty containers and undrawn forms are skipped; Rock Star has no files at all');
 assert.equal(pikachu.forms[2].credit,'Audino');assert.equal(pikachu.forms[1].credit,'Kevin');assert.equal(pikachu.forms[5].credit,'<@!999>','unknown ids stay as written');
 assert.equal(pikachu.forms[0].actions,6);assert.equal(pikachu.forms[2].actions,0,'recolours list no files, yet are ready');assert.equal(pikachu.forms[2].complete,2);
 assert.deepEqual(dex.species.slice(1,3).map(s=>s.id),['nidoran-29','nidoran-32'],'colliding names carry their number');
 assert.equal(portraitPath(pikachu,'0025/0000/0001/0002'),'0025/0000/0001','a female variant borrows the nearest drawn portrait');
 assert.equal(portraitPath(pikachu,'0025/0007'),'0025');
 assert.equal(portraitFile('0025/0000/0001'),'dex/portraits/0025-0000-0001.png');
});
test('boxes hold thirty species and search accepts names or numbers',()=>{
 const many:Record<string,any>={...tracker};for(let n=1;n<=64;n++)many[String(n).padStart(4,'0')]=node('Mon'+n,files(true),true);
 const dex=buildDex(many as any,credits,'rev');
 assert.equal(boxOf(dex,0).count,3);assert.equal(boxOf(dex,0).species.length,30);assert.equal(boxOf(dex,2).species.length,dex.species.length-60);
 assert.equal(boxOf(dex,-1).index,2,'box navigation wraps');assert.equal(boxOf(dex,3).index,0);
 assert.equal(findSpecies(dex,'#133')?.name,'Eevee');assert.equal(findSpecies(dex,'eev')?.name,'Eevee');assert.equal(findSpecies(dex,'')?.name,undefined);
 assert.equal(findSpecies(dex,'mon6')?.dex,6);
 assert.equal(slug('Mr. Mime'),'mr-mime');assert.equal(slug('Flabébé'),'flabebe');assert.equal(slug("Farfetch'd"),'farfetch-d');
 assert.equal(creditName('<@!555>',credits),'Kevin');assert.equal(creditName('',credits),'');
 assert.equal(validDex({version:1,revision:'r',species:[{dex:1,name:'A',id:'a',forms:[{path:'bad',label:'',id:'a',ready:true,portrait:true,credit:''}]}]}),false);
});
