import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,stat,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pg='C:/Program Files/PostgreSQL/18/bin',data=path.join(root,'.local/postgres');
const exec=promisify(execFile),port=process.env.MUSICSTRUCT_PGPORT||'55432';
const args=['-h','127.0.0.1','-p',port,'-U','musicstruct','-d','musicstruct'];
const sql=async query=>(await exec(path.join(pg,'psql.exe'),[...args,'-v','ON_ERROR_STOP=1','-tAc',query],{windowsHide:true,maxBuffer:10e6})).stdout.trim();
let owned;
try{
 let active;try{active=await sql('SHOW data_directory');}catch{}
 if(active&&path.resolve(active).toLowerCase()!==data.toLowerCase())throw Error('Unexpected database cluster; cleanup stopped.');
 if(!active){owned=spawn(path.join(pg,'postgres.exe'),['-D',data,'-p',port,'-h','127.0.0.1'],{windowsHide:true,stdio:['ignore','ignore','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Database startup timeout')),30000);owned.stderr.on('data',b=>{if(String(b).includes('ready to accept connections')){clearTimeout(timer);resolve();}});owned.on('error',reject);owned.on('exit',c=>{clearTimeout(timer);reject(Error(`Database exited ${c}`));});});}
 const backup=path.join(root,'.local/backups',`playable-only-${Date.now()}`);await mkdir(backup,{recursive:true});
 await exec(path.join(pg,'pg_dump.exe'),[...args,'-Fc','-f',path.join(backup,'database.dump')],{windowsHide:true});
 await copyFile(path.join(root,'backend/data/spotify-catalog.json'),path.join(backup,'spotify-catalog.json'));
 const rows=JSON.parse(await sql("SELECT coalesce(json_agg(x),'[]') FROM (SELECT s.id,s.title,s.artist,c.details,a.asset_id,a.bytes FROM songs s LEFT JOIN catalog_sources c ON c.song_id=s.id LEFT JOIN song_audio a ON a.song_id=s.id) x"));
 const removed=[];
 for(const row of rows){let local=false;if(row.asset_id){try{const f=await stat(path.join(root,'.local/media',row.asset_id));local=f.isFile()&&f.size===row.bytes&&f.size>0;}catch{}}
  const remote=typeof row.details?.audioUrl==='string'&&/^https:\/\//.test(row.details.audioUrl);if(!local&&!remote)removed.push(row);
 }
 if(removed.length){const ids=removed.map(s=>s.id).join(',');await sql(`BEGIN; SELECT pg_advisory_xact_lock(731902); DELETE FROM collection_tracks WHERE song_id IN (${ids}); DELETE FROM catalog_sources WHERE song_id IN (${ids}); DELETE FROM change_history WHERE song_id IN (${ids}); DELETE FROM song_audio WHERE song_id IN (${ids}); DELETE FROM saved_playlists WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(result->'tracks') t WHERE (t->'song'->>'id')::integer IN (${ids})); DELETE FROM songs WHERE id IN (${ids}); COMMIT;`);}
 const manifest=path.join(root,'frontend/src/removed-tracks.json');let previous=[];try{previous=JSON.parse(await readFile(manifest,'utf8'));}catch{}
 await writeFile(manifest,JSON.stringify([...new Set([...previous,...removed.map(s=>`${s.artist}\0${s.title}`)])],null,2));
 await writeFile(path.join(root,'backend/data/spotify-catalog.json'),'[]\n');
 await writeFile(path.join(backup,'removed.json'),JSON.stringify(removed,null,2));
 console.log(JSON.stringify({removed:removed.map(({id,title})=>({id,title})),remaining:await sql('SELECT count(*) FROM songs'),backup},null,2));
}finally{if(owned)await exec(path.join(pg,'pg_ctl.exe'),['-D',data,'-m','fast','-w','stop'],{windowsHide:true});}
