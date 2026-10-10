import {readFile,writeFile,mkdir,copyFile,rename,unlink} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {hookConfig} from './hooks-config';
export interface HookPlan {provider:'codex'|'claude';remove:boolean;file:string;destination:string;before:string|undefined;after:string;preview:string;changed:boolean}
async function readOptional(file:string){try{return await readFile(file,'utf8');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;return undefined;}}
export async function prepareSetup(provider:'codex'|'claude',remove=false,paths:{home?:string;codexHome?:string;claudeHome?:string}={}):Promise<HookPlan> {
 const home=paths.home||homedir();
 const dir=provider==='codex'?(paths.codexHome||process.env.CODEX_HOME||join(home,'.codex')):(paths.claudeHome||process.env.CLAUDE_CONFIG_DIR||join(home,'.claude'));
 const file=join(dir,provider==='codex'?'hooks.json':'settings.json'),destination=join(home,'.pmd-agents','hook.cjs');
 const command='node "'+destination+'" --provider '+provider;
 const before=await readOptional(file);
 let parsed;try{parsed=JSON.parse(before??'{}');}catch{throw Error('Provider settings are not valid JSON. No changes made.');}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Provider settings must be a JSON object. No changes made.');
 const updated=hookConfig(parsed,command,remove,provider);
 const matching=Object.values(parsed.hooks||{}).some((groups:any)=>Array.isArray(groups)&&groups.some((g:any)=>g?.hooks?.some((h:any)=>h?.command===command)));
 return {provider,remove,file,destination,before,after:JSON.stringify(updated,null,2)+'\n',changed:remove?matching:JSON.stringify(parsed)!==JSON.stringify(updated),
  // Preview only our observer entries. Existing provider settings may hold secrets.
  preview:JSON.stringify(hookConfig({},command,false,provider),null,2)};
}
export async function installSetup(plan:HookPlan,extensionPath:string){
 if(await readOptional(plan.file)!==plan.before)throw Error('Provider settings changed while this screen was open. Prepare setup again to preserve those changes.');
 if(!plan.remove){await mkdir(dirname(plan.destination),{recursive:true,mode:0o700});await copyFile(join(extensionPath,'dist','hook.cjs'),plan.destination);}
 if(!plan.changed)return {changed:false};
 await mkdir(dirname(plan.file),{recursive:true});await mkdir(dirname(plan.destination),{recursive:true,mode:0o700});
 if(plan.before!==undefined)await writeFile(plan.file+'.pmd-backup-'+Date.now(),plan.before,{mode:0o600});
 const temp=plan.file+'.'+randomUUID()+'.tmp';
 try{await writeFile(temp,plan.after,{mode:0o600});await rename(temp,plan.file);}catch(error){await unlink(temp).catch(()=>{});throw error;}
 return {changed:true};
}
