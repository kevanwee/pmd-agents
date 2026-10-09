import test from 'node:test';
import assert from 'node:assert/strict';
import {Placement} from '../src/placement';
test('joins, removals and roster sorting never move existing teammates',()=>{
 const p=new Placement();p.sync(['a','b','c']);assert.equal(p.slots.get('b'),1);
 p.sync(['c','b']);assert.equal(p.slots.get('b'),1);assert.equal(p.slots.get('c'),2);
 p.sync(['d','b','c']);assert.equal(p.slots.get('d'),0);assert.equal(p.slots.get('b'),1);
});
test('sparse clearings remain reachable and new arrivals reuse free positions',()=>{
 const p=new Placement(),ids=Array.from({length:14},(_,n)=>'s'+n);p.sync(ids);
 assert.deepEqual(p.pages(),[0,1,2]);p.sync(['s6','s13']);assert.deepEqual(p.pages(),[1,2]);
 assert.deepEqual(p.onPage(['s6','s13'],2),['s13']);p.sync(['s6','s13','new']);
 assert.deepEqual(p.pages(),[0,1,2]);assert.equal(p.slots.get('new'),0);assert.equal(p.slots.get('s13'),13);
 assert.equal(new Set(p.slots.values()).size,p.slots.size);
});
