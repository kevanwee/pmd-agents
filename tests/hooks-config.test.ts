import test from 'node:test';
import assert from 'node:assert/strict';
import {hookConfig} from '../src/hooks-config';
test('hook setup is idempotent and uninstall preserves unrelated configuration',()=>{
 const initial={preferences:{x:1},hooks:{Stop:[{matcher:'custom',hooks:[{type:'command',command:'user-hook',timeout:50}]}]}};
 const one=hookConfig(initial,'pmd-observer',false,'claude');
 const two=hookConfig(one,'pmd-observer',false,'claude');
 assert.deepEqual(one,two);assert.deepEqual(initial,hookConfig(two,'pmd-observer',true,'claude'));
 assert.ok(one.hooks.Notification);assert.equal(one.hooks.Interrupt,undefined);
 assert.ok(hookConfig({},'pmd-observer',false,'codex').hooks.Interrupt);
});
