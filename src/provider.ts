import {createHash,randomUUID} from 'node:crypto';
import {hostname} from 'node:os';
import type {Event,Provider,Activity,Kind} from './core';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex').slice(0,32);
export function normalize(provider:Provider,raw:unknown):Event|undefined {
 if(!raw||typeof raw!=='object'||provider==='terminal')return;
 const r=raw as Record<string,unknown>;
 if(typeof r.session_id!=='string'||r.session_id.length>256)return;
 const host=hash(hostname());
 const session=provider+':'+hash(host+':'+r.session_id);
 const name=String(r.hook_event_name||'');
 const kinds:Record<string,Kind>={SessionStart:'session',UserPromptSubmit:'turn',PreToolUse:'tool-start',PostToolUse:'tool-end',PermissionRequest:'approval',Stop:'finish',StopFailure:'failure',Interrupt:'interrupt',SessionEnd:'end',SubagentStart:'session',SubagentStop:'end',Notification:'input'};
 const kind=kinds[name];if(!kind)return;
 if(name==='Notification' && !['permission_prompt','idle_prompt','elicitation_dialog','elicitation_url_dialog'].includes(String(r.notification_type)))return;
 const tool=typeof r.tool_use_id==='string'?hash(r.tool_use_id):undefined;
 if(['tool-start','tool-end'].includes(kind)&&!tool)return;
 let activity:Activity='working';
 const toolName=String(r.tool_name||'').toLowerCase();
 if(/^(read|grep|glob|webfetch|websearch)$/.test(toolName))activity='reading';
 if(/^(edit|write|apply_patch|multiedit)$/.test(toolName))activity='editing';
 if(/^(bash|exec_command|shell|shell_command)$/.test(toolName))activity='running';
 const isChild=typeof r.agent_id==='string' && r.agent_id.length<=256;
 const event:Event={v:1,id:randomUUID(),session:isChild?session+':'+hash(String(r.agent_id)):session,provider,kind:name==='Notification'&&r.notification_type==='permission_prompt'?'approval':kind,at:Date.now()};
 if(isChild)event.parent=session;
 if(tool)event.tool=tool;
 if(typeof r.turn_id==='string')event.turn=hash(r.turn_id);
 if(kind==='tool-start')event.activity=activity;
 if(toolName==='askuserquestion'||toolName==='request_user_input')event.kind='input';
 return event;
}

