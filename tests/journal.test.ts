import test from 'node:test';
import assert from 'node:assert/strict';
import {ActivityJournal,journalText} from '../src/journal';
import {Sessions} from '../src/sessions';
import type {Event} from '../src/core';
const event=(n:number,kind:Event['kind'],extra:Partial<Event>={}):Event=>({v:1,id:'e'+n,session:'codex:a',provider:'codex',kind,at:Date.now()+n,...extra});
test('journal stores only observation enums, never prompts, tool arguments or IDs',()=>{
 const journal=new ActivityJournal();
 journal.record({...event(1,'tool-start',{tool:'sensitive-id',activity:'editing'}),prompt:'secret',arguments:'secret'} as Event,'hook');
 const entries=journal.snapshot()['codex:a'];assert.deepEqual(Object.keys(entries[0]).sort(),['activity','at','kind','source']);
 assert.equal(journalText(entries[0],'codex'),'Editing started');assert.ok(!JSON.stringify(entries).includes('secret'));assert.ok(!JSON.stringify(entries).includes('sensitive'));
});
test('journal bounds history, coalesces generation pulses and drops evicted sessions',()=>{
 const journal=new ActivityJournal();for(let n=0;n<100;n++)journal.record(event(n,'tool-end'),'transcript');
 assert.equal(journal.snapshot()['codex:a'].length,32);
 for(let n=100;n<120;n++)journal.record(event(n,'pulse'),'transcript');
 assert.equal(journal.snapshot()['codex:a'].length,32);assert.equal(journal.snapshot()['codex:a'].filter(e=>e.kind==='pulse').length,1);
 journal.prune(new Set());assert.deepEqual(journal.snapshot(),{});
});
test('rejected late or duplicate events never enter the activity journal',()=>{
 const s=new Sessions(),start=event(1,'tool-start',{tool:'tool',turn:'one'});
 s.receive(start,true,{source:'hook'});s.receive(start,true,{source:'hook'});
 s.receive(event(2,'finish',{turn:'one'}),true,{source:'hook'});
 s.receive(event(3,'tool-start',{tool:'late',turn:'one'}),true,{source:'hook'});
 assert.deepEqual(s.journal.snapshot()['codex:a'].map(e=>e.kind),['tool-start','finish']);
});
