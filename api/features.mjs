import {youtubeRoutes} from './youtube.mjs';
import {catalogRoutes} from './catalog.mjs';
import {randomUUID} from 'node:crypto';
import {previewCSV} from './csv.mjs';
import {createMedia} from './media.mjs';
const defaults={tempo:.25,energy:.2,danceability:.2,valence:.15,genre:.2};
const bad=message=>{throw Object.assign(Error(message),{status:400});};
export function weights(value){
 if(value===undefined||value===null)return {...defaults};
 if(typeof value==='string'){try{value=JSON.parse(value);}catch{bad('weights must be a JSON object.');}}
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!Object.hasOwn(defaults,k)))bad('Unknown or invalid similarity weights.');
 const result={};let total=0;for(const key of Object.keys(defaults)){const v=value[key]??0;if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1000000)bad('Weights must be finite numbers from 0 to 1,000,000.');result[key]=v;total+=v;}
 if(total<=0)bad('At least one weight must be positive.');for(const key of Object.keys(result))result[key]/=total;return result;
}
export function featureRoutes({root,call,id,json,body,validateSong}){
 const media=createMedia(root,call);const youtube=youtubeRoutes({json});
 const catalog=catalogRoutes({call,body,json,id,validateSong,media});
 return async(req,res,url)=>{
  if(await youtube(req,res,url))return true;
  if(await catalog(req,res,url))return true;
  if(url.pathname==='/api/audio-library'&&req.method==='POST'){const d=await body(req);const song=validateSong({year:0,...d,id:1});const result=await call('catalog-cache',{key:'LOCAL'+randomUUID(),song,source:{provider:'local-upload',unmeasured:true,knownFeatures:['duration'],annotationMethod:'Loudness-change regions estimated during browser decoding; mixed audio is not separated into instruments.'}});json(res,201,result);return true;}
  const match=url.pathname.match(/^\/api\/songs\/([1-9]\d*)\/audio(?:\/(metadata|analysis))?$/);
  if(match){const songId=id(match[1]);
   if(req.method==='PUT'&&!match[2]){json(res,201,await media.upload(req,songId));return true;}
   if(req.method==='DELETE'&&!match[2]){json(res,200,await media.detach(songId));return true;}
   if(['GET','HEAD'].includes(req.method)&&!match[2]){await media.stream(req,res,songId);return true;}
   if(req.method==='GET'){const result=await media.metadata(songId);json(res,200,match[2]==='analysis'?result.analysis:result);return true;}
  }
  if(req.method==='POST'&&['/api/import/csv/preview','/api/import/csv'].includes(url.pathname)){
   const input=await body(req),preview=previewCSV(input,await call('catalog'),validateSong);
   if(url.pathname.endsWith('/preview'))json(res,200,preview);
   else if(!preview.valid)json(res,422,{error:'Correct the invalid CSV rows before importing.',preview});
   else json(res,200,{...await call('import',preview.rows.map(r=>r.song)),preview:preview.counts});return true;
  }
  if(req.method==='POST'&&['/api/playlists/preview','/api/playlists'].includes(url.pathname)){
   const input=await body(req);if(!input||typeof input!=='object')bad('Provide a playlist specification.');
   const spec={id:id(String(input.startId)),targetSeconds:input.targetSeconds,maxTracks:input.maxTracks??20,weights:weights(input.weights)};
   if(!Number.isInteger(spec.targetSeconds)||spec.targetSeconds<1||spec.targetSeconds>86400||!Number.isInteger(spec.maxTracks)||spec.maxTracks<1||spec.maxTracks>100)bad('Target is 1–86,400 seconds and maxTracks is 1–100.');
   const song=await call('detail',{id:spec.id});if(song.duration>spec.targetSeconds)bad('The starting track exceeds the target duration.');
   const result={...await call('playlist',spec),weights:spec.weights};
   if(url.pathname.endsWith('/preview'))json(res,200,result);
   else{if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>120||input.name.includes('\0'))bad('Playlist name must be 1–120 characters.');json(res,201,await call('playlist-save',{id:randomUUID(),name:input.name.trim(),specification:spec,result}));}return true;
  }
  if(req.method==='GET'&&url.pathname==='/api/playlists'){json(res,200,await call('playlist-list'));return true;}
  const playlist=url.pathname.match(/^\/api\/playlists\/([0-9a-f-]{36})$/);
  if(playlist&&['GET','DELETE'].includes(req.method)){
   if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(playlist[1]))bad('Invalid playlist ID.');
   const result=await call(req.method==='GET'?'playlist-get':'playlist-delete',{id:playlist[1]});json(res,result?200:404,result??{error:'Playlist not found.'});return true;
  }
  return false;
 };
}
