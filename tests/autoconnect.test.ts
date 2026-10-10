import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,readdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WorkspaceLease,workspaceKey} from '../src/autoconnect';
import {Sessions} from '../src/sessions';
import type {Event} from '../src/core';
test('workspace leases handle reload, overlap, unrelated windows and stale registrations',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pmd-auto-')),dir=join(root,'leases'),a=new WorkspaceLease(dir),b=new WorkspaceLease(dir),folder=join(root,'project');
 try{
  await a.refresh([folder]);assert.ok(a.eligible.has(workspaceKey(folder)));
  await b.refresh([folder]);await a.refresh([folder]);assert.equal(a.state,'ambiguous');assert.equal(b.state,'ambiguous');assert.equal(a.eligible.size,0);
  await b.refresh([join(folder,'nested')]);await a.refresh([folder]);assert.equal(a.state,'ambiguous');
  await b.refresh([folder+'-different']);await a.refresh([folder]);assert.equal(a.state,'single');
  for(const name of await readdir(dir)){const saved=await readFile(join(dir,name),'utf8');assert.ok(!saved.includes('project'));assert.ok(!saved.includes(root));}
  await a.dispose();const resumed=new WorkspaceLease(dir);await resumed.refresh([folder]);assert.equal(resumed.state,'single');await resumed.dispose();
  await writeFile(join(dir,'bad.json'),JSON.stringify({id:'old',pid:process.pid,at:Date.now()-60000,scopes:[{key:workspaceKey(folder),parents:[workspaceKey(folder)]}]}));
  await b.refresh([folder]);assert.equal(b.state,'single');
 }finally{await a.dispose();await b.dispose();await rm(root,{recursive:true,force:true});}
});
test('auto membership respects exclusions after reload and preserves deliberate attachments on conflict',()=>{
 const event:Event={v:1,id:'one',session:'codex:one',provider:'codex',kind:'turn',at:Date.now()},source={source:'transcript' as const,workspace:'scope'};
 const sessions=new Sessions();sessions.receive(event,false,source);sessions.autoConnect(new Set(['scope']));assert.equal(sessions.store.snapshot()[0].attached,true);assert.equal(sessions.membership.get(event.session),'workspace');
 sessions.mark(event.session,'unavailable');sessions.autoConnect(new Set(['scope']));assert.equal(sessions.store.snapshot()[0].attached,true,'Keep lost observations visible');
 sessions.autoConnect(new Set());assert.equal(sessions.store.snapshot()[0].attached,false);
 sessions.attach(event.session);sessions.autoConnect(new Set());assert.equal(sessions.store.snapshot()[0].attached,true);
 sessions.detach(event.session);const resumed=new Sessions(sessions.exclusions());resumed.receive(event,false,source);resumed.autoConnect(new Set(['scope']));assert.equal(resumed.store.snapshot()[0].attached,false);
 resumed.attach(event.session);assert.equal(resumed.exclusions().length,0);
 const fresh=new Sessions();fresh.receive(event,false,source);fresh.autoConnect(new Set(['scope']));assert.equal(fresh.store.snapshot()[0].attached,true,'Automatic discovery restores membership without persisting live events');
});
test('hook priority still permits transcript workspace discovery without replaying stale activity',()=>{
 const s=new Sessions(),now=Date.now();
 s.receive({v:1,id:'hook',session:'codex:one',provider:'codex',kind:'approval',at:now},false,{source:'hook'},now);
 s.receive({v:1,id:'log',session:'codex:one',provider:'codex',kind:'turn',at:now-1000},false,{source:'transcript',workspace:'scope'},now);
 s.autoConnect(new Set(['scope']));assert.equal(s.store.snapshot()[0].attached,true);assert.equal(s.store.snapshot()[0].attention,'approval');assert.equal(s.evidence.get('codex:one')?.source,'hook');
});
