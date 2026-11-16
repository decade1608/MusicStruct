import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const child=spawn(process.execPath,['scripts/run-local.mjs'],{env:{...process.env,PORT:'3107'},windowsHide:true,stdio:['ignore','pipe','pipe']});
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),60000);let text='';child.stdout.on('data',b=>{process.stdout.write(b);text+=b;if(text.includes('MusicStruct is ready:')){clearTimeout(timer);resolve();}});child.stderr.on('data',b=>process.stderr.write(b));child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);reject(Error(`Startup exited ${code}`));});});
 const base='http://127.0.0.1:3107/api';
 const search=await fetch(base+'/music/search?q=Carefree',{signal:AbortSignal.timeout(30000)});const result=await search.json();assert.equal(search.status,200,JSON.stringify(result));assert.ok(result.items.some(t=>t.title==='Carefree'));console.log(`Live catalog verified: ${result.total} matching recordings.`);
 const response=await fetch(base+'/collections');assert.equal(response.status,200);const lists=await response.json();console.log('Persistent playlists:',lists.map(p=>({name:p.name,tracks:p.tracks.length})));
 const outside=await fetch(base+'/music/search?q=Carefree&outside=true');const excluded=await outside.json();assert.equal(excluded.items.some(t=>lists.some(p=>p.tracks.some(m=>m.song.title===t.title&&m.song.artist===t.artist))),false);console.log('Live outside-playlist exclusion verified.');
 const source=lists.flatMap(p=>p.tracks.map(t=>t.song)).find(s=>!s.source||s.source.knownFeatures?.includes('tempo'));assert.ok(source,'A playlist track with known tempo is required');
 const rankedResponse=await fetch(base+`/music/discover?sourceId=${source.id}`);const ranked=await rankedResponse.json();assert.equal(rankedResponse.status,200,JSON.stringify(ranked));assert.ok(ranked.items.length>0);assert.ok(ranked.items.every((t,i)=>!i||ranked.items[i-1].score>=t.score));assert.equal(ranked.items.some(t=>lists.some(p=>p.tracks.some(m=>m.song.title===t.title&&m.song.artist===t.artist))),false);console.log(`Live C-ranked discovery verified: ${ranked.total} eligible outside-playlist recordings.`);
 process.env.MUSICSTRUCT_CHECK_URL='http://127.0.0.1:3107';await import('./check-discover-compat.mjs');
}finally{child.kill('SIGTERM');}
