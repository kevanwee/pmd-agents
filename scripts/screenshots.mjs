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
 // The storage system with a demo catalog: the real tracker is not fetched for screenshots.
 await page.locator('.team-row').filter({hasText:'Charizard'}).click();
 await page.getByRole('button',{name:/Open the Pokémon storage system/}).click();
 const names=['Bulbasaur','Ivysaur','Venusaur','Charmander','Charmeleon','Charizard','Squirtle','Wartortle','Blastoise','Caterpie','Metapod','Butterfree','Weedle','Kakuna','Beedrill','Pidgey','Pidgeotto','Pidgeot','Rattata','Raticate','Spearow','Fearow','Ekans','Arbok','Pikachu','Raichu','Sandshrew','Sandslash','Nidoran F','Nidorina'];
 const species=names.map((name,i)=>({dex:i+1,name,id:name.toLowerCase().replace(/ /g,'-'),forms:[{path:String(i+1).padStart(4,'0'),label:'Normal',id:name.toLowerCase().replace(/ /g,'-'),ready:true,portrait:true,complete:2,credit:'CHUNSOFT',actions:36},{path:String(i+1).padStart(4,'0')+'/0000/0001',label:'Shiny',id:name.toLowerCase().replace(/ /g,'-')+'-shiny',ready:true,portrait:true,complete:2,credit:'SpriteCollab contributor',actions:0}]}));
 await page.evaluate(s=>window.postMessage({type:'dex',dex:{version:1,revision:'47e5b9920bc5b2b491c53b18076300dc6813f103',built:'2026-10-10T00:00:00.000Z',species:s}},'*'),species);
 await page.locator('.pc-slot').first().waitFor();await page.getByRole('searchbox').fill('#4');await page.getByRole('searchbox').press('Enter');
 await page.locator('.pc-slot[aria-pressed=true]').click();await page.getByRole('button',{name:'Forms (2)',exact:true}).click();await page.waitForTimeout(300);
 await page.screenshot({path:'docs/screenshots/storage.png'});await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 await page.getByRole('combobox',{name:'Friend area'}).selectOption('meadow');await page.getByRole('combobox',{name:'Friend area'}).blur();
 await page.getByRole('button',{name:'Walkable area',exact:true}).click();await page.waitForTimeout(1500);await page.screenshot({path:'docs/screenshots/meadow-routes.png'});
 console.log('Captured six labelled demo screenshots without real session data.');
}finally{await browser.close();preview.close();}
