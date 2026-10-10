import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {atomicWrite,locked,mergeReceipts} from '../src/storage';
import {writeImport,type ImportResult} from '../src/importer';
import {ensureFiles} from '../src/gamedata';

test('separate processes merge receipts without losing another writer or leaving temporary files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pmd-storage-')),path=join(dir,'receipts.json');
 try{
  const code=`import {mergeReceipts} from './src/storage.ts'; await mergeReceipts(process.argv[1],[{file:process.argv[2]}]);`;
  await Promise.all(Array.from({length:4},(_,n)=>new Promise<void>((resolve,reject)=>{
   const child=spawn(process.execPath,['--import','tsx','--input-type=module','-e',code,path,String(n)],{stdio:['ignore','ignore','pipe'],windowsHide:true});
   let error='';child.stderr.on('data',s=>error+=s);child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(error)));
  })));
  assert.deepEqual(JSON.parse(await readFile(path,'utf8')).map((r:{file:string})=>r.file).sort(),['0','1','2','3']);
  await mergeReceipts(path,[{file:'0',source:'updated'}]);
  assert.equal(JSON.parse(await readFile(path,'utf8')).find((r:{file:string})=>r.file==='0').source,'updated');
  assert.deepEqual(await readdir(dir),['receipts.json']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('concurrent species imports keep both entries and a failed validation does not publish a manifest',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pmd-import-race-')),path=join(dir,'manifest.json');
 try{
  await writeFile(path,JSON.stringify({version:1,sprites:[],files:[],maps:[]}));
  const result=(id:string)=>({species:{id},files:[],written:{}} as unknown as ImportResult);
  await Promise.all(['one','two'].map(id=>writeImport(dir,result(id),async()=>{})));
  assert.deepEqual(JSON.parse(await readFile(path,'utf8')).sprites.map((s:{id:string})=>s.id).sort(),['one','two']);
  const before=await readFile(path,'utf8');
  await assert.rejects(writeImport(dir,result('bad'),async()=>{throw Error('Invalid sheet');}),/Invalid sheet/);
  assert.equal(await readFile(path,'utf8'),before);
  assert.deepEqual(await readdir(dir),['manifest.json']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('overlapping game fetches share atomic files and preserve both receipt sets',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pmd-cache-race-'));
 try{
  const bytes=Buffer.alloc(24);Buffer.from('89504e470d0a1a0a','hex').copy(bytes);
  let arrived=0,release!:()=>void;const barrier=new Promise<void>(r=>release=r);
  const get=async()=>{if(++arrived===4)release();await barrier;return bytes;};
  const item=(key:string)=>({key,file:'game/'+key+'.png',url:'https://example.invalid/'+key});
  const results=await Promise.all([ensureFiles(dir,[item('shared'),item('one')],get,'game/receipts.json'),ensureFiles(dir,[item('shared'),item('two')],get,'game/receipts.json')]);
  assert.ok(results.every(r=>r.failed.length===0));
  assert.deepEqual(JSON.parse(await readFile(join(dir,'game/receipts.json'),'utf8')).map((r:{file:string})=>r.file).sort(),['game/one.png','game/shared.png','game/two.png']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('unknown locks time out without stealing ownership and invalid receipts are preserved',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pmd-lock-')),path=join(dir,'receipts.json');
 try{
  await writeFile(path+'.lock','owner');
  await assert.rejects(locked(path,async()=>assert.fail('must not enter'),0),/Asset update is locked/);
  assert.equal(await readFile(path+'.lock','utf8'),'owner');await rm(path+'.lock');
  await atomicWrite(path,'broken');await assert.rejects(mergeReceipts(path,[{file:'one'}]));
  assert.equal(await readFile(path,'utf8'),'broken');assert.deepEqual(await readdir(dir),['receipts.json']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
