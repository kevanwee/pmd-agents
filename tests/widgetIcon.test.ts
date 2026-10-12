import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ensureWidgetIcon,WIDGET_ICON} from '../src/widgetIcon';
const png=Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,...new Array(32).fill(0)]);
test('the widget icon is fetched once from the pinned SpriteCollab revision into the pack, with a receipt',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pmd-icon-'));const urls:string[]=[];
 try{
  const get=async(url:string)=>{urls.push(url);return png;};
  const path=await ensureWidgetIcon(root,get);
  assert.equal(path,join(root,'icons','appletun-idle.png'));
  assert.match(WIDGET_ICON.url,/^https:\/\/raw\.githubusercontent\.com\/PMDCollab\/SpriteCollab\/[0-9a-f]{40}\/sprite\/0842\/Idle-Anim\.png$/);
  assert.deepEqual(urls,[WIDGET_ICON.url]);
  const receipts=JSON.parse(await readFile(join(root,'icons','receipts.json'),'utf8'));
  assert.equal(receipts[0].file,WIDGET_ICON.file);assert.equal(receipts[0].distribution,'local-reference-only');
  assert.equal(await ensureWidgetIcon(root,get),path);assert.equal(urls.length,1,'a cached icon is not fetched again');
  assert.equal(await ensureWidgetIcon(await mkdtemp(join(tmpdir(),'pmd-icon-')),async()=>{throw Error('offline');}),undefined,'offline keeps the generic icon');
 }finally{await rm(root,{recursive:true,force:true});}
});
