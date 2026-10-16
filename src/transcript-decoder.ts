import type { Event } from './core';

type Emit = (name: string, extra?: Record<string, unknown>, kind?: Event['kind']) => void;

/** Runtime-neutral strategies. Raw chat never leaves these decoders. */
export abstract class TranscriptDecoder {
  protected turn: string | undefined;
  abstract decode(record: any, sessionId: string, emit: Emit): void;
  get currentTurn() { return this.turn; }
}

export class CodexTranscriptDecoder extends TranscriptDecoder {
  decode(record: any, _sessionId: string, emit: Emit) {
   const p=record.payload;
   if(!p||typeof p!=='object')return;
   if(typeof p.turn_id==='string')this.turn=p.turn_id;
   if(record.type==='event_msg'){
    if(p.type==='task_started')emit('UserPromptSubmit');
    if(p.type==='task_complete')emit(p.error?'StopFailure':'Stop');
    if(p.type==='turn_aborted')emit('Interrupt');
   }
   if(record.type==='response_item'){
    if(p.type==='reasoning'||p.type==='message'&&p.role==='assistant')emit('UserPromptSubmit',{},'pulse');
    if(['function_call','custom_tool_call'].includes(p.type)&&typeof p.name==='string'&&typeof p.call_id==='string')
     emit('PreToolUse',{tool_name:p.name.split('.').pop(),tool_use_id:p.call_id});
    if(['function_call_output','custom_tool_call_output'].includes(p.type)&&typeof p.call_id==='string')
     emit('PostToolUse',{tool_use_id:p.call_id});
   }
  }
}

export class ClaudeTranscriptDecoder extends TranscriptDecoder {
  decode(record: any, sessionId: string, emit: Emit) {
   if(record.sessionId!==sessionId||record.isSidechain)return;
   const blocks=record.message?.content;
   if(record.type==='user'){
    const resultBlocks=Array.isArray(blocks)?blocks.filter((b:any)=>b?.type==='tool_result'):[];
    if(resultBlocks.length){for(const b of resultBlocks)if(typeof b.tool_use_id==='string')emit('PostToolUse',{tool_use_id:b.tool_use_id});}
    else if(record.message?.role==='user'&&!record.toolUseResult){this.turn=record.uuid;emit('UserPromptSubmit');}
   }
   if(record.type==='assistant'){
    emit('UserPromptSubmit',{},'pulse');
    if(Array.isArray(blocks))for(const b of blocks)if(b?.type==='tool_use'&&typeof b.name==='string'&&typeof b.id==='string')emit('PreToolUse',{tool_name:b.name,tool_use_id:b.id});
    if(['end_turn','stop_sequence'].includes(record.message?.stop_reason))emit('Stop');
   }
  }
}
