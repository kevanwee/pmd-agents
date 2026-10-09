import {spawn} from 'node:child_process';
export async function startPreview(){
 const child=spawn(process.execPath,['scripts/preview.mjs'],{env:{...process.env,PMD_PREVIEW_PORT:'0'},stdio:['ignore','pipe','ignore'],windowsHide:true});
 const stop=()=>child.kill();
 try{
  const url=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Preview did not start within 10 seconds')),10000);
   let text='';
   child.stdout.on('data',data=>{text+=data.toString();const match=text.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});
   child.once('error',error=>{clearTimeout(timer);reject(error);});
   child.once('exit',()=>{clearTimeout(timer);reject(Error('Preview exited before startup'));});
  });
  process.once('exit',stop);
  return {url,close(){stop();process.removeListener('exit',stop);}};
 }catch(error){stop();throw error;}
}
