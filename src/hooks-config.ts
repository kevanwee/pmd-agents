export const EVENTS=['SessionStart','UserPromptSubmit','PreToolUse','PostToolUse','PermissionRequest','Stop','SessionEnd','SubagentStart','SubagentStop'];
export function hookConfig(existing:Record<string,any>,command:string,remove=false,provider='codex') {
 const next=structuredClone(existing);
 if(next.hooks!==undefined && (!next.hooks||typeof next.hooks!=='object'||Array.isArray(next.hooks)))throw Error('Unsupported hooks structure');
 next.hooks ||= {};
 const events=[...EVENTS,...(provider==='claude'?['Notification']:['Interrupt'])];
 for(const event of events) {
  const current=next.hooks[event]??[];
  if(!Array.isArray(current))throw Error('Unsupported hook event structure');
  const retained=current.flatMap((group:any)=>{
   if(!Array.isArray(group.hooks))throw Error('Unsupported hook group');
   const hooks=group.hooks.filter((h:any)=>h.command!==command);
   return hooks.length?[{...group,hooks}]:[];
  });
  if(!remove)retained.push({hooks:[{type:'command',command,timeout:2}]});
  if(retained.length)next.hooks[event]=retained;else delete next.hooks[event];
 }
 return next;
}
