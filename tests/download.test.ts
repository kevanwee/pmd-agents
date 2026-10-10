import test from 'node:test';
import assert from 'node:assert/strict';
import {readBounded} from '../src/download';
test('chunked downloads stop and cancel at the byte limit, without trusting the header',async()=>{
 let cancelled=false,pulls=0;
 const stream=new ReadableStream<Uint8Array>({pull(c){pulls++;c.enqueue(new Uint8Array(4));},cancel(){cancelled=true;}});
 await assert.rejects(readBounded(new Response(stream,{headers:{'content-length':'1'}}),5),/too large/);
 assert.equal(cancelled,true);assert.ok(pulls<=3);
 assert.deepEqual([...await readBounded(new Response(new Uint8Array([1,2,3])),3)],[1,2,3]);
 await assert.rejects(readBounded(new Response('abc',{headers:{'content-length':'100'}}),5),/too large/);
});
