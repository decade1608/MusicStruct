import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {parseCSV} from '../api/csv.mjs';
import {parseRange} from '../api/media.mjs';
import {weights} from '../api/features.mjs';
export function wav({seconds=10,silent=false,rate=8000}={}){
 const frames=rate*seconds,b=Buffer.alloc(44+frames*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(frames*2,40);
 for(let i=0;i<frames;i++){const pulse=i%(rate/2)<rate*.025;const sample=silent?0:pulse?Math.sin(2*Math.PI*1000*i/rate)*.8:0;b.writeInt16LE(Math.round(sample*32767),44+i*2);}return b;
}
export async function checkNextFeatures(base,backend){
 const get=async route=>{const r=await fetch(base+'/api'+route);return [r.status,await r.json()];};
 const post=async(route,data,method='POST')=>{const r=await fetch(base+'/api'+route,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return [r.status,await r.json()];};
 assert.deepEqual(weights({tempo:100}),{tempo:1,energy:0,danceability:0,valence:0,genre:0});assert.throws(()=>weights({}));assert.throws(()=>weights({tempo:-1}));
 const defaultScore=(await get('/compare?a=1&b=2'))[1];
 const tempo=(await get('/compare?a=1&b=2&weights='+encodeURIComponent('{"tempo":1}')))[1];assert.ok(Math.abs(tempo.score-tempo.features.tempo)<1e-6);assert.equal(tempo.weights.genre,0);
 assert.equal((await get('/compare?a=1&b=2&weights=%7B%7D'))[0],400);
 const rec=(await get('/songs/1/recommendations?weights='+encodeURIComponent('{"genre":1}')))[1];assert.ok(rec[0].score===1&&rec[0].song.genre==='Electronic');assert.ok(defaultScore.score>0);
 const generated=(await post('/playlists/preview',{startId:1,targetSeconds:900,maxTracks:4,weights:{tempo:1}}))[1];assert.equal(generated.tracks[0].song.id,1);assert.ok(generated.duration<=900);assert.equal(new Set(generated.tracks.map(t=>t.song.id)).size,generated.tracks.length);assert.equal(generated.tracks.reduce((n,t)=>n+t.song.duration,0),generated.duration);assert.equal(generated.optimal,false);
 assert.equal((await post('/playlists/preview',{startId:1,targetSeconds:10}))[0],400);
 const saved=(await post('/playlists',{name:'Gentle transitions',startId:1,targetSeconds:900}))[1];assert.ok(saved.id);assert.equal((await get('/playlists/'+saved.id))[1].name,'Gentle transitions');assert.ok((await get('/playlists'))[1].some(p=>p.id===saved.id));assert.equal((await post('/playlists/'+saved.id,{},'DELETE'))[0],200);assert.equal((await get('/playlists/'+saved.id))[0],404);
 assert.deepEqual(parseCSV('a,b\r\n"line\nnext","quote""comma,"\r\n').records,[['line\nnext','quote"comma,']]);assert.throws(()=>parseCSV('a,b\n"broken,x'));
 const csv='ID,Name,Artist,BPM\r\n501,"A quiet, morning",Example,90\r\n502,"Quoted ""title""",Example,100';
 const payload={csv,mapping:{id:'ID',title:'Name',artist:'Artist',tempo:'BPM'},defaults:{genre:'Ambient',year:2026,duration:180,energy:.3,danceability:.4,valence:.5}};
 const preview=(await post('/import/csv/preview',payload))[1];assert.equal(preview.valid,true);assert.equal(preview.rows[0].song.title,'A quiet, morning');assert.equal((await get('/songs/501'))[0],404);
 assert.equal((await post('/import/csv',payload))[1].added,2);assert.equal((await post('/import/csv',payload))[1].skipped,2);
 const duplicate=(await post('/import/csv/preview',{...payload,csv:'ID,Name,Artist,BPM\n503,A,X,90\n503,B,X,90'}))[1];assert.equal(duplicate.valid,false);
 assert.equal((await post('/import/csv',{...payload,csv:'ID,Name,Artist,BPM\n504,A,X,90\n505,B,X,bad'}))[0],422);assert.equal((await get('/songs/504'))[0],404);
 const samples=wav(),upload=async(data,headers={})=>fetch(base+'/api/songs/1/audio',{method:'PUT',headers:{'Content-Type':'audio/wav','X-Audio-Name':encodeURIComponent('Beat test.wav'),...headers},body:data});
 let response=await upload(samples);assert.equal(response.status,201);const metadata=await response.json();assert.equal(metadata.analysis.durationSeconds,10);assert.ok(Math.abs(metadata.analysis.tempoBpm-120)<1);assert.equal(metadata.analysis.waveform.length,128);
 response=await fetch(base+'/api/songs/1/audio',{headers:{Range:'bytes=0-43'}});assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),`bytes 0-43/${samples.length}`);assert.deepEqual(Buffer.from(await response.arrayBuffer()),samples.subarray(0,44));
 response=await fetch(base+'/api/songs/1/audio',{headers:{Range:'bytes=-16'}});assert.deepEqual(Buffer.from(await response.arrayBuffer()),samples.subarray(-16));
 response=await fetch(base+'/api/songs/1/audio',{method:'HEAD'});assert.equal(response.status,200);assert.equal(Number(response.headers.get('content-length')),samples.length);assert.equal((await response.arrayBuffer()).byteLength,0);
 response=await fetch(base+'/api/songs/1/audio',{headers:{Range:'bytes=99999999-'}});assert.equal(response.status,416);
 response=await fetch(base+'/api/songs/1/audio',{headers:{'If-None-Match':`"${metadata.sha256}"`}});assert.equal(response.status,304);
 assert.throws(()=>parseRange('bytes=0-1,4-5',100));assert.deepEqual(parseRange('bytes=98-999',100),{start:98,end:99,partial:true});
 const track=(await get('/songs/1'))[1];await post('/songs/1',{...track,title:'Edited with audio'},'PUT');assert.equal((await get('/songs/1/audio/metadata'))[1].asset_id,metadata.asset_id);
 await post('/songs/1',{},'DELETE');assert.equal((await get('/songs/1/audio/metadata'))[0],404);assert.equal((await post('/songs',track))[0],409,'retained audio must not attach to a new record with reused ID');await post('/undo',{});assert.equal((await get('/songs/1/audio/metadata'))[1].asset_id,metadata.asset_id);
 const before=await readdir(process.env.MUSICSTRUCT_MEDIA_DIR);const broken=Buffer.from(samples);broken.writeUInt32LE(4294967290,40);assert.equal((await upload(broken)).status,422);assert.deepEqual(await readdir(process.env.MUSICSTRUCT_MEDIA_DIR),before);
 response=await upload(wav({silent:true}));assert.equal(response.status,201);const silence=await response.json();assert.equal(silence.analysis.tempoBpm,null);assert.equal(silence.analysis.rms,0);assert.equal((await readdir(process.env.MUSICSTRUCT_MEDIA_DIR)).length,1,'replaced file cleaned up');
 assert.equal((await upload(Buffer.from('not audio at all'))).status,422);assert.equal((await upload(samples,{'Content-Type':'text/html'})).status,415);
 assert.equal((await post('/songs/1/audio',{},'DELETE'))[1].removed,true);assert.equal((await get('/songs/1/audio/metadata'))[0],404);assert.equal((await readdir(process.env.MUSICSTRUCT_MEDIA_DIR)).length,0);
 assert.equal((await backend(['playlist-list'])).length,0);
 console.log('PASS: custom C weights/ranking, constrained playlists/save/load, CSV quoting/mapping/preview/atomic import, WAV DSP/tempo/silence, audio upload/range/HEAD/cache/replacement/undo/cleanup');
}
