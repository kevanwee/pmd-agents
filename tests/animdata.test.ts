import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAnimData,resolveAnim} from '../src/animdata';
const xml=`<?xml version="1.0" ?>
<AnimData>
	<ShadowSize>2</ShadowSize>
	<Anims>
		<Anim><Name>Walk</Name><Index>0</Index><FrameWidth>40</FrameWidth><FrameHeight>48</FrameHeight><Durations><Duration>4</Duration><Duration>6</Duration></Durations></Anim>
		<Anim><Name>Attack</Name><Index>1</Index><FrameWidth>64</FrameWidth><FrameHeight>72</FrameHeight><HitFrame>3</HitFrame><ReturnFrame>5</ReturnFrame><Durations><Duration>4</Duration><Duration>2</Duration><Duration>2</Duration><Duration>2</Duration></Durations></Anim>
		<Anim><Name>Strike</Name><Index>2</Index><CopyOf>Attack</CopyOf></Anim>
		<Anim><Name>Appeal</Name><CopyOf>Strike</CopyOf></Anim>
		<Anim><Name>Loop1</Name><CopyOf>Loop2</CopyOf></Anim>
		<Anim><Name>Loop2</Name><CopyOf>Loop1</CopyOf></Anim>
		<Anim><Name>Empty</Name><Index>9</Index><FrameWidth>8</FrameWidth><FrameHeight>8</FrameHeight><Durations></Durations></Anim>
	</Anims>
</AnimData>`;
test('parses frame sizes, 1/60-second durations, hit frames and ShadowSize',()=>{
 const data=parseAnimData(xml);
 assert.equal(data.shadowSize,2);
 assert.deepEqual(resolveAnim(data,'Walk').durations,[4,6]);
 const attack=resolveAnim(data,'Attack');assert.equal(attack.w,64);assert.equal(attack.h,72);assert.equal(attack.hit,3);assert.equal(attack.ret,5);
});
test('follows CopyOf chains to the real sheet and rejects cycles, unknown names and empty animations',()=>{
 const data=parseAnimData(xml);
 assert.equal(resolveAnim(data,'Appeal').name,'Attack');
 assert.throws(()=>resolveAnim(data,'Loop1'),/cycle/);
 assert.throws(()=>resolveAnim(data,'Sleep'),/Unknown animation/);
 assert.throws(()=>resolveAnim(data,'Empty'),/Incomplete/);
 assert.throws(()=>parseAnimData('<AnimData></AnimData>'),/No animations/);
});
