import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {startPreview} from '../tests/preview-server.mjs';
const preview=await startPreview();
const browser=await chromium.launch({headless:true});
try{
 await mkdir('docs/screenshots',{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 await page.goto(preview.url);
 await page.getByRole('button',{name:'Try demo',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('canvas').dataset.actors==='3');
 await page.waitForTimeout(1800);
 await page.screenshot({path:'docs/screenshots/guild.png'});
 await page.getByRole('button',{name:'Activity',exact:true}).click();
 await page.setViewportSize({width:538,height:1040});
 await page.screenshot({path:'docs/screenshots/activity.png',fullPage:true});
 await page.getByRole('button',{name:'Credits',exact:true}).click();
 await page.screenshot({path:'docs/screenshots/credits.png',fullPage:true});
 await page.setViewportSize({width:1440,height:960});await page.getByRole('button',{name:'Team',exact:true}).click();
 for(const [from,to] of [['Eevee','charizard'],['Riolu','blastoise'],['Ceruledge','venusaur']]){
  await page.locator('.team-row').filter({hasText:from}).click();await page.getByRole('combobox',{name:'Pokémon for selected session'}).selectOption(to);
 }
 await page.locator('.team-row').filter({hasText:'Charizard'}).click();
 await page.waitForTimeout(1400);await page.screenshot({path:'docs/screenshots/kanto.png'});
 await page.getByRole('combobox',{name:'Friend area'}).selectOption('meadow');await page.getByRole('combobox',{name:'Friend area'}).blur();
 await page.getByRole('button',{name:'Walkable area',exact:true}).click();await page.waitForTimeout(1500);await page.screenshot({path:'docs/screenshots/meadow-routes.png'});
 console.log('Captured five labelled demo screenshots without real session data.');
}finally{await browser.close();preview.close();}
