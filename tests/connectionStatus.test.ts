import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionStatus,attachmentReason} from '../src/connectionStatus';
test('empty guild explains scope, disabled observation, overlap and discovery failures',()=>{
 const state={workspaces:['Any project'],diagnostics:{files:0,unsupported:0,readErrors:0,lastScan:1,outsideWorkspace:1}};
 assert.match(connectionStatus(state),/Watching Any project.*other folders/);
 assert.match(connectionStatus({...state,workspaces:[]}),/No workspace folder/);
 assert.match(connectionStatus({...state,autoState:'ambiguous'}),/Another guild window/);
 assert.match(connectionStatus({...state,observationEnabled:false}),/observation is disabled/);
 assert.match(connectionStatus({...state,autoConnect:false,autoAttach:false}),/Automatic connection is disabled/);
 assert.match(connectionStatus({...state,diagnostics:{...state.diagnostics,files:1}}),/Chats were found/);
 assert.match(connectionStatus({...state,diagnostics:{...state.diagnostics,outsideWorkspace:0,unsupported:1}}),/unsupported client format/);
});
test('candidate explanations distinguish removal, paused observation, ambiguity and automatic retry',()=>{
 assert.match(attachmentReason({excluded:true}),/Previously removed/);
 assert.match(attachmentReason({connection:'paused'}),/observation is paused/);
 assert.match(attachmentReason({connection:'unavailable'}),/file is unavailable/);
 assert.match(attachmentReason({autoState:'ambiguous'}),/overlap clears/);
 assert.match(attachmentReason({autoState:'unavailable'}),/without an attachment click/);
 assert.match(attachmentReason({autoState:'single',autoConnect:true,autoAttach:false}),/no verified workspace/);
 assert.match(attachmentReason({autoState:'single',autoConnect:false,autoAttach:false}),/connection is off/);
 assert.match(attachmentReason({autoState:'single',autoAttach:true}),/no attachment click/);
});
