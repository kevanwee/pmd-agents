/** SpriteCollab's AnimData.xml: one node per animation, with CopyOf aliases and 1/60-second durations. */
export interface AnimNode {name:string;w?:number;h?:number;hit?:number;rush?:number;ret?:number;copyOf?:string;durations?:number[]}
export interface AnimData {shadowSize:number;anims:Map<string,AnimNode>}
const text=(block:string,tag:string)=>block.match(new RegExp('<'+tag+'>([^<]*)</'+tag+'>'))?.[1].trim();
const int=(block:string,tag:string)=>{const v=text(block,tag);return v===undefined?undefined:Number.parseInt(v,10);};
export function parseAnimData(xml:string):AnimData {
 const anims=new Map<string,AnimNode>();
 for(const [,block] of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)){
  const name=text(block,'Name');if(!name)throw Error('Animation without a name');
  const copyOf=text(block,'CopyOf');
  const durations=[...block.matchAll(/<Duration>(\d+)<\/Duration>/g)].map(m=>Number.parseInt(m[1],10));
  anims.set(name,copyOf?{name,copyOf}:{name,w:int(block,'FrameWidth'),h:int(block,'FrameHeight'),hit:int(block,'HitFrame'),rush:int(block,'RushFrame'),ret:int(block,'ReturnFrame'),durations});
 }
 if(!anims.size)throw Error('No animations in AnimData');
 return {shadowSize:int(xml,'ShadowSize')??1,anims};
}
/** Follow CopyOf aliases to the sheet that actually exists; cycles and dangling aliases are errors. */
export function resolveAnim(data:AnimData,name:string):AnimNode&{w:number;h:number;durations:number[]} {
 const visited=new Set<string>();let key=name;
 for(;;){
  const node=data.anims.get(key);if(!node)throw Error('Unknown animation '+name);
  if(!node.copyOf){
   if(!node.w||!node.h||!node.durations?.length||node.durations.some(d=>!(d>0)))throw Error('Incomplete animation '+key);
   return node as AnimNode&{w:number;h:number;durations:number[]};
  }
  if(visited.has(key))throw Error('Animation alias cycle at '+key);visited.add(key);key=node.copyOf;
 }
}
