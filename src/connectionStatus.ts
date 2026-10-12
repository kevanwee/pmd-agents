/** Explain discovery without exposing other projects' paths or transcript contents. */
export function connectionStatus(state:{workspaces?:string[];observationEnabled?:boolean;autoState?:string;autoConnect?:boolean;autoAttach?:boolean;diagnostics?:{files:number;outsideWorkspace?:number;unsupported:number;readErrors:number;lastScan:number}}){
 const names=state.workspaces;
 if(state.autoState==='ambiguous')return 'Another guild window shares these folders. Choose the intended sessions in Connections.';
 if(state.observationEnabled===false)return 'Local chat observation is disabled. Enable Observe Local Chats in VS Code settings.';
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
/** Explain why a discovered session is not already connected, without guessing its owner. */
export function attachmentReason(state:{excluded?:boolean;autoState?:string;autoAttach?:boolean;autoConnect?:boolean;workspace?:string;connection?:string}){
 if(state.excluded)return 'Previously removed from this guild. Attach once to include it again.';
 if(state.connection==='paused')return 'Local observation is paused. Enable Observe Local Chats to resume.';
 if(state.connection==='unavailable')return 'Its activity file is unavailable. Automatic connection will retry when it returns.';
 if(state.autoState==='ambiguous')return 'Another guild window shares these folders. Automatic connection resumes when the overlap clears; attach only to choose this window now.';
 if(state.autoState!=='single')return 'Checking window registrations. Automatic connection will retry without an attachment click.';
 if(!state.autoAttach&&(!state.autoConnect||!state.workspace))return state.autoConnect?'This hook has no verified workspace yet. Enable Auto-attach to include it automatically.':'Automatic connection is off. Enable Auto-attach to include new sessions.';
 return 'Automatic connection is pending; no attachment click is normally needed.';
}
