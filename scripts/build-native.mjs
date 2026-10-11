import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
if(process.platform!=='win32')throw Error('Build the Windows companion on Windows.');
const version='1.0.4258.31',hash='56f7f4b8bf9aee4b8efefbbdd4f67d5f74ebd1b100ed0806da71bf76af481aa9';
const cache=resolve('artifacts/webview2');await mkdir(cache,{recursive:true});await mkdir('native',{recursive:true});
const zip=join(cache,'sdk.nupkg');let data;try{data=await readFile(zip);}catch{const response=await fetch(`https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/${version}/microsoft.web.webview2.${version}.nupkg`);if(!response.ok)throw Error('WebView2 SDK download failed');data=Buffer.from(await response.arrayBuffer());}
if(createHash('sha256').update(data).digest('hex')!==hash)throw Error('WebView2 SDK checksum mismatch');await writeFile(zip,data);
// Python extracts a pinned ZIP into the ignored build cache, never into the source tree.
execFileSync('python',['-c','import zipfile,sys;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',zip,join(cache,'sdk')],{windowsHide:true});
for(const name of ['Core','WinForms'])await copyFile(join(cache,'sdk/lib/net462/Microsoft.Web.WebView2.'+name+'.dll'),'native/Microsoft.Web.WebView2.'+name+'.dll');
await copyFile(join(cache,'sdk/runtimes/win-x64/native/WebView2Loader.dll'),'native/WebView2Loader.dll');await copyFile(join(cache,'sdk/LICENSE.txt'),'native/WebView2-LICENSE.txt');
const framework=join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319');
const refs=['System.dll','System.Core.dll','System.Drawing.dll','System.Windows.Forms.dll','System.Web.Extensions.dll',join(framework,'WPF/UIAutomationClient.dll'),join(framework,'WPF/UIAutomationTypes.dll'),join(framework,'WPF/WindowsBase.dll'),resolve('native/Microsoft.Web.WebView2.Core.dll'),resolve('native/Microsoft.Web.WebView2.WinForms.dll')];
const testing=process.argv.includes('--test');
const compile=testing=>execFileSync(join(framework,'csc.exe'),['/nologo','/target:exe','/platform:x64','/out:'+resolve('native',testing?'WidgetTests.exe':'PmdWidget.exe'),...refs.map(r=>'/reference:'+r),resolve('src/native/PmdWidget.cs'),...(testing?[resolve('tests/native-widget.cs'),'/main:WidgetTests']:[])],{stdio:'inherit',windowsHide:true});
compile(false);if(testing)compile(true);
console.log('Built Windows x64 desktop companion with pinned WebView2 SDK '+version);
