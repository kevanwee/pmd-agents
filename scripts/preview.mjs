import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('.');
const port=Number(process.env.PMD_PREVIEW_PORT||5188);
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){
   let pack;try{pack=JSON.parse(await readFile('assets/local/manifest.json','utf8'));}catch{}
   const boot={pack,assetBase:'/assets/local/',mode:'preview',agents:[],clients:[]};
   res.setHeader('Content-Type','text/html');
   res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/media/style.css"><style>@font-face{font-family:Pixelify;src:url("/assets/local/PixelifySans.woff2")}</style></head><body><div id="app"></div><script>window.PMD_BOOT='+JSON.stringify(boot).replaceAll('<','\\u003c')+'</script><script src="/media/app.js"></script></body></html>');return;
  }
  const file=resolve(root,'.'+decodeURIComponent(pathname));
  if(!file.startsWith(root+sep)||!['/media/','/assets/local/'].some(p=>pathname.startsWith(p))){res.writeHead(404).end();return;}
  const mime={'.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.json':'application/json'};
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404).end();}
});
server.listen(port,'127.0.0.1',()=>console.log('PMD replay preview: http://127.0.0.1:'+port));

