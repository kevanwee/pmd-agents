import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {decodePng,pngSize} from '../src/png';
import {sheetAnchors} from '../src/importer';
const crc=(() => {const table=new Int32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c;}return (b:Buffer)=>{let c=-1;for(const x of b)c=table[(c^x)&255]^(c>>>8);return (c^-1)>>>0;};})();
function chunk(name:string,data:Buffer){const length=Buffer.alloc(4);length.writeUInt32BE(data.length);const body=Buffer.concat([Buffer.from(name,'latin1'),data]);const sum=Buffer.alloc(4);sum.writeUInt32BE(crc(body));return Buffer.concat([length,body,sum]);}
/** Build a small PNG by hand so the decoder is checked without any artwork on disk. */
function png(width:number,height:number,depth:number,type:number,rows:Buffer[],extra:Buffer[]=[]){
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=depth;header[9]=type;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),...extra,chunk('IDAT',deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);
}
test('decodes RGBA rows through every filter type',()=>{
 // 2×5 image; each row uses a different filter and encodes the same pixels: (10,20,30,255) then (40,50,60,128).
 const a=[10,20,30,255],b=[40,50,60,128];
 const rows=[
  Buffer.from([0,...a,...b]),
  Buffer.from([1,...a,b[0]-a[0],b[1]-a[1],b[2]-a[2],(b[3]-a[3])&255]),
  Buffer.from([2,0,0,0,0,0,0,0,0]),
  Buffer.from([3,...a.map((v)=>(v-(v>>1))&255),...b.map((v,i)=>(v-((a[i]+v)>>1))&255)]),
  Buffer.from([4,0,0,0,0,0,0,0,0]),
 ];
 const image=decodePng(png(2,5,8,6,rows));
 assert.equal(image.width,2);assert.equal(image.height,5);
 for(let y=0;y<5;y++)assert.deepEqual([...image.data.subarray(y*8,y*8+8)],[...a,...b],'row '+y);
 assert.deepEqual(pngSize(png(2,5,8,6,rows).subarray(0,24)),{width:2,height:5});
});
test('decodes 4-bit palette images with transparency and rejects interlace',()=>{
 const palette=Buffer.from([0,0,0,255,255,255,9,8,7]),trns=Buffer.from([0,255]);
 const image=decodePng(png(3,1,4,3,[Buffer.from([0,0x12,0x00])],[chunk('PLTE',palette),chunk('tRNS',trns)]));
 assert.deepEqual([...image.data],[255,255,255,255,9,8,7,255,0,0,0,0]);
 const header=Buffer.alloc(13);header.writeUInt32BE(1,0);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;header[12]=1;
 assert.throws(()=>decodePng(Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.from([0,0,0,0,0]))),chunk('IEND',Buffer.alloc(0))])),/Interlaced/);
 assert.throws(()=>decodePng(Buffer.from('not a png at all, definitely not')),/Not a PNG/);
});
test('measures the same anchors and head offsets as the Pillow importer',{skip:!existsSync('assets/local/manifest.json')},async()=>{
 const manifest=JSON.parse(await readFile('assets/local/manifest.json','utf8'));
 let checked=0;
 for(const species of manifest.sprites){
  const number=String(species.dex).padStart(4,'0');
  for(const [action,anim] of Object.entries<any>(species.animations)){
   const key=anim.file.split('/').pop().replace('.png','');
   const source='assets/local/sources/sprite/'+number+'/'+key;
   if(!existsSync(source+'-Shadow.png'))continue;
   const sheet=decodePng(await readFile('assets/local/'+anim.file)),shadow=decodePng(await readFile(source+'-Shadow.png')),offsets=decodePng(await readFile(source+'-Offsets.png'));
   const measured=sheetAnchors(sheet,shadow,offsets,anim.w,anim.h,anim.durations.length);
   assert.deepEqual(measured.anchors,anim.anchors,species.id+' '+action+' anchors');
   assert.deepEqual(measured.heads,anim.heads,species.id+' '+action+' heads');
   assert.equal(measured.rows,anim.rows);checked++;
  }
 }
 assert.ok(checked>=40,'expected the local pack to provide sheets to compare; checked '+checked);
});
