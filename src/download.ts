/** Bound streamed responses too: Content-Length is optional and untrusted. */
export async function readBounded(response:Response,limit:number):Promise<Uint8Array>{
 const reader=response.body?.getReader();if(!reader)return new Uint8Array();
 let complete=false;
 try{
  if(Number(response.headers.get('content-length')||0)>limit)throw Error('Source file too large');
  const chunks:Uint8Array[]=[];let size=0;
  for(;;){
   const {done,value}=await reader.read();if(done){complete=true;break;}
   size+=value.byteLength;if(size>limit)throw Error('Source file too large');chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return bytes;
 }finally{if(!complete)await reader.cancel().catch(()=>{});reader.releaseLock();}
}
