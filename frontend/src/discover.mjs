// Compatibility with launchers still running the API from before Discover was added.
export async function discoverTracks(request,{sourceId,lists,offset=0,signal}){
 try{return await request(`/music/discover?sourceId=${sourceId}&offset=${offset}`,{signal});}
 catch(e){if(e.status!==404||e.message!=='Endpoint not found.')throw e;}
 const members=lists.flatMap(p=>p.tracks.map(t=>t.song));const source=members.find(s=>s.id===Number(sourceId));
 if(!source)throw Error('Choose a track from a playlist.');
 if(!(source.tempo>0)||(source.source&&!source.source.knownFeatures?.includes('tempo')))throw Error('This track needs a known tempo to find matches.');
 const first=await request('/music/search?outside=true&offset=0',{signal});const tracks=[...first.items];
 if(first.total>10000)throw Error('Restart MusicStruct to search this larger catalog.');
 let next=20;
 await Promise.all(Array.from({length:4},async()=>{while(next<first.total){const start=next;next+=20;const page=await request(`/music/search?outside=true&offset=${start}`,{signal});tracks.push(...page.items);}}));
 const keys=new Set(members.map(s=>s.source?.key)),names=new Set(members.map(s=>`${s.artist}\0${s.title}`));
 const unique=new Map(tracks.map(t=>[t.key,t]));const ranked=[...unique.values()].filter(t=>t.tempo>0&&!keys.has(t.key)&&!names.has(`${t.artist}\0${t.title}`)).map(t=>({...t,score:1-Math.abs(source.tempo-t.tempo)/Math.max(source.tempo,t.tempo)})).sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key));
 return {source,total:ranked.length,offset,items:ranked.slice(offset,offset+20),basis:'Ranked by published/supplied tempo only. Not audio or mood similarity.'};
}
