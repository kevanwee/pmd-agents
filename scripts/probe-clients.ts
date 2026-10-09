// No model turn is submitted. Runs isolated client startup only.
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {startReceiver} from '../src/receiver';
const root=resolve('artifacts/client-probe');await mkdir(root,{recursive:true});
const events:{provider:string;kind:string}[]=[];
const receiver=await startReceiver(join(root,'instances'),e=>events.push({provider:e.provider,kind:e.kind}));
const node=process.execPath,hook=resolve('dist/hook.cjs');
const codexHome=join(root,'codex');await mkdir(codexHome,{recursive:true});
const hookCommand='"'+node+'" "'+hook+'" --provider codex';
await writeFile(join(codexHome,'hooks.json'),JSON.stringify({hooks:{SessionStart:[{hooks:[{type:'command',command:hookCommand,timeout:2}]}]}}));
const report:{client:string;result:string;events:unknown[]}[]=[];
await new Promise<void>(resolveProbe=>{
 const child=spawn('codex',['app-server','--listen','stdio://'],{env:{...process.env,CODEX_HOME:codexHome,PMD_AGENTS_REGISTRY:join(root,'instances'),PMD_AGENTS_INSTANCE:receiver.registration.id},stdio:['pipe','pipe','pipe'],windowsHide:true});
 let buffer='';let result='No startup result within deadline';
 const stop=setTimeout(()=>{child.kill();},12000);
 child.on('error',()=>{result='Client could not start';clearTimeout(stop);report.push({client:'Codex app-server startup (no inference)',result,events:events.filter(e=>e.provider==='codex')});resolveProbe();});
 child.stdout.on('data',data=>{
  buffer+=data;
  let pos;while((pos=buffer.indexOf('\n'))>=0){
   const line=buffer.slice(0,pos);buffer=buffer.slice(pos+1);
   try{const msg=JSON.parse(line);
    if(msg.id===1){child.stdin.write(JSON.stringify({method:'initialized'})+'\n');child.stdin.write(JSON.stringify({method:'thread/start',id:2,params:{cwd:root}})+'\n');}
    if(msg.id===2){result=msg.error?'thread/start returned an error':'thread/start succeeded; hook trust may still be required';setTimeout(()=>child.kill(),1200);}
   }catch{}
  }
 });
 child.stderr.resume();
 child.on('exit',()=>{clearTimeout(stop);report.push({client:'Codex app-server startup (no inference)',result,events:events.filter(e=>e.provider==='codex')});resolveProbe();});
 child.stdin.write(JSON.stringify({method:'initialize',id:1,params:{clientInfo:{name:'pmd_agents_probe',version:'0.1.0'}}})+'\n');
});
const claudeSettings=join(root,'claude-settings.json');
await writeFile(claudeSettings,JSON.stringify({hooks:{SessionStart:[{hooks:[{type:'command',command:'"'+node+'" "'+hook+'" --provider claude',timeout:2}]}]}}));
await new Promise<void>(resolveProbe=>{
 const cli=join(process.env.APPDATA||'','npm/node_modules/@anthropic-ai/claude-code/cli.js');
 const child=spawn(node,[cli,'--settings',claudeSettings,'--setting-sources','','--print'],{env:{...process.env,PMD_AGENTS_REGISTRY:join(root,'instances'),PMD_AGENTS_INSTANCE:receiver.registration.id},stdio:['pipe','pipe','pipe'],windowsHide:true});
 let result='No startup result within deadline';const timer=setTimeout(()=>child.kill(),12000);
 // No prompts or model calls: empty input deliberately stops print mode.
 child.stdin.end();child.stdout.resume();child.stderr.resume();
 child.on('error',()=>{clearTimeout(timer);report.push({client:'Claude CLI empty-input startup (no inference)',result:'Could not start',events:[]});resolveProbe();});
 child.on('exit',code=>{clearTimeout(timer);result='Empty-input startup exited '+code;report.push({client:'Claude CLI empty-input startup (no inference)',result,events:events.filter(e=>e.provider==='claude')});resolveProbe();});
});
await receiver.dispose();
await writeFile('artifacts/client-probe-summary.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
