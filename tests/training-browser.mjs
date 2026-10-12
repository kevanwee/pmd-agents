import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {startPreview} from './preview-server.mjs';
const preview=await startPreview(),browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(preview.url);
 // Exercise different native sheets in the rendered canvas, not just the timing helper.
 for(const [id,expected] of [['riolu','QuickStrike'],['ceruledge','MultiStrike'],['riolu','SpAttack']]){
  await page.evaluate(id=>window.postMessage({type:'snapshot',scene:'forest',quiet:false,agents:[{id,provider:'codex',attached:true,activity:'editing',attention:'none',outcome:'',ended:false,lastSeen:Date.now(),tools:{}}],assignments:{[id]:id}},'*'),id);
  await page.waitForFunction(expected=>JSON.parse(document.querySelector('canvas').dataset.training||'[]').some(a=>a.action===expected),expected,{timeout:14000});
  await page.screenshot({path:'artifacts/training-'+id+'-'+expected+'.png'});
 }
 await page.evaluate(()=>window.postMessage({type:'snapshot',agents:[{id:'riolu',provider:'codex',attached:true,activity:'editing',attention:'approval',outcome:'',ended:false,lastSeen:Date.now(),tools:{}}]},'*'));
 await page.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.training||'[]').every(a=>a.action==='Idle'&&!a.hit&&a.projectile===undefined));
 assert.deepEqual(errors,[]);
 console.log('Native QuickStrike, MultiStrike and SpAttack render; approval stops training.');
}finally{await browser.close();preview.close();}
