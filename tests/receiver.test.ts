import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {startReceiver} from '../src/receiver';
import type {Event} from '../src/core';
test('receiver authenticates, rejects browser origins and keeps two windows separate',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pmd-test-'));
 const seen:[Event,boolean][][]=[[],[]];
 const a=await startReceiver(dir,(e,d)=>seen[0].push([e,d]));
 const b=await startReceiver(dir,(e,d)=>seen[1].push([e,d]));
 try{
  const url='http://127.0.0.1:'+a.registration.port+'/event';
  const body={event:{v:1,id:'one',session:'codex:one',provider:'codex',kind:'session',at:Date.now()},window:a.registration.id};
  assert.equal((await fetch(url,{method:'POST',body:JSON.stringify(body)})).status,403);
  assert.equal((await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+a.registration.token,Origin:'https://hostile.example'},body:JSON.stringify(body)})).status,403);
  assert.equal((await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+a.registration.token},body:JSON.stringify({...body,event:{...body.event,secret:'no'}})})).status,400);
  async function emit(instance?:string){
   await new Promise<void>((resolvePromise,reject)=>{
    const child=spawn(process.execPath,[resolve('dist/hook.cjs'),'--provider','claude'],{env:{...process.env,PMD_AGENTS_REGISTRY:dir,PMD_AGENTS_INSTANCE:instance||''},stdio:['pipe','pipe','pipe']});
    let out='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>out+=x);
    child.on('error',reject);child.on('exit',code=>{assert.equal(code,0);assert.equal(out,'');resolvePromise();});
    child.stdin.end(JSON.stringify({session_id:'same-folder-session',hook_event_name:'SessionStart',prompt:'secret-prompt',cwd:'same-folder'}));
   });
  }
  await emit(a.registration.id);assert.equal(seen[0].length,1);assert.equal(seen[1].length,0);assert.equal(seen[0][0][1],true);
  await emit();assert.equal(seen[0].length,2);assert.equal(seen[1].length,1);assert.equal(seen[1][0][1],false);
  assert.ok(!JSON.stringify(seen).includes('secret'));
 }finally{await a.dispose();await b.dispose();await rm(dir,{recursive:true,force:true});}
});

