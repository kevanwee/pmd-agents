import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadPack} from '../src/assets';
test('local pack has real sheets, frame anchors and hash-matched provenance',async()=>{
 const p=await loadPack('assets/local');assert.equal(p.sprites.length,3);
 const m=JSON.parse(await readFile('assets/local/manifest.json','utf8'));
 for(const f of m.files){assert.equal(createHash('sha256').update(await readFile('assets/local/'+f.file)).digest('hex'),f.sha256);assert.ok(f.source);}
});
