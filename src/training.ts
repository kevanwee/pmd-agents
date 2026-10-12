import type {Species} from './world';
export const COMBAT_ACTIONS=['Attack','Shoot','Strike','QuickStrike','MultiStrike','SpAttack'] as const;
/** CopyOf aliases share a sheet; do not repeat the same move under several names. */
export function combatActions(species:Pick<Species,'animations'>){
 const seen=new Set<string>();
 return COMBAT_ACTIONS.filter(action=>{
  const animation=species.animations[action];if(!animation)return false;
  const key=animation.file||action;if(seen.has(key))return false;seen.add(key);return true;
 });
}
// Decorative cycles never change observed session status or imply completed work.
export function trainingAt(species:Pick<Species,'animations'>,elapsed:number){
 const actions=combatActions(species);
 const attackLength=Math.max(...actions.map(a=>species.animations[a].durations.reduce((n,d)=>n+d,0)))*1000/60;
 const period=Math.max(2400,attackLength+700),cycle=elapsed%period;
 const action=actions[Math.floor(elapsed/period)%actions.length]||'Attack';
 const animation=species.animations[action];
 const duration=animation.durations.reduce((n,d)=>n+d,0)*1000/60;
 const launch=animation.durations.slice(0,animation.hit).reduce((n,d)=>n+d,0)*1000/60;
 const impact=launch+(action==='Shoot'?220:0);
 return {action,cycle,attacking:cycle<duration,hit:cycle>=impact&&cycle<impact+230,hurtTime:Math.max(0,cycle-impact),projectile:action==='Shoot'&&cycle>=launch&&cycle<impact?(cycle-launch)/220:undefined};
}
