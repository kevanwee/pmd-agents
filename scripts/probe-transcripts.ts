import {startTranscriptWatcher} from '../src/transcripts';
import {writeFile,mkdir} from 'node:fs/promises';
const roots=process.argv.slice(2);
if(!roots.length)throw Error('Pass workspace directories to inspect.');
const counts:Record<string,number>={},clients=new Set<string>();let fresh=0;
const started=Date.now();
const watcher=startTranscriptWatcher(roots,(event,evidence)=>{
 const key=event.provider+':'+event.kind;counts[key]=(counts[key]||0)+1;
 clients.add(event.provider+' '+evidence.client+' '+evidence.version);
 if(event.at>=started)fresh++;
});
await new Promise(resolve=>setTimeout(resolve,15000));watcher.dispose();
const result={counts,clients:[...clients],eventsWrittenDuringProbe:fresh,diagnostics:watcher.diagnostics};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/transcript-probe.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
