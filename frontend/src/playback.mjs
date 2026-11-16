export function officialSource(track){try{const u=new URL(track.sourceUrl||track.source?.sourceUrl);return u.protocol==='https:'&&['open.spotify.com','incompetech.com','commons.wikimedia.org'].includes(u.hostname)?u.href:null;}catch{return null;}}
export async function resolvePlayback(track,{api,send}){
 if(!track.audioUrl){const rows=await api(`/songs?q=${encodeURIComponent(track.title.slice(0,90))}`);const song=rows.find(s=>s.source?.key===track.key||(s.title===track.title&&s.artist===track.artist));if(song){try{await api(`/songs/${song.id}/audio/metadata`);return {song:{...song,playbackUrl:`/api/songs/${song.id}/audio`}};}catch(e){if(e.status!==404)throw e;}}return {youtube:track,sourceUrl:officialSource(track)};}
 try{return {song:await send(`/music/${track.key}/record`,{})};}
 catch(e){if(e.status!==404||e.message!=='Endpoint not found.')throw e;
  const rows=await api(`/songs?q=${encodeURIComponent(track.title.slice(0,90))}`);const local=rows.find(s=>s.source?.key===track.key||(s.title===track.title&&s.artist===track.artist));if(local){try{await api(`/songs/${local.id}/audio/metadata`);return {song:{...local,playbackUrl:`/api/songs/${local.id}/audio`}};}catch(err){if(err.status!==404)throw err;}}
  return {legacy:true,song:{...track,id:`catalog:${track.key}`,sections:[],components:[],transient:true,playbackUrl:track.audioUrl,source:{...track,unmeasured:!track.knownFeatures?.includes('energy'),knownFeatures:track.knownFeatures||['tempo','duration']}}};
 }
}
