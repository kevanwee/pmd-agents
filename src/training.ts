import type {Species} from './world';
// Decorative cycles never change observed session status or imply completed work.
export function trainingAt(species:Pick<Species,'animations'>,elapsed:number){
 const attackLength=Math.max(...['Attack','Shoot'].map(a=>species.animations[a]?.durations.reduce((n,d)=>n+d,0)||0))*1000/60;
 const period=Math.max(2400,attackLength+700),cycle=elapsed%period;
 const action=species.animations.Shoot&&Math.floor(elapsed/period)%2?'Shoot':'Attack';
 const animation=species.animations[action];
 const duration=animation.durations.reduce((n,d)=>n+d,0)*1000/60;
 const launch=animation.durations.slice(0,animation.hit).reduce((n,d)=>n+d,0)*1000/60;
 const impact=launch+(action==='Shoot'?220:0);
 return {action,cycle,attacking:cycle<duration,hit:cycle>=impact&&cycle<impact+230,hurtTime:Math.max(0,cycle-impact),projectile:action==='Shoot'&&cycle>=launch&&cycle<impact?(cycle-launch)/220:undefined};
}
