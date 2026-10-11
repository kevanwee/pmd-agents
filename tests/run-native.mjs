import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve('.');
const result=await promisify(execFile)(resolve('native/WidgetTests.exe'),[root],{windowsHide:true,timeout:60000});
process.stdout.write(result.stdout);
// Test the actual packaged entry point and inherited-pipe shutdown, not just Form disposal.
const child=spawn(resolve('native/PmdWidget.exe'),[],{windowsHide:true,stdio:'pipe'});
const profileDirectory=resolve('artifacts/native-profiles',randomUUID());
try{
 const closed=new Promise((res,rej)=>{child.once('error',rej);child.once('exit',code=>res(code));});
 let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.resume();
 child.stdin.write(JSON.stringify({type:'init',title:'PMD pipe fixture',marker:'PMD nonexistent fixture',applicationPath:process.execPath,mediaDirectory:resolve('media'),assetDirectory:resolve('assets/local'),profileDirectory,boot:{pack:JSON.parse(await readFile('assets/local/manifest.json','utf8')),assetBase:'https://assets.pmd.local/',mode:'live',presentation:'desktop',agents:[]}})+'\n');
 const end=Date.now()+15000;while(!output.includes('desktopReady')&&Date.now()<end)await new Promise(r=>setTimeout(r,100));
 assert.ok(output.includes('desktopReady'),'packaged helper must initialize over stdin');
 child.stdin.write(JSON.stringify({type:'show'})+'\n');
 const shown=Date.now()+3000;while(!output.includes('desktopState')&&Date.now()<shown)await new Promise(r=>setTimeout(r,100));
 const probe=await promisify(execFile)(resolve('native/WidgetTests.exe'),['--visible',String(child.pid)],{windowsHide:true,timeout:10000});
 assert.equal(probe.stdout.trim(),'visible','a helper launched with windowsHide must really become visible');
 child.stdin.end();
 let timer;try{assert.equal(await Promise.race([closed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Pipe closure left an orphan widget')),5000);})]),0);}finally{clearTimeout(timer);}
 await assert.rejects(stat(profileDirectory),{code:'ENOENT'},'helper must remove its own cache after parent pipe closes');
 console.log('PASS: packaged helper starts over private pipes, really shows from a hidden launch, and exits/cleans its cache on pipe closure.');
}finally{if(child.exitCode===null)child.kill();}
