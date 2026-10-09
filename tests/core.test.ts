import test from 'node:test';
import assert from 'node:assert/strict';
import {GuildStore,status,validEvent,type Event} from '../src/core';
import {normalize} from '../src/provider';
import {slots,clearPath,walkable,frameAt} from '../src/world';
let seq=0;
const event=(kind:Event['kind'],extra:Partial<Event>={}):Event=>({v:1,id:'e'+(++seq),session:'codex:one',provider:'codex',kind,at:Date.now(),...extra});
test('parallel tools do not end the turn when one completes',()=>{
 const s=new GuildStore();s.apply(event('turn'),true);
 s.apply(event('tool-start',{tool:'a',activity:'editing'}));s.apply(event('tool-start',{tool:'b',activity:'reading'}));
 s.apply(event('tool-end',{tool:'a'}));assert.equal(s.snapshot()[0].activity,'reading');
 s.apply(event('tool-end',{tool:'b'}));assert.equal(s.snapshot()[0].activity,'working');
 assert.equal(s.snapshot()[0].outcome,'');
 s.apply(event('finish'));assert.equal(status(s.snapshot()[0]),'Turn finished');
});
test('duplicate and reordered tool events cannot restart a completed tool',()=>{
 const s=new GuildStore(),start=event('tool-start',{tool:'a',turn:'t'});
 s.apply(event('tool-end',{tool:'a',turn:'t'}));s.apply(start);s.apply(start);
 assert.deepEqual(s.snapshot()[0].tools,{});
 s.apply(event('finish',{turn:'t'}));s.apply(event('tool-start',{tool:'b',turn:'t'}));
 assert.equal(s.snapshot()[0].outcome,'finished');
});
test('attention is separate from activity; stale activity does not succeed',()=>{
 const s=new GuildStore();s.apply(event('tool-start',{tool:'a',activity:'editing'}));s.apply(event('approval'));
 const a=s.snapshot()[0];assert.equal(a.activity,'editing');assert.equal(status(a),'Approval needed');
 a.lastSeen-=180000;assert.equal(status(a),'Status unconfirmed');assert.equal(a.outcome,'');
});
test('unbound sources remain candidates until explicitly attached',()=>{
 const s=new GuildStore();s.apply(event('session'));assert.equal(s.snapshot()[0].attached,false);
 s.attach('codex:one');assert.equal(s.snapshot()[0].attached,true);
});
test('an unrelated tool finishing does not dismiss another tool approval',()=>{
 const s=new GuildStore();s.apply(event('tool-start',{tool:'a'}));s.apply(event('approval',{tool:'b'}));
 s.apply(event('tool-end',{tool:'a'}));assert.equal(s.snapshot()[0].attention,'approval');
 s.apply(event('tool-start',{tool:'b'}));assert.equal(s.snapshot()[0].attention,'none');
});
test('late events cannot revive a closed session',()=>{
 const s=new GuildStore();s.apply(event('end'));s.apply(event('tool-start',{tool:'a'}));
 assert.equal(status(s.snapshot()[0]),'Session closed');
});
test('hook normalization drops raw prompts, paths, arguments and outputs',()=>{
 const a=normalize('codex',{session_id:'private-session',hook_event_name:'PreToolUse',tool_name:'apply_patch',tool_use_id:'tool-a',turn_id:'turn-a',tool_input:{command:'secret'},cwd:'private-folder',prompt:'private-prompt'});
 assert.ok(a);assert.equal(a.activity,'editing');assert.ok(validEvent(a));
 const text=JSON.stringify(a);for(const forbidden of ['secret','private','apply_patch','tool-a','turn-a'])assert.ok(!text.includes(forbidden));
 assert.equal(normalize('claude',{session_id:'s',hook_event_name:'Notification',notification_type:'other'}),undefined);
});
test('child hooks retain parent identity without sharing session ID',()=>{
 const p=normalize('codex',{session_id:'s',hook_event_name:'SessionStart'})!;
 const c=normalize('codex',{session_id:'s',agent_id:'child',hook_event_name:'SubagentStart'})!;
 assert.equal(c.parent,p.session);assert.notEqual(c.session,p.session);
});
test('wire contract rejects extra private fields, invalid tools and timestamps',()=>{
 assert.equal(validEvent({...event('session'),prompt:'secret'}),false);
 assert.equal(validEvent(event('tool-start')),false);
 assert.equal(validEvent(event('session',{at:NaN})),false);
 assert.equal(validEvent(event('session')),true);
});
test('meadow positions avoid the tree and routes stay within clearing',()=>{
 for(const p of slots){assert.ok(walkable(p));assert.ok(clearPath(p,p));}
 assert.equal(walkable({x:230,y:230}),false);
 assert.equal(clearPath({x:130,y:220},{x:330,y:220}),false);
 assert.equal(clearPath({x:116,y:218},{x:106,y:223}),true);
});
test('native durations run at 60 ticks per second',()=>{
 const a={file:'',w:20,h:20,rows:1,durations:[6,12],anchors:[],hit:0};
 assert.equal(frameAt(a,99),0);assert.equal(frameAt(a,101),1);assert.equal(frameAt(a,301),0);
});

