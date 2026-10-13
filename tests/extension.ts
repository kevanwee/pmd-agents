import {writeFile,unlink,appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import * as vscode from 'vscode';
import assert from 'node:assert/strict';
export async function run(){
 const extension=vscode.extensions.getExtension('kevanwee.pmd-agents');assert.ok(extension);
 // Do not activate or reveal the extension here: startup itself must do both.
 const activationDeadline=Date.now()+15000;
 while(!extension.isActive&&Date.now()<activationDeadline)await new Promise(r=>setTimeout(r,100));
 assert.ok(extension.isActive,'PMD did not activate automatically in a fresh window');
 const api=extension.exports;
 const startupDeadline=Date.now()+15000;
 while(!api.widgetReady()&&Date.now()<startupDeadline)await new Promise(r=>setTimeout(r,100));
 assert.ok(api.widgetReady(),'Explorer widget did not initialize automatically without Show Widget');
 const t=vscode.window.createTerminal({name:'PMD integration test'});
 try{
  await new Promise(r=>setTimeout(r,700));
  assert.ok(api.snapshot().some((a:any)=>a.provider==='terminal'&&a.attached&&!a.ended));
  const widgetDeadline=Date.now()+10000;while(!api.widgetReady()&&Date.now()<widgetDeadline)await new Promise(r=>setTimeout(r,100));
  assert.ok(api.widgetReady(),'Explorer widget did not resolve');
  await vscode.commands.executeCommand('pmdAgents.open');
  const webDeadline=Date.now()+10000;
  while(!api.ready()&&Date.now()<webDeadline)await new Promise(r=>setTimeout(r,100));
  assert.ok(api.ready(),'Webview JavaScript failed to initialize');
  if(process.platform==='win32'){
   const desktopDeadline=Date.now()+20000;while(!api.desktopState().bound&&!api.desktopState().error&&Date.now()<desktopDeadline)await new Promise(r=>setTimeout(r,200));
   assert.equal(api.desktopState().error,'','Native widget startup failed');
   assert.ok(api.desktopState().bound,'Native widget did not identify its VS Code window');
  }
  const autoDeadline=Date.now()+8000;
  while(!api.snapshot().some((a:any)=>a.provider==='codex'&&a.attached)&&Date.now()<autoDeadline)await new Promise(r=>setTimeout(r,100));
  const automatic=api.snapshot().find((a:any)=>a.provider==='codex'&&a.attached);
  assert.ok(automatic,'Local chat did not automatically connect');assert.equal(api.sessions.membership.get(automatic.id),'workspace');
  const claude=api.snapshot().find((a:any)=>a.provider==='claude'&&a.attached);
  assert.ok(claude,'Claude 2.1.296 chat did not automatically connect');assert.equal(api.sessions.membership.get(claude.id),'workspace');
  // Each new teammate gets a Pokémon from favourites first (Pikachu is not in the pack, so it is skipped), never a shared one.
  if(api.assignments){
   const team=()=>api.snapshot().filter((a:any)=>a.attached&&!a.ended).map((a:any)=>api.assignments()[a.id]);
   const spawnDeadline=Date.now()+8000;while(team().some((s:any)=>!s)&&Date.now()<spawnDeadline)await new Promise(r=>setTimeout(r,100));
   const species=team();console.log('Spawned: '+species.join(', '));
   if(species.length&&species.every(Boolean)){
    assert.equal(new Set(species).size,species.length,'Teammates share a Pokémon: '+species.join(', '));
    assert.ok(species.includes('squirtle')&&(species.length<2||species.includes('charmander')),'Favourites spawn first: '+species.join(', '));
   }
  }
  const cwd=vscode.workspace.workspaceFolders![0].uri.fsPath;
  const claudeFile=join(process.env.CLAUDE_CONFIG_DIR!,'projects',cwd.replace(/[^a-zA-Z0-9-]/g,'-'),'fixture.jsonl');
  await appendFile(claudeFile,JSON.stringify({type:'assistant',sessionId:'automatic-claude-session',cwd,version:'2.1.296',timestamp:new Date().toISOString(),message:{content:[{type:'text',text:'Synthetic fixture complete'}],stop_reason:'end_turn'}})+'\n');
  const claudeDeadline=Date.now()+5000;
  while(api.snapshot().find((a:any)=>a.id===claude.id)?.outcome!=='finished'&&Date.now()<claudeDeadline)await new Promise(r=>setTimeout(r,100));
  assert.equal(api.snapshot().find((a:any)=>a.id===claude.id)?.outcome,'finished','Claude turn end did not stream into the guild');
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
  // An unreadable/malformed lease registry must pause automatic ownership claims.
  const badLease=join(process.env.PMD_AGENTS_REGISTRY!,'workspaces','bad.json');
  try{
   await writeFile(badLease,'invalid');
   const paused=Date.now()+6500;
   while(api.snapshot().find((a:any)=>a.id==='codex:probe')?.attached&&Date.now()<paused)await new Promise(r=>setTimeout(r,100));
   assert.equal(api.snapshot().find((a:any)=>a.id==='codex:probe').attached,false,'Unavailable lease must pause auto-attach');
   assert.ok(api.snapshot().some((a:any)=>a.provider==='terminal'&&a.attached),'Direct terminal binding survives');
  }finally{await unlink(badLease);}
  const resumed=Date.now()+6500;
  while(!api.snapshot().find((a:any)=>a.id==='codex:probe')?.attached&&Date.now()<resumed)await new Promise(r=>setTimeout(r,100));
  assert.equal(api.snapshot().find((a:any)=>a.id==='codex:probe').attached,true,'Auto-attach resumes after the lease recovers');
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
 console.log('PMD extension: automatic widget startup, Codex/Claude transcript attachment, real terminal lifecycle, shell command, webview and candidate routing passed.');
}
