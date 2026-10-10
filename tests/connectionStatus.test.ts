import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionStatus} from '../src/connectionStatus';
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
