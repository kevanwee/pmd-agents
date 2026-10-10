import test from 'node:test';
import assert from 'node:assert/strict';
import {terrains,Navigator,canStand,segment} from '../src/navigation';
test('each map has reachable stations and valid dummy positions',()=>{
 for(const terrain of Object.values(terrains)){
  const nav=new Navigator(terrain);assert.ok(nav.cells.length>160);
  for(const start of terrain.stations){
   assert.ok(canStand(start,terrain),JSON.stringify(start));assert.ok(canStand({x:start.x+29,y:start.y},terrain),'Dummy outside terrain '+JSON.stringify(start));
   for(const end of terrain.stations){const route=nav.route(start,end);assert.ok(route.length,'No route');let previous=start;for(const point of route){assert.ok(segment(previous,point,terrain));previous=point;}assert.deepEqual(route.at(-1),end);}
  }
 }
});
test('meadow opens the lower clearing and routes around the actual tree silhouette',()=>{
 const t=terrains.meadow,nav=new Navigator(t),from={x:150,y:240},to={x:310,y:240};
 assert.ok(canStand({x:185,y:230},t));assert.ok(canStand({x:230,y:295},t));
 assert.equal(canStand({x:227,y:255},t),false);assert.equal(segment(from,to,t),false);
 const route=nav.route(from,to);assert.ok(route.length>1);let p=from;for(const next of route){assert.ok(segment(p,next,t));p=next;}
 assert.equal(nav.route(from,{x:0,y:0}).length,0);
 const walk=nav.wander(from,23);assert.ok(walk.length);assert.ok(Math.hypot(walk.at(-1)!.x-from.x,walk.at(-1)!.y-from.y)>=48);
});
