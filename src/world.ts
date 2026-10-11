import {terrains,canStand,segment} from './navigation';
export interface Point {x:number;y:number}
export interface Animation {file:string;w:number;h:number;rows:number;durations:number[];anchors:number[][][];heads?:number[][][];hit:number}
/** `form` and `dex` identify a SpriteCollab form; `shadow` is AnimData's ShadowSize (0 small, 1 medium, 2 large). */
export interface Species {id:string;name:string;portrait:string;artists:string[];portraitCredits:string[];element?:string;dex?:number;form?:{path:string;label:string};shadow?:number;portraitFrom?:string;animations:Record<string,Animation>}
export interface MapLayer {file:string;x:number;y:number;w:number;h:number;frames:number;frameMs?:number;durations?:number[];credit:string}
export interface SceneMap {id:string;name:string;subtitle:string;file:string;width:number;height:number;credit:string;layers?:MapLayer[]}
export interface Pack {version:number;sprites:Species[];dummy?:Species;maps:SceneMap[]}
export const polygon=terrains.meadow.ground;
export const slots=terrains.meadow.stations;
export const walkable=(p:Point)=>canStand(p,terrains.meadow);
export const clearPath=(a:Point,b:Point)=>segment(a,b,terrains.meadow);
export function facing(a:Point,b:Point){return ((Math.round((90-Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI)/45)%8)+8)%8;}
export function frameAt(anim:Animation,elapsed:number){
 const total=anim.durations.reduce((a,b)=>a+b,0);
 let tick=(elapsed*60/1000)%total;
 for(let i=0;i<anim.durations.length;i++){if(tick<anim.durations[i])return i;tick-=anim.durations[i];}
 return 0;
}
