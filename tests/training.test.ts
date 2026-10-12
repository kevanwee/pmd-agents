import test from 'node:test';
import assert from 'node:assert/strict';
import {trainingAt,combatActions} from '../src/training';
import type {Species,Animation} from '../src/world';
const animation={durations:[6,6,6],hit:1} as Animation;
test('training impacts follow native hit timing and projectiles arrive before hurt',()=>{
 const species={animations:{Attack:animation,Shoot:animation}};
 assert.equal(trainingAt(species,99).hit,false);assert.equal(trainingAt(species,100).hit,true);
 assert.equal(trainingAt(species,500).attacking,false);assert.equal(trainingAt(species,500).hit,false);
 assert.equal(trainingAt(species,2500).action,'Shoot');assert.equal(trainingAt(species,2500).projectile,0);
 assert.equal(trainingAt(species,2719).hit,false);assert.equal(trainingAt(species,2720).hit,true);assert.equal(trainingAt(species,2720).projectile,undefined);
 assert.equal(trainingAt({animations:{Attack:animation}},2500).action,'Attack');
});
test('training uses each available combat sheet once and keeps its own timing',()=>{
 const species={animations:{Attack:{...animation,file:'attack.png'},Shoot:{...animation,file:'shoot.png'},Strike:{...animation,file:'attack.png'},QuickStrike:{...animation,file:'quick.png',durations:[3,9,6]},MultiStrike:{...animation,file:'multi.png'},SpAttack:{...animation,file:'special.png'}}};
 assert.deepEqual(combatActions(species),['Attack','Shoot','QuickStrike','MultiStrike','SpAttack']);
 assert.equal(trainingAt(species,4800).action,'QuickStrike');
 assert.equal(trainingAt(species,4849).hit,false);assert.equal(trainingAt(species,4850).hit,true);
 assert.equal(trainingAt(species,7200).action,'MultiStrike');assert.equal(trainingAt(species,9600).action,'SpAttack');
 assert.equal(trainingAt(species,12000).action,'Attack');
});
