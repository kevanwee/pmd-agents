import {runTests,resolveCliPathFromVSCodeExecutablePath} from '@vscode/test-electron';
import {join,resolve} from 'node:path';
import {mkdir,writeFile,mkdtemp,readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
delete process.env.ELECTRON_RUN_AS_NODE;
const packaged=process.argv.includes('--package');
await mkdir('artifacts',{recursive:true});
const base=packaged?await mkdtemp(resolve('artifacts/package-install-')):resolve('artifacts');
const profile=join(base,'vscode-profile'),extensions=join(base,'test-extensions');
const executable=process.env.PMD_VSCODE_EXECUTABLE||(process.env.LOCALAPPDATA&&join(process.env.LOCALAPPDATA,'Programs/Microsoft VS Code/Code.exe'))||undefined;
let extensionPath=resolve('.');
if(packaged){
 if(!executable)throw Error('Set PMD_VSCODE_EXECUTABLE for the installed VS Code executable.');
 const {version}=JSON.parse(await readFile('package.json','utf8'));
 const vsix=resolve(`artifacts/pmd-agents-${version}.vsix`);
 execFileSync('python',['scripts/verify-package.py',vsix],{stdio:'inherit',windowsHide:true});
 if(process.platform!=='win32')throw Error('The packaged-install test targets local Windows.');
 // Use the installed CLI wrapper: newer VS Code builds keep cli.js in a versioned directory.
 // Pass paths as environment values, not shell-interpolated command text.
 execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','& $env:PMD_TEST_CLI --user-data-dir $env:PMD_TEST_PROFILE --extensions-dir $env:PMD_TEST_EXTENSIONS --install-extension $env:PMD_TEST_VSIX --force; exit $LASTEXITCODE'],{stdio:'inherit',windowsHide:true,env:{...process.env,PMD_TEST_CLI:resolveCliPathFromVSCodeExecutablePath(executable),PMD_TEST_PROFILE:profile,PMD_TEST_EXTENSIONS:extensions,PMD_TEST_VSIX:vsix}});
 const installed=(await readdir(extensions)).filter(name=>name===`kevanwee.pmd-agents-${version}`||name.startsWith(`kevanwee.pmd-agents-${version}-`));
 if(installed.length!==1)throw Error('Expected exactly one installed release package.');
 extensionPath=join(extensions,installed[0]);
}
await mkdir(profile+'/User',{recursive:true});
await mkdir('artifacts/test-workspace',{recursive:true});
const codexHome=join(base,'test-codex'),date=new Date(),logs=codexHome+'/sessions/'+date.toISOString().slice(0,10).replaceAll('-','/');
await mkdir(logs,{recursive:true});
await writeFile(logs+'/fixture.jsonl',[
 {type:'session_meta',payload:{id:'automatic-test-session',cwd:resolve('artifacts/test-workspace'),cli_version:'0.162.0-alpha.17.2',source:'vscode'}},
 {timestamp:date.toISOString(),type:'event_msg',payload:{type:'task_started',turn_id:'fixture-turn'}}
].map(r=>JSON.stringify(r)).join('\n')+'\n');
const claudeHome=join(base,'test-claude');
const claudeLogs=join(claudeHome,'projects',resolve('artifacts/test-workspace').replace(/[^a-zA-Z0-9-]/g,'-'));
await mkdir(claudeLogs,{recursive:true});
await writeFile(join(claudeLogs,'fixture.jsonl'),JSON.stringify({type:'user',sessionId:'automatic-claude-session',cwd:resolve('artifacts/test-workspace'),version:'2.1.296',entrypoint:'claude-vscode',uuid:'claude-fixture-turn',timestamp:date.toISOString(),message:{role:'user',content:'Synthetic integration fixture'}})+'\n');
const emptyPack=join(base,'empty-pack');if(packaged)await mkdir(emptyPack);
await writeFile(profile+'/User/settings.json',JSON.stringify({'security.workspace.trust.enabled':false,'terminal.integrated.shellIntegration.enabled':true,'terminal.integrated.defaultProfile.windows':'PowerShell','workbench.startupEditor':'none',...(packaged?{'pmdAgents.assetPath':emptyPack}:{'pmdAgents.favorites':['squirtle','pikachu','charmander']})}));
await runTests({
 vscodeExecutablePath:executable,
 extensionDevelopmentPath:extensionPath,
 extensionTestsPath:resolve('dist/extension-test.cjs'),
 launchArgs:[resolve('artifacts/test-workspace'),'--user-data-dir',profile,'--extensions-dir',extensions,'--disable-extensions','--skip-welcome','--skip-release-notes','--disable-workspace-trust'],
 extensionTestsEnv:{PMD_AGENTS_REGISTRY:join(base,'test-registry'),CODEX_HOME:codexHome,CLAUDE_CONFIG_DIR:claudeHome}
});
if(packaged)console.log('Installed VSIX passed in a fresh profile with an explicitly empty asset pack: '+base);
