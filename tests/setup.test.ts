import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareSetup,installSetup} from '../src/setup';
test('hook installer preserves settings, backs up exact bytes and repairs its helper',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pmd-setup-'));
 try{
  const paths={home:root,codexHome:join(root,'codex'),claudeHome:join(root,'claude')};
  await mkdir(paths.claudeHome);await mkdir(join(root,'dist'));await writeFile(join(root,'dist','hook.cjs'),'observer');
  const file=join(paths.claudeHome,'settings.json'),before='{"secret":"private-fixture","hooks":{"Stop":[{"hooks":[{"type":"command","command":"other"}]}]}}';
  await writeFile(file,before);const plan=await prepareSetup('claude',false,paths);
  assert.ok(!plan.preview.includes('private-fixture'));await installSetup(plan,root);
  const saved=JSON.parse(await readFile(file,'utf8'));assert.equal(saved.secret,'private-fixture');assert.equal(saved.hooks.Stop[0].hooks[0].command,'other');
  const backup=(await readdir(paths.claudeHome)).find(f=>f.includes('pmd-backup'))!;assert.equal(await readFile(join(paths.claudeHome,backup),'utf8'),before);
  await unlink(plan.destination);const again=await prepareSetup('claude',false,paths);assert.equal(again.changed,false);await installSetup(again,root);assert.equal(await readFile(plan.destination,'utf8'),'observer');
  await installSetup(await prepareSetup('claude',true,paths),root);assert.deepEqual(JSON.parse(await readFile(file,'utf8')),JSON.parse(before));
  const absent=await prepareSetup('codex',true,paths);assert.equal((await installSetup(absent,root)).changed,false);await assert.rejects(readFile(absent.file),{code:'ENOENT'});
 }finally{await rm(root,{recursive:true,force:true});}
});
test('hook installer refuses stale or malformed settings',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pmd-setup-'));
 try{
  const paths={home:root,codexHome:root};const plan=await prepareSetup('codex',false,paths);await writeFile(plan.file,'{"changed":true}');
  await assert.rejects(installSetup(plan,root),/changed while/);assert.equal(await readFile(plan.file,'utf8'),'{"changed":true}');
  await writeFile(plan.file,'invalid');await assert.rejects(prepareSetup('codex',false,paths),/valid JSON/);
 }finally{await rm(root,{recursive:true,force:true});}
});
