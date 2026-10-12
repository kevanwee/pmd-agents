import areas from '../assets/friend-areas.json';
import type {Point} from './world';
export interface Terrain {width:number;height:number;ground:Point[];zones?:Point[][];obstacles:Point[][];stations:Point[]}
const points=(values:number[][])=>values.map(([x,y])=>({x,y}));
export const terrains:Record<string,Terrain>={
 meadow:{width:456,height:336,
  ground:points([[85,163],[135,143],[190,154],[213,142],[253,143],[291,157],[344,153],[365,174],[354,203],[385,226],[407,255],[335,260],[294,310],[163,310],[124,260],[48,255],[60,230],[90,198]]),
  obstacles:[points([[216,190],[225,196],[242,186],[263,207],[246,220],[238,245],[246,270],[212,274],[208,247],[217,224],[194,211],[200,194]])],
  stations:points([[116,218],[333,214],[155,169],[302,169],[100,246],[280,285]])},
 forest:{width:480,height:312,
  ground:points([[203,137],[221,128],[239,157],[255,132],[271,141],[284,162],[300,179],[321,198],[326,222],[314,249],[306,282],[284,304],[193,304],[174,289],[165,261],[151,239],[150,210],[162,190],[177,175],[194,161]]),
  obstacles:[points([[219,179],[242,177],[257,190],[263,207],[249,217],[225,216],[209,203],[212,187]])],
  stations:points([[179,225],[276,225],[185,259],[271,259],[207,287],[262,287]])}
};
// Bounding boxes let checks skip far zones; native collision floors are many small rectangles.
const bounds=new WeakMap<Point[],number[]>();
function box(polygon:Point[]){
 let b=bounds.get(polygon);
 if(!b){const xs=polygon.map(p=>p.x),ys=polygon.map(p=>p.y);b=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];bounds.set(polygon,b);}
 return b;
}
export function inside(p:Point,polygon:Point[]){
 const [left,top,right,bottom]=box(polygon);if(p.x<left||p.x>right||p.y<top||p.y>bottom)return false;
 let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
 }return hit;
}
function floor(q:Point,terrain:Terrain){return (terrain.zones??[terrain.ground]).some(zone=>inside(q,zone))&&!terrain.obstacles.some(poly=>inside(q,poly));}
// Native collision floors have dozens of rectangles on an 8px grid; a per-pixel mask answers in one lookup.
const masks=new WeakMap<Terrain,Uint8Array>();
function mask(terrain:Terrain){
 let m=masks.get(terrain);
 if(!m){m=new Uint8Array(terrain.width*terrain.height);for(let y=0;y<terrain.height;y++)for(let x=0;x<terrain.width;x++)m[y*terrain.width+x]=floor({x:x+.5,y:y+.5},terrain)?1:0;masks.set(terrain,m);}
 return m;
}
function standable(q:Point,terrain:Terrain){
 if((terrain.zones?.length??1)<=16)return floor(q,terrain);
 const x=Math.floor(q.x),y=Math.floor(q.y);
 return x>=0&&y>=0&&x<terrain.width&&y<terrain.height&&mask(terrain)[y*terrain.width+x]===1;
}
export function canStand(p:Point,terrain:Terrain){return [{x:0,y:0},{x:-5,y:0},{x:5,y:0},{x:0,y:4}].every(o=>standable({x:p.x+o.x,y:p.y+o.y},terrain));}
export function segment(a:Point,b:Point,terrain:Terrain){
 const n=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/2));
 for(let i=0;i<=n;i++)if(!canStand({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},terrain))return false;return true;
}
/** An eight-pixel navigation grid with checked edges; no diagonal corner cuts. */
export class Navigator {
 readonly cells:Point[]=[];private edges:number[][]=[];
 constructor(readonly terrain:Terrain){
  const index=new Map<string,number>();
  for(let y=0;y<terrain.height;y+=8)for(let x=0;x<terrain.width;x+=8)if(canStand({x,y},terrain)){index.set(x+':'+y,this.cells.length);this.cells.push({x,y});}
  this.edges=this.cells.map(p=>{const out:number[]=[];for(const dx of [-8,0,8])for(const dy of [-8,0,8]){const n=index.get((p.x+dx)+':'+(p.y+dy));if(n!==undefined&&(dx||dy)&&segment(p,this.cells[n],terrain))out.push(n);}return out;});
 }
 route(from:Point,to:Point):Point[]{
  if(!canStand(from,this.terrain)||!canStand(to,this.terrain))return [];
  if(segment(from,to,this.terrain))return [{...to}];
  const nearest=(p:Point)=>this.cells.map((v,i)=>({i,d:Math.hypot(p.x-v.x,p.y-v.y)})).sort((a,b)=>a.d-b.d).slice(0,24).find(v=>segment(p,this.cells[v.i],this.terrain))?.i;
  const start=nearest(from),end=nearest(to);if(start===undefined||end===undefined)return [];
  const queue=[start],previous=new Map<number,number>([[start,-1]]);
  for(let i=0;i<queue.length&&!previous.has(end);i++)for(const n of this.edges[queue[i]])if(!previous.has(n)){previous.set(n,queue[i]);queue.push(n);}
  if(!previous.has(end))return [];
  const path:Point[]=[to];for(let i=end;i!==-1;i=previous.get(i)!)path.unshift(this.cells[i]);
  const simple:Point[]=[];let current=from;
  for(let i=0;i<path.length;){let far=i;while(far+1<path.length&&segment(current,path[far+1],this.terrain))far++;simple.push(path[far]);current=path[far];i=far+1;}
  return simple;
 }
 /** Grid cells connected to a cell (by identity), as route() would find them. */
 reachable(from:Point){
  const start=this.cells.indexOf(from),seen=new Set<number>(start<0?[]:[start]);
  for(const i of seen)for(const n of this.edges[i])seen.add(n);
  return new Set([...seen].map(i=>this.cells[i]));
 }
 wander(from:Point,seed:number,occupied:Point[]=[]){
  for(let attempt=0;attempt<48;attempt++){
   const p=this.cells[(Math.abs(seed*101+attempt*67))%this.cells.length];if(!p)break;
   if(Math.hypot(p.x-from.x,p.y-from.y)<48||occupied.some(o=>Math.hypot(p.x-o.x,p.y-o.y)<24))continue;
   const path=this.route(from,p);if(path.length)return path;
  }return [];
 }
}

/** Map sizes for pack validation, without building every map's navigation. */
export const terrainSizes:Record<string,{width:number;height:number}>={meadow:{width:456,height:336},forest:{width:480,height:312}};
for(const area of areas){
 terrainSizes[area.id]={width:area.size[0],height:area.size[1]};
 // Built on first use: a map's floor, grid and workstations cost nothing until it is shown.
 let cached:Terrain|undefined;
 Object.defineProperty(terrains,area.id,{enumerable:true,get:()=>cached??=build(area)});
}
function build(area:{size:number[];zones:number[][][];obstacles:number[][][]}):Terrain{
 const zones=area.zones.map(points);
 const terrain:Terrain={width:area.size[0],height:area.size[1],ground:zones[0],zones,obstacles:area.obstacles.map(points),stations:[]};
 // Spread workstations over the same conservative floor used by navigation.
 const nav=new Navigator(terrain);
 const candidates=nav.cells.filter(p=>segment(p,{x:p.x+29,y:p.y},terrain));
 candidates.sort((a,b)=>score(b)-score(a));
 const anchor=candidates[0];
 // Keep only stations connected to the anchor: one search over the grid instead of a route per candidate.
 const reached=nav.reachable(anchor);
 for(let i=candidates.length-1;i>=0;i--)if(!reached.has(candidates[i])&&!segment(anchor,candidates[i],terrain))candidates.splice(i,1);
 while(terrain.stations.length<6&&candidates.length){
  candidates.sort((a,b)=>score(b)-score(a));terrain.stations.push(candidates.shift()!);
 }
 function score(p:Point){return terrain.stations.length?Math.min(...terrain.stations.map(s=>Math.hypot(p.x-s.x,p.y-s.y))):-Math.hypot(p.x-terrain.width/2,p.y-terrain.height*.65);}
 return terrain;
}
