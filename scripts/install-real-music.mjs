import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateSong} from '../api/server.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base='http://127.0.0.1:3107/api';
const child=spawn(process.execPath,['scripts/run-local.mjs'],{cwd:root,env:{...process.env,PORT:'3107'},windowsHide:true,stdio:['ignore','pipe','pipe']});
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),60000);let output='';child.stdout.on('data',b=>{process.stdout.write(b);output+=b;if(output.includes('MusicStruct is ready:')){clearTimeout(timer);resolve();}});child.stderr.on('data',b=>process.stderr.write(b));child.on('error',reject);child.on('exit',c=>{clearTimeout(timer);reject(Error(`Startup exited ${c}`));});});
 const api=async(route,options={})=>{const r=await fetch(base+route,{signal:AbortSignal.timeout(60000),...options});const data=await r.json();if(!r.ok)throw Error(`${route}: ${JSON.stringify(data)}`);return data;};
 const before=await api('/export');await mkdir(path.join(root,'.local/backups'),{recursive:true});await writeFile(path.join(root,'.local/backups',`before-real-music-${Date.now()}.json`),JSON.stringify(before,null,2));
 const tracks=JSON.parse(await readFile(path.join(root,'backend/data/licensed.json'),'utf8'));
 let library=await api('/songs');
 for(const track of tracks){
  const existing=library.find(s=>s.id===track.id);if(existing&&(existing.title!==track.title||existing.artist!==track.artist))throw Error(`ID ${track.id} belongs to another song; no overwrite performed.`);
  if(!existing)await api('/songs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(validateSong(track))});
  const audio=await readFile(path.join(root,'.local/licensed-downloads',track.filename));
  const item=await api(`/songs/${track.id}/audio`,{method:'PUT',headers:{'Content-Type':'audio/mpeg','X-Audio-Name':encodeURIComponent(track.filename)},body:audio});
  if(item.bytes!==audio.length)throw Error('Uploaded size mismatch');console.log(`Installed: ${track.title}, ${item.bytes} bytes`);
 }
 // Remove only unchanged synthetic fixtures with no user-attached audio.
 const fixtures=JSON.parse(await readFile(path.join(root,'backend/data/demo.json'),'utf8'));let removed=0;
 for(const demo of fixtures){const live=library.find(s=>s.id===demo.id);if(!live||!live.synthetic)continue;
  const detail=await api(`/songs/${demo.id}`),expected=validateSong(demo),actual=validateSong(detail);
  if(JSON.stringify(expected)!==JSON.stringify(actual))continue;
  const r=await fetch(base+`/songs/${demo.id}/audio/metadata`);if(r.status!==404)continue;
  await api(`/songs/${demo.id}`,{method:'DELETE'});removed++;
 }
 console.log(`Removed ${removed} unchanged metadata-only demos. Collection backup saved in .local/backups. User edits and attachments preserved.`);
 console.log(JSON.stringify((await api('/songs')).map(s=>({id:s.id,title:s.title})),null,2));
}finally{child.kill('SIGTERM');}
