import {runTests} from '@vscode/test-electron';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
delete process.env.ELECTRON_RUN_AS_NODE;
const profile=resolve('artifacts/vscode-profile');
await mkdir(profile+'/User',{recursive:true});
await mkdir('artifacts/test-workspace',{recursive:true});
await writeFile(profile+'/User/settings.json',JSON.stringify({'security.workspace.trust.enabled':false,'terminal.integrated.shellIntegration.enabled':true,'terminal.integrated.defaultProfile.windows':'PowerShell','workbench.startupEditor':'none'}));
await runTests({
 vscodeExecutablePath:process.env.PMD_VSCODE_EXECUTABLE||'C:/Users/garma/AppData/Local/Programs/Microsoft VS Code/Code.exe',
 extensionDevelopmentPath:resolve('.'),
 extensionTestsPath:resolve('dist/extension-test.cjs'),
 launchArgs:[resolve('artifacts/test-workspace'),'--user-data-dir',profile,'--extensions-dir',resolve('artifacts/test-extensions'),'--disable-extensions','--skip-welcome','--skip-release-notes','--disable-workspace-trust'],
 extensionTestsEnv:{PMD_AGENTS_REGISTRY:resolve('artifacts/test-registry')}
});

