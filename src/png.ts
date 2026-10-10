import {inflateSync} from 'node:zlib';
/** A decoded PNG as 8-bit RGBA rows. Only the non-interlaced sheets SpriteCollab publishes are supported. */
export interface Png {width:number;height:number;data:Uint8Array}
const SIGNATURE='89504e470d0a1a0a';
/** Decode a PNG (colour types 0, 2, 3, 4 and 6; bit depths 1–16; no interlace) without native dependencies. */
export function decodePng(bytes:Uint8Array):Png {
 const buffer=Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(buffer.length<33||buffer.toString('hex',0,8)!==SIGNATURE)throw Error('Not a PNG');
 let width=0,height=0,depth=0,type=0,palette:Buffer|undefined,alpha:Buffer|undefined;const idat:Buffer[]=[];
 for(let offset=8;offset+8<=buffer.length;){
  const length=buffer.readUInt32BE(offset),name=buffer.toString('latin1',offset+4,offset+8),start=offset+8;
  if(length>buffer.length-start)throw Error('Truncated PNG chunk');
  const chunk=buffer.subarray(start,start+length);
  if(name==='IHDR'){width=chunk.readUInt32BE(0);height=chunk.readUInt32BE(4);depth=chunk[8];type=chunk[9];if(chunk[12]!==0)throw Error('Interlaced PNG is not supported');}
  else if(name==='PLTE')palette=chunk;else if(name==='tRNS')alpha=chunk;else if(name==='IDAT')idat.push(chunk);else if(name==='IEND')break;
  offset=start+length+4;
 }
 const channels={0:1,2:3,3:1,4:2,6:4}[type];
 if(!channels||!width||!height||width*height>16_777_216||![1,2,4,8,16].includes(depth)||(type!==0&&type!==3&&depth<8))throw Error('Unsupported PNG format');
 const bitsPerPixel=channels*depth,stride=Math.ceil(width*bitsPerPixel/8),step=Math.max(1,bitsPerPixel>>3);
 const raw=inflateSync(Buffer.concat(idat));
 if(raw.length<(stride+1)*height)throw Error('PNG image data is incomplete');
 const rows=Buffer.alloc(stride*height);
 for(let y=0;y<height;y++){
  const filter=raw[y*(stride+1)],line=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)),out=rows.subarray(y*stride,(y+1)*stride),up=y?rows.subarray((y-1)*stride,y*stride):undefined;
  for(let i=0;i<stride;i++){
   const a=i>=step?out[i-step]:0,b=up?up[i]:0,c=i>=step&&up?up[i-step]:0;let v=line[i];
   if(filter===1)v+=a;else if(filter===2)v+=b;else if(filter===3)v+=(a+b)>>1;else if(filter===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}else if(filter!==0)throw Error('Unknown PNG filter');
   out[i]=v&255;
  }
 }
 const data=new Uint8Array(width*height*4),max=(1<<depth)-1;
 const sample=(row:Buffer,index:number)=>{
  if(depth===8)return row[index];
  if(depth===16)return row[index*2];
  const bit=index*depth,byte=row[bit>>3];return (byte>>(8-depth-(bit&7)))&max;
 };
 for(let y=0;y<height;y++){
  const row=rows.subarray(y*stride,(y+1)*stride);
  for(let x=0;x<width;x++){
   const o=(y*width+x)*4;
   if(type===3){const i=sample(row,x);if(!palette||i*3+2>=palette.length)throw Error('Palette index out of range');data[o]=palette[i*3];data[o+1]=palette[i*3+1];data[o+2]=palette[i*3+2];data[o+3]=alpha&&i<alpha.length?alpha[i]:255;}
   else if(type===0){const g=Math.round(sample(row,x)*255/max);data[o]=data[o+1]=data[o+2]=g;data[o+3]=255;}
   else if(type===4){data[o]=data[o+1]=data[o+2]=sample(row,x*2);data[o+3]=sample(row,x*2+1);}
   else if(type===2){data[o]=sample(row,x*3);data[o+1]=sample(row,x*3+1);data[o+2]=sample(row,x*3+2);data[o+3]=255;}
   else {data[o]=sample(row,x*4);data[o+1]=sample(row,x*4+1);data[o+2]=sample(row,x*4+2);data[o+3]=sample(row,x*4+3);}
  }
 }
 return {width,height,data};
}
/** Width and height from the header alone, for cheap geometry checks. */
export function pngSize(header:Buffer){
 if(header.length<24||header.toString('hex',0,8)!==SIGNATURE)return undefined;
 return {width:header.readUInt32BE(16),height:header.readUInt32BE(20)};
}
