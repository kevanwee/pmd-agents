import * as vscode from 'vscode';
import assert from 'node:assert/strict';
export async function run(){
 const extension=vscode.extensions.getExtension('kevanwee.pmd-agents');assert.ok(extension);
 const api=await extension.activate();
 const t=vscode.window.createTerminal({name:'PMD integration test'});
 try{
  await new Promise(r=>setTimeout(r,700));
  assert.ok(api.snapshot().some((a:any)=>a.provider==='terminal'&&a.attached&&!a.ended));
  await vscode.commands.executeCommand('pmdAgents.open');
  const webDeadline=Date.now()+10000;
  while(!api.ready()&&Date.now()<webDeadline)await new Promise(r=>setTimeout(r,100));
  assert.ok(api.ready(),'Webview JavaScript failed to initialize');
  // Shell integration arrives asynchronously. Verify actual start/end through a harmless command.
  const deadline=Date.now()+15000;
  while(!t.shellIntegration&&Date.now()<deadline)await new Promise(r=>setTimeout(r,200));
  assert.ok(t.shellIntegration,'Shell integration unavailable in test terminal');
  t.shellIntegration.executeCommand('echo PMD-integration');
  const end=Date.now()+10000;
  while(!api.snapshot().some((a:any)=>a.provider==='terminal'&&a.outcome==='finished')&&Date.now()<end)await new Promise(r=>setTimeout(r,100));
  assert.ok(api.snapshot().some((a:any)=>a.provider==='terminal'&&a.outcome==='finished'));
  const r=api.registration;
  const response=await fetch('http://127.0.0.1:'+r.port+'/event',{method:'POST',headers:{Authorization:'Bearer '+r.token},body:JSON.stringify({window:null,event:{v:1,id:'probe',session:'codex:probe',provider:'codex',kind:'session',at:Date.now()}})});
  assert.equal(response.status,204);assert.equal(api.snapshot().find((a:any)=>a.id==='codex:probe').attached,false);
 }finally{t.dispose();}
 await new Promise(r=>setTimeout(r,400));
 assert.ok(api.snapshot().some((a:any)=>a.provider==='terminal'&&a.ended));
 console.log('PMD extension: real terminal lifecycle, shell command, webview and candidate routing passed.');
}
