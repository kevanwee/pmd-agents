import {runTests} from '@vscode/test-electron';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
delete process.env.ELECTRON_RUN_AS_NODE;
const profile=resolve('artifacts/vscode-profile');
await mkdir(profile+'/User',{recursive:true});
await mkdir('artifacts/test-workspace',{recursive:true});
const codexHome=resolve('artifacts/test-codex'),date=new Date(),logs=codexHome+'/sessions/'+date.toISOString().slice(0,10).replaceAll('-','/');
await mkdir(logs,{recursive:true});
await writeFile(logs+'/fixture.jsonl',[
 {type:'session_meta',payload:{id:'automatic-test-session',cwd:resolve('artifacts/test-workspace'),cli_version:'0.162.0-alpha.2',source:'vscode'}},
 {timestamp:date.toISOString(),type:'event_msg',payload:{type:'task_started',turn_id:'fixture-turn'}}
].map(r=>JSON.stringify(r)).join('\n')+'\n');
await writeFile(profile+'/User/settings.json',JSON.stringify({'security.workspace.trust.enabled':false,'terminal.integrated.shellIntegration.enabled':true,'terminal.integrated.defaultProfile.windows':'PowerShell','workbench.startupEditor':'none'}));
await runTests({
 vscodeExecutablePath:process.env.PMD_VSCODE_EXECUTABLE||'C:/Users/garma/AppData/Local/Programs/Microsoft VS Code/Code.exe',
 extensionDevelopmentPath:resolve('.'),
 extensionTestsPath:resolve('dist/extension-test.cjs'),
 launchArgs:[resolve('artifacts/test-workspace'),'--user-data-dir',profile,'--extensions-dir',resolve('artifacts/test-extensions'),'--disable-extensions','--skip-welcome','--skip-release-notes','--disable-workspace-trust'],
 extensionTestsEnv:{PMD_AGENTS_REGISTRY:resolve('artifacts/test-registry'),CODEX_HOME:codexHome,CLAUDE_CONFIG_DIR:resolve('artifacts/test-claude')}
});
