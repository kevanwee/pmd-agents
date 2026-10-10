/** Explain discovery without exposing other projects' paths or transcript contents. */
export function connectionStatus(state:{workspaces?:string[];observationEnabled?:boolean;autoState?:string;autoConnect?:boolean;autoAttach?:boolean;diagnostics?:{files:number;outsideWorkspace?:number;unsupported:number;readErrors:number;lastScan:number}}){
 const names=state.workspaces;
 if(state.autoState==='ambiguous')return 'Another guild window shares these folders. Choose the intended sessions in Connections.';
 if(state.observationEnabled===false)return 'Local chat observation is disabled. Enable it in Connections.';
 if(names?.length===0)return 'No workspace folder is open. Open your project in this window; terminals and window-bound hooks can still connect.';
 if(state.autoConnect===false&&state.autoAttach===false)return 'Automatic connection is disabled. Enable it in Connections or attach a session there.';
 const scope=names?.length?'Watching '+names.join(', ')+'. ':'';
 const d=state.diagnostics;
 if(!d?.lastScan)return scope+'Looking for local agent activity…';
 if(d.files)return scope+'Chats were found. Check Connections for excluded or unattached sessions.';
 if(d.outsideWorkspace)return scope+'Recent chats belong to other folders. Open the chat’s project in this window or add it to this workspace.';
 if(d.readErrors)return scope+'Some local activity files could not be read. See Connections for diagnostics.';
 if(d.unsupported)return scope+'Recent activity uses an unsupported client format. See Connections for diagnostics.';
 return scope+'No recent supported chats found yet. Start a chat or terminal in this workspace.';
}
