import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {randomUUID} from 'node:crypto';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const uuid=value=>{if(typeof value!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value))fail(400,'Invalid playlist ID.');return value;};
const title=value=>{if(typeof value!=='string'||!value.trim()||value.trim().length>120||value.includes('\0'))fail(400,'Playlist name must be 1–120 characters.');return value.trim();};
function text(value,bytes){let s=String(value??'').trim();while(Buffer.byteLength(s)>bytes)s=s.slice(0,-1);return s;}
export function normalizeCatalog(pieces){
 if(!Array.isArray(pieces))fail(502,'Invalid catalog response.');
 return pieces.filter(p=>typeof p.isrc==='string'&&/^[A-Z0-9]{12}$/.test(p.isrc)&&typeof p.filename==='string'&&!/[\\/\x00-\x1f]/.test(p.filename)&&/\.mp3$/i.test(p.filename)&&p.title).map(p=>{
  const duration=String(p.length).split(':').reduce((n,v)=>n*60+Number(v),0),tempo=Number(p.bpm);
  return {key:p.isrc,title:text(p.title,99),artist:'Kevin MacLeod',genre:'Instrumental',duration,tempo:tempo>0&&tempo<=400?tempo:null,year:Number(String(p.uploaded).slice(0,4))||0,filename:p.filename,sourceUrl:`https://incompetech.com/music/royalty-free/index.html?isrc=${p.isrc}`,audioUrl:`https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(p.filename)}`,license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/'};
 }).filter(p=>Number.isInteger(p.duration)&&p.duration>0&&p.duration<=86400);
}
export function catalogRoutes({call,body,json,id,validateSong,media}){
 let cached=null,expires=0,pending;
 async function catalog(){
  if(cached&&Date.now()<expires)return cached;if(pending)return pending;
  pending=(async()=>{let raw;if(process.env.MUSICSTRUCT_CATALOG_FIXTURE)raw=JSON.parse(await readFile(process.env.MUSICSTRUCT_CATALOG_FIXTURE,'utf8'));
   else{let r;try{r=await fetch('https://incompetech.com/music/royalty-free/pieces.json',{signal:AbortSignal.timeout(20000)});}catch{fail(503,'Music catalog is temporarily unavailable. Try again.');}if(!r.ok)fail(503,'Music catalog is temporarily unavailable. Try again.');let size=0;const chunks=[];for await(const part of r.body){size+=part.length;if(size>5000000)fail(502,'Catalog response is too large.');chunks.push(part);}try{raw=JSON.parse(Buffer.concat(chunks));}catch{fail(502,'Invalid catalog data.');}}
   const vocals=process.env.MUSICSTRUCT_CATALOG_FIXTURE?[]:JSON.parse(await readFile(new URL('../backend/data/vocal-catalog.json',import.meta.url),'utf8'));cached=[...vocals,...normalizeCatalog(raw)].filter(track=>!!track.audioUrl);expires=Date.now()+3600000;return cached;
  })();try{return await pending;}finally{pending=null;}
 }
 async function find(key){if(!/^[A-Z0-9]{12}$/.test(key))fail(400,'Invalid catalog track.');const result=(await catalog()).find(t=>t.key===key);if(!result)fail(404,'Track not found in the licensed catalog.');return result;}
 async function ensure(track){return call('catalog-cache',{key:track.key,song:validateSong({id:1,title:text(track.title,99),artist:text(track.artist,99),album:text(track.album||'',99),genre:track.genre,year:track.year,sections:track.sections||[],duration:track.duration,tempo:track.tempo??1,energy:track.energy??.5,danceability:track.danceability??.5,valence:track.valence??.5,instrumentalness:track.instrumentalness??0,acousticness:track.acousticness??0,speechiness:track.speechiness??0,loudness:track.loudness??-12,musical_key:track.musical_key??0}),source:{...track,provider:track.provider||'incompetech',unmeasured:!track.knownFeatures?.includes('energy'),knownFeatures:track.knownFeatures||(track.tempo?['tempo','duration']:['duration'])}});}
 const audioRequests=new Map();
 async function prepareAudio(track,song){
  if(!track.audioUrl)return false;
  if(audioRequests.has(track.key))return audioRequests.get(track.key);
  const pending=(async()=>{if(await call('audio-get',{id:song.id}))return true;let r;try{r=await fetch(track.audioUrl,{redirect:'error',signal:AbortSignal.timeout(180000)});}catch{fail(503,'The recording could not be downloaded. Please retry.');}if(!r.ok)fail(503,'The recording is temporarily unavailable. Please retry.');const stream=Readable.fromWeb(r.body);stream.headers={'content-type':track.mime||'audio/mpeg','x-audio-name':encodeURIComponent(track.filename),'content-length':r.headers.get('content-length')??undefined};await media.upload(stream,song.id);return true;})();audioRequests.set(track.key,pending);try{return await pending;}finally{audioRequests.delete(track.key);}
 }
 return async(req,res,url)=>{
  if(url.pathname==='/api/collections'){
   if(req.method==='GET'){json(res,200,await call('collections'));return true;}
   if(req.method==='POST'){const d=await body(req);json(res,201,await call('collection-mutate',{operation:'create',id:randomUUID(),name:title(d?.name)}));return true;}
  }
  const collection=url.pathname.match(/^\/api\/collections\/([^/]+)(?:\/(tracks|queue)(?:\/([1-9]\d*))?)?$/);
  if(collection){const pid=uuid(collection[1]);let data;
   if(!collection[2]&&req.method==='PATCH'){const d=await body(req);data={operation:'rename',id:pid,name:title(d?.name)};}
   if(!collection[2]&&req.method==='DELETE')data={operation:'delete',id:pid};
   if(collection[2]==='tracks'&&req.method==='POST'&&!collection[3]){const d=await body(req);data={operation:'add',id:pid,songId:id(String(d?.songId))};}
   if(collection[2]==='tracks'&&req.method==='DELETE'&&collection[3])data={operation:'remove',id:pid,songId:id(collection[3])};
   if(collection[2]==='queue'&&req.method==='POST'&&!collection[3])data={operation:'queue',id:pid};
   if(data){json(res,200,await call('collection-mutate',data));return true;}
  }
  if(url.pathname==='/api/music/discover'&&req.method==='GET'){
   const sourceId=id(url.searchParams.get('sourceId')),offset=Number(url.searchParams.get('offset')??0),q=(url.searchParams.get('q')??'').trim().toLowerCase();
   if(!Number.isInteger(offset)||offset<0||offset>9980||q.length>200)fail(400,'Invalid search parameters.');
   const members=(await call('collections')).flatMap(p=>p.tracks.map(t=>t.song)),source=members.find(s=>s.id===sourceId);
   if(!source)fail(400,'Choose a track from a playlist.');
   if(source.source&&!source.source.knownFeatures?.includes('tempo'))fail(422,'This track needs a known tempo to find tempo matches.');
   const keys=new Set(members.map(s=>s.source?.key)),names=new Set(members.map(s=>`${s.artist}\0${s.title}`));
   const candidates=(await catalog()).filter(t=>t.tempo&&!keys.has(t.key)&&!names.has(`${t.artist}\0${t.title}`)&&`${t.title} ${t.artist}`.toLowerCase().includes(q));
   const ranked=await call('catalog-rank',{sourceId,limit:offset+20,candidates:candidates.map(t=>({key:t.key,tempo:t.tempo}))}),byKey=new Map(candidates.map(t=>[t.key,t]));
   json(res,200,{provider:'MusicStruct catalog',total:candidates.length,offset,source,items:ranked.slice(offset,offset+20).map(m=>({...byKey.get(m.key),score:m.score})),basis:'Ranked by published/supplied tempo only. Not audio or mood similarity.'});return true;
  }
  if(url.pathname==='/api/music/search'&&req.method==='GET'){
   const q=(url.searchParams.get('q')??'').trim();if(q.length>200)fail(400,'Search is limited to 200 characters.');
   const offset=Number(url.searchParams.get('offset')??0);if(!Number.isInteger(offset)||offset<0||offset>100000)fail(400,'Invalid search offset.');
   const kind=url.searchParams.get('kind');let tracks=(await catalog()).filter(t=>kind==='playable'?!!t.audioUrl:kind==='vocals'?t.provider==='wikimedia':kind==='spotify'?t.metadataOnly:true).filter(t=>`${t.title} ${t.artist}`.toLowerCase().includes(q.toLowerCase()));
   if(url.searchParams.get('outside')==='true'){const lists=await call('collections');const members=new Set(lists.flatMap(p=>p.tracks.map(t=>t.song.source?.key||`${t.song.artist}\0${t.song.title}`)));tracks=tracks.filter(t=>!members.has(t.key)&&!members.has(`${t.artist}\0${t.title}`));}
   tracks.sort((a,b)=>a.title.localeCompare(b.title));json(res,200,{provider:'Incompetech',total:tracks.length,offset,items:tracks.slice(offset,offset+20)});return true;
  }
  const record=url.pathname.match(/^\/api\/music\/([A-Z0-9]+)\/record$/);if(record&&req.method==='POST'){const track=await find(record[1]),song=await ensure(track);const ready=await prepareAudio(track,song);json(res,200,{...song,...(ready?{playbackUrl:`/api/songs/${song.id}/audio`}:{})});return true;}
  const save=url.pathname.match(/^\/api\/music\/([A-Z0-9]+)\/save$/);
  if(save&&req.method==='POST'){
   const input=await body(req),playlistId=uuid(input?.playlistId);if(!(await call('collections')).some(p=>p.id===playlistId))fail(404,'Playlist not found.');
   const track=await find(save[1]),song=await ensure(track);await prepareAudio(track,song);
   const playlist=await call('collection-mutate',{operation:'add',id:playlistId,songId:song.id});json(res,200,{song,playlist});return true;
  }
  if(url.pathname==='/api/music/compare'&&req.method==='POST'){
   const input=await body(req),sourceId=id(String(input?.sourceId)),track=await find(input?.key??'');const lists=await call('collections'),members=lists.flatMap(p=>p.tracks.map(t=>t.song));
   const source=members.find(s=>s.id===sourceId);if(!source)fail(400,'Choose a source track from a playlist.');
   if(members.some(s=>s.source?.key===track.key||(s.title===track.title&&s.artist===track.artist)))fail(400,'The candidate is already in a collection playlist.');
   if(!track.tempo||source.source?.knownFeatures&&!source.source.knownFeatures.includes('tempo'))fail(422,'Both tracks need a published or supplied tempo for this comparison.');
   const candidate=await ensure(track),result=await call('weighted-compare',{id:sourceId,other:candidate.id,weights:{tempo:1,energy:0,danceability:0,valence:0,genre:0}});
   json(res,200,{...result,candidate,source,basis:'Published/supplied tempo only. Mood and energy are unmeasured; this is not audio similarity.'});return true;
  }
  return false;
 };
}
