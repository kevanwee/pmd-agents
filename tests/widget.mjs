import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {startPreview} from './preview-server.mjs';
const preview=await startPreview(),browser=await chromium.launch({headless:true});
try {
 for(const presentation of ['widget','desktop']){
  const page=await browser.newPage({viewport:{width:260,height:240}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.sent=[];window.acquireVsCodeApi=()=>({postMessage:m=>window.sent.push(m),getState:()=>({}),setState:()=>{}});});
  await page.route(preview.url,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('<script src="/media/app.js">',`<script>window.PMD_BOOT.presentation='${presentation}'</script><script src="/media/app.js">`)});});
  await page.goto(preview.url);
  await page.locator('.widget-toolbar').waitFor();
  await page.locator('#empty button').click();assert.equal((await page.evaluate(()=>window.sent)).at(-1).type,'openGuild','empty widget routes to usable full controls');
  await page.evaluate(()=>window.postMessage({type:'snapshot',scene:'volcanicpit',quiet:false,agents:[{id:'fixture',provider:'codex',attached:true,activity:'working',attention:'none',outcome:'',ended:false,lastSeen:Date.now(),tools:{}}]},'*'));
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.actors==='1'&&document.querySelector('canvas').dataset.map==='volcanicpit');
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true,'compact layout fits without scrollbars');
  const rect=await page.locator('canvas').boundingBox();assert.ok(rect.height>=150&&rect.width>=250,'map owns most of the compact widget');
  const initial=await page.locator('canvas').evaluate(c=>c.toDataURL());await page.waitForFunction(previous=>document.querySelector('canvas').toDataURL()!==previous,initial);
  await page.locator('#widget-quiet').click();assert.equal((await page.evaluate(()=>window.sent)).at(-1).type,'quiet');
  const frozen=await page.locator('canvas').getAttribute('data-world-time');await page.waitForTimeout(300);assert.equal(await page.locator('canvas').getAttribute('data-world-time'),frozen);
  await page.evaluate(()=>window.postMessage({type:'snapshot',scene:'forest',quiet:false,agents:window.PMD_BOOT.agents},'*'));
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.map==='forest');assert.equal(await page.locator('#widget-quiet').getAttribute('aria-pressed'),'false');
  await page.locator('#widget-open').click();assert.equal((await page.evaluate(()=>window.sent)).at(-1).type,'openGuild');
  if(presentation==='widget'){await page.locator('#widget-desktop').click();assert.equal((await page.evaluate(()=>window.sent)).at(-1).type,'desktop');}
  else assert.equal(await page.locator('#widget-desktop').count(),0);
  await page.screenshot({path:`artifacts/${presentation}-compact.png`});assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: compact layouts, live session feed, native scenery motion, shared preferences and actionable controls.');
}finally{await browser.close();preview.close();}
