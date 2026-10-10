export interface Point {x:number;y:number}
export interface Animation {file:string;w:number;h:number;rows:number;durations:number[];anchors:number[][][];heads?:number[][][];hit:number}
export interface Species {id:string;name:string;portrait:string;artists:string[];portraitCredits:string[];element?:string;animations:Record<string,Animation>}
export interface Pack {version:number;sprites:Species[];dummy?:Species;maps:{id:string;name:string;subtitle:string;file:string;width:number;height:number;credit:string}[]}
export const polygon:Point[]=[[112,152],[340,152],[366,186],[384,222],[404,252],[336,262],[300,280],[160,280],[126,262],[52,252],[62,228],[84,190]].map(([x,y])=>({x,y}));
export function walkable(p:Point) {
 let hit=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
 }
 // Tree is conservatively blocked: no invented foreground layering.
 return hit && !(p.x>172&&p.x<288&&p.y>178&&p.y<280);
}
export function clearPath(a:Point,b:Point) {
 const n=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/2));
 for(let i=0;i<=n;i++){
  const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n};
  if(![{x:0,y:0},{x:-5,y:0},{x:5,y:0},{x:0,y:4}].every(o=>walkable({x:p.x+o.x,y:p.y+o.y})))return false;
 }
 return true;
}
export const slots:Point[]=[{x:116,y:218},{x:333,y:214},{x:155,y:169},{x:302,y:169},{x:100,y:246},{x:350,y:246}];
export function facing(a:Point,b:Point){return ((Math.round((90-Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI)/45)%8)+8)%8;}
export function frameAt(anim:Animation,elapsed:number){
 const total=anim.durations.reduce((a,b)=>a+b,0);
 let tick=(elapsed*60/1000)%total;
 for(let i=0;i<anim.durations.length;i++){if(tick<anim.durations[i])return i;tick-=anim.durations[i];}
 return 0;
}
