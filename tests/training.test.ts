import test from 'node:test';
import assert from 'node:assert/strict';
import {trainingAt} from '../src/training';
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
