import test from 'node:test';
import assert from 'node:assert/strict';
import {Sessions} from '../src/sessions';
import type {Event} from '../src/core';
let seq=0;
const e=(session:string,kind:Event['kind'],extra:Partial<Event>={}):Event=>({v:1,id:'event-'+(++seq),session,provider:session.startsWith('terminal')?'terminal':'codex',kind,at:Date.now(),...extra});
test('explicit detach survives direct hook events and requires deliberate reattach',()=>{
 const s=new Sessions();s.receive(e('codex:a','session'),true,{source:'hook'});s.detach('codex:a');
 s.receive(e('codex:a','turn'),true,{source:'hook'});assert.equal(s.store.agents.get('codex:a')!.attached,false);
 s.attach('codex:a');assert.equal(s.store.agents.get('codex:a')!.attached,true);
});
test('linking requires attached live sources; terminal closure never ends its agent',()=>{
 const s=new Sessions();s.receive(e('codex:a','session'),false,{source:'transcript'});s.receive(e('terminal:a','session'),true,{source:'terminal'});
 assert.equal(s.link('codex:a','terminal:a'),false);s.attach('codex:a');assert.equal(s.link('codex:a','terminal:a'),true);
 assert.equal(s.link('terminal:a','codex:a'),false);
 s.receive(e('terminal:a','end'),true,{source:'terminal'});assert.equal(s.links.size,0);assert.equal(s.store.agents.get('codex:a')!.ended,false);
});
test('hooks override transcript history; newer activity restores a stale hook connection',()=>{
 const s=new Sessions(),now=Date.now();
 s.receive(e('codex:a','tool-start',{tool:'old',turn:'log-turn',activity:'editing',at:now}),false,{source:'transcript'},now);
 s.attach('codex:a');
 s.receive(e('codex:a','tool-start',{tool:'hook',activity:'reading',at:now+1}),true,{source:'hook'},now+1);
 assert.deepEqual(Object.keys(s.store.agents.get('codex:a')!.tools),['hook']);
 s.receive(e('codex:a','finish',{at:now}),false,{source:'transcript'},now+130000);
 assert.equal(s.evidence.get('codex:a')!.source,'hook');
 s.receive(e('codex:a','tool-start',{tool:'recovered',turn:'new',at:now+130000}),false,{source:'transcript'},now+130000);
 assert.equal(s.evidence.get('codex:a')!.source,'transcript');assert.equal(s.evidence.get('codex:a')!.partial,true);
 assert.deepEqual(Object.keys(s.store.agents.get('codex:a')!.tools),['recovered']);assert.equal(s.store.agents.get('codex:a')!.attached,true);
});
test('connection loss and recovery preserve observed outcome and never invent success',()=>{
 const s=new Sessions();s.receive(e('codex:a','turn'),false,{source:'transcript'});s.mark('codex:a','unavailable');
 assert.equal(s.store.agents.get('codex:a')!.outcome,'');s.pauseTranscripts();assert.equal(s.evidence.get('codex:a')!.connection,'paused');
 s.receive(e('codex:a','tool-start',{tool:'fresh'}),false,{source:'transcript'});assert.equal(s.evidence.get('codex:a')!.connection,'observing');
});
test('duplicate source-switch events cannot clear concurrent tools',()=>{
 const s=new Sessions(),hook=e('codex:a','tool-start',{tool:'a'});
 s.receive(e('codex:a','turn'),false,{source:'transcript'});s.receive(hook,true,{source:'hook'});
 s.receive(e('codex:a','tool-start',{tool:'b'}),true,{source:'hook'});s.receive(hook,true,{source:'hook'});
 assert.deepEqual(Object.keys(s.store.agents.get('codex:a')!.tools).sort(),['a','b']);
});
test('detaching a parent removes its children without closing any provider',()=>{
 const s=new Sessions();s.receive(e('codex:a','session'),true,{source:'hook'});s.receive(e('codex:b','session',{parent:'codex:a'}),false,{source:'hook'});
 assert.equal(s.store.agents.get('codex:b')!.attached,true);s.detach('codex:a');
 assert.equal(s.store.agents.get('codex:b')!.attached,false);assert.equal(s.store.agents.get('codex:b')!.ended,false);
});
test('auto-attach spawns discovered sessions by default, releases only its own and respects exclusions',()=>{
 const s=new Sessions(['codex:excluded']);
 s.receive(e('codex:hooked','session'),false,{source:'hook'});s.receive(e('codex:excluded','turn'),false,{source:'hook'});s.receive(e('codex:manual','turn'),false,{source:'transcript'});s.attach('codex:manual');
 s.autoAttach(true);
 assert.equal(s.store.agents.get('codex:hooked')!.attached,true);assert.equal(s.membership.get('codex:hooked'),'auto');
 assert.equal(s.store.agents.get('codex:excluded')!.attached,false,'removed sessions stay excluded');assert.equal(s.membership.get('codex:manual'),'manual');
 s.autoAttach(false);
 assert.equal(s.store.agents.get('codex:hooked')!.attached,false);assert.equal(s.membership.has('codex:hooked'),false);assert.equal(s.store.agents.get('codex:manual')!.attached,true);
 s.mark('codex:manual','unavailable');s.receive(e('codex:lost','turn'),false,{source:'transcript'});s.mark('codex:lost','unavailable');s.autoAttach(true);
 assert.equal(s.store.agents.get('codex:lost')!.attached,false,'a source that is not observing is not spawned');
});
