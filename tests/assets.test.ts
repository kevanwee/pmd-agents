import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadPack} from '../src/assets';
import {existsSync} from 'node:fs';
test('local pack has real sheets, frame anchors and hash-matched provenance',{skip:!existsSync('assets/local/manifest.json')},async()=>{
 const p=await loadPack('assets/local');assert.equal(p.sprites.length,12);
 assert.equal(p.dummy?.id,'substitute');assert.ok(p.sprites.find(s=>s.id==='blastoise')?.animations.Shoot);
 const m=JSON.parse(await readFile('assets/local/manifest.json','utf8'));
 for(const f of m.files){assert.equal(createHash('sha256').update(await readFile('assets/local/'+f.file)).digest('hex'),f.sha256);assert.ok(f.source);}
});
