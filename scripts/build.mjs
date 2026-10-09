import {build} from 'esbuild';
import {mkdir, copyFile} from 'node:fs/promises';
await mkdir('dist', {recursive:true});
await mkdir('media', {recursive:true});
await Promise.all([
 build({entryPoints:['src/extension.ts'],bundle:true,platform:'node',format:'cjs',target:'node22',external:['vscode'],outfile:'dist/extension.cjs'}),
 build({entryPoints:['src/hook.ts'],bundle:true,platform:'node',format:'cjs',target:'node22',outfile:'dist/hook.cjs'}),
 build({entryPoints:['src/webview/app.ts'],bundle:true,platform:'browser',format:'iife',target:'es2022',outfile:'media/app.js'}),
 build({entryPoints:['tests/extension.ts'],bundle:true,platform:'node',format:'cjs',external:['vscode'],outfile:'dist/extension-test.cjs'}),
 copyFile('src/webview/style.css','media/style.css')
]);
console.log('Built extension, observer hook and guild view.');
