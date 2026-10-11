import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const require = createRequire(import.meta.url);
const {name, version} = JSON.parse(await readFile('package.json', 'utf8'));
if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw Error('The release package includes a Windows x64 companion. Build it on Windows x64.');
}
if (!/^[a-z0-9-]+$/.test(name) || !/^\d+\.\d+\.\d+$/.test(version)) {
  throw Error('Expected a safe package name and stable three-part version.');
}
await mkdir('artifacts', {recursive: true});
const filename = `${name}-${version}.vsix`;
const output = resolve('artifacts', filename);
// A failed rebuild must not leave a checksum certifying an older candidate.
await rm(output + '.sha256', {force: true});
for (const script of ['scripts/build.mjs', 'scripts/build-native.mjs']) {
  execFileSync(process.execPath, [script], {stdio: 'inherit', windowsHide: true});
}
execFileSync(process.execPath, [require.resolve('@vscode/vsce/vsce'), 'package',
  '--no-dependencies', '-o', output], {stdio: 'inherit', windowsHide: true});
execFileSync('python', ['scripts/verify-package.py', output], {stdio: 'inherit', windowsHide: true});
const hash = createHash('sha256').update(await readFile(output)).digest('hex');
await writeFile(output + '.sha256', `${hash}  ${filename}\n`);
console.log(`Verified ${filename}; SHA-256 ${hash}`);
