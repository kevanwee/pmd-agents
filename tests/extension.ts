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
  const autoDeadline=Date.now()+8000;
  while(!api.snapshot().some((a:any)=>a.provider==='codex'&&a.attached)&&Date.now()<autoDeadline)await new Promise(r=>setTimeout(r,100));
  const automatic=api.snapshot().find((a:any)=>a.provider==='codex'&&a.attached);
  assert.ok(automatic,'Local chat did not automatically connect');assert.equal(api.sessions.membership.get(automatic.id),'workspace');
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
  assert.equal(response.status,204);
  // Auto-attach (default on) spawns an unbound hook session; its membership records how it joined.
  const probeDeadline=Date.now()+3000;while(!api.snapshot().find((a:any)=>a.id==='codex:probe')?.attached&&Date.now()<probeDeadline)await new Promise(r=>setTimeout(r,100));
  assert.equal(api.snapshot().find((a:any)=>a.id==='codex:probe').attached,true);assert.equal(api.sessions.membership.get('codex:probe'),'auto');
  assert.equal(api.sessions.journal.snapshot()['codex:probe'][0].kind,'session');
  assert.ok(Object.values(api.sessions.journal.snapshot()).some((entries:any)=>entries.some((e:any)=>e.kind==='finish'&&e.source==='terminal')));
  api.sessions.attach('codex:probe');
  const terminal=api.snapshot().find((a:any)=>a.provider==='terminal'&&!a.ended);
  assert.equal(api.sessions.link('codex:probe',terminal.id),true);
  api.sessions.detach('codex:probe');assert.equal(api.sessions.links.size,0);
  assert.equal(api.snapshot().find((a:any)=>a.id==='codex:probe').ended,false);
  api.sessions.attach('codex:probe');assert.equal(api.sessions.link('codex:probe',terminal.id),true);
 }finally{t.dispose();}
 await new Promise(r=>setTimeout(r,400));
 assert.ok(api.snapshot().some((a:any)=>a.provider==='terminal'&&a.ended));
 assert.equal(api.sessions.links.size,0);assert.equal(api.snapshot().find((a:any)=>a.id==='codex:probe').ended,false);
 console.log('PMD extension: automatic transcript attachment, real terminal lifecycle, shell command, webview and candidate routing passed.');
}
