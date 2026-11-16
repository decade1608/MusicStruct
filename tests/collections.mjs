import assert from 'node:assert/strict';
import {normalizeCatalog} from '../api/catalog.mjs';
export async function checkCollections(base){
 const get=async path=>{const r=await fetch(base+'/api'+path);return [r.status,await r.json()];};
 assert.equal((await get('/music/search?kind=spotify'))[1].total,0,'metadata-only catalog is removed');assert.ok((await get('/music/search'))[1].items.every(t=>!!t.audioUrl),'search only returns recording sources');
 const write=async(path,data={},method='POST')=>{const r=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return [r.status,await r.json()];};
 const created=await write('/collections',{name:'Integration playlist'});assert.equal(created[0],201);const pid=created[1].id;
 assert.equal((await write('/collections',{name:' '}))[0],400);assert.equal((await write('/collections/not-a-uuid',{},'DELETE'))[0],400);
 await write(`/collections/${pid}/tracks`,{songId:501});await write(`/collections/${pid}/tracks`,{songId:501});
 assert.equal((await get('/collections'))[1].find(p=>p.id===pid).tracks.length,1);
 const edited=(await get('/songs/501'))[1];await write('/songs/501',{...edited,title:'Preserved member'},'PUT');assert.equal((await get('/collections'))[1].find(p=>p.id===pid).tracks[0].song.title,'Preserved member');
 await write(`/collections/${pid}`,{name:'Renamed'},'PATCH');assert.equal((await get('/collections'))[1].find(p=>p.id===pid).name,'Renamed');
 const queued=(await write(`/collections/${pid}/queue`))[1];assert.equal(queued.added,1);assert.equal((await write(`/collections/${pid}/queue`))[1].skipped,1);
 const search=(await get('/music/search?q=Carefree'))[1];assert.equal(search.total,1);assert.equal(search.items[0].key,'USUAN1400037');assert.equal((await get('/music/search?offset=-1'))[0],400);
 const ranked=(await get('/music/discover?sourceId=501'))[1];assert.equal(ranked.items.length,3);assert.equal(ranked.items[0].key,'USUAN1400037');assert.ok(ranked.items.every((x,i)=>i===0||ranked.items[i-1].score>=x.score));assert.equal((await get('/music/discover?sourceId=1'))[0],400);assert.equal((await get('/music/discover?sourceId=501&q=no-such-title'))[1].total,0);
 const compared=await write('/music/compare',{sourceId:501,key:'USUAN1400037'});assert.equal(compared[0],200);assert.equal(compared[1].weights.tempo,1);assert.equal(compared[1].weights.energy,0);
 const fetchOriginal=globalThis.fetch;let downloads=0;
 globalThis.fetch=async(url,options)=>{if(String(url).includes('/mp3-royaltyfree/')){downloads++;if(downloads===1)return new Response('',{status:503});return new Response(Buffer.concat([Buffer.from('ID3'),Buffer.alloc(32)]),{headers:{'Content-Length':'35'}});}return fetchOriginal(url,options);};
 try{assert.equal((await write('/music/USUAN1400037/save',{playlistId:pid}))[0],503);assert.equal((await get('/collections'))[1].find(p=>p.id===pid).tracks.length,1,'failed download must not add membership');
 const saved=await write('/music/USUAN1400037/save',{playlistId:pid});assert.equal(saved[0],200);assert.equal(saved[1].playlist.tracks.length,2);assert.ok(saved[1].playlist.tracks.find(t=>t.song.id===saved[1].song.id).playable);
 assert.equal((await write('/music/USUAN1400037/save',{playlistId:pid}))[1].playlist.tracks.length,2);assert.equal(downloads,2,'attached audio is reused');
 assert.equal((await get('/music/search?q=Carefree&outside=true'))[1].total,0);assert.ok(!(await get('/music/discover?sourceId=501'))[1].items.some(t=>t.key==='USUAN1400037'));assert.equal((await write('/music/compare',{sourceId:501,key:'USUAN1400037'}))[0],400);
 await write(`/collections/${pid}/tracks/${saved[1].song.id}`,{},'DELETE');assert.equal((await get('/music/search?q=Carefree&outside=true'))[1].total,1);
 const before=downloads;const prepared=await Promise.all([write('/music/USUAN1100844/record'),write('/music/USUAN1100844/record')]);assert.ok(prepared.every(r=>r[0]===200));assert.equal(prepared[0][1].id,prepared[1][1].id);assert.equal(downloads,before+1,'simultaneous play requests share one download');assert.equal(prepared[0][1].playbackUrl,`/api/songs/${prepared[0][1].id}/audio`);const audio=await fetch(base+prepared[0][1].playbackUrl,{headers:{Range:'bytes=0-2'}});assert.equal(audio.status,206);assert.equal(await audio.text(),'ID3');assert.equal((await get('/collections'))[1].find(p=>p.id===pid).tracks.length,1,'playing does not add playlist membership');await write('/music/USUAN1100844/record');assert.equal(downloads,before+1,'repeat play reuses local audio');
 }finally{globalThis.fetch=fetchOriginal;}
 await write(`/collections/${pid}`,{},'DELETE');assert.equal((await write(`/collections/${pid}/queue`))[0],404);assert.equal((await get('/songs/501'))[0],200,'playlist delete preserves songs');
 assert.equal(normalizeCatalog([{isrc:'USUAN1400037',title:'Bad',filename:'../bad.mp3',length:'00:01:00'}]).length,0);
 console.log('PASS: editable playlists, membership retention/deduplication, atomic playlist queue, catalog search, external comparison, download failure/retry, save/audio reuse, outside-playlist exclusion and deletion');
}
