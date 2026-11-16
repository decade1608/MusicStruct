import {featureRoutes,weights} from './features.mjs';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function backend(args,input='') {
 return new Promise((resolve,reject)=>{
  const child=spawn(path.join(root,'backend/bin/musicstruct.exe'),args,{windowsHide:true,env:{...process.env,PATH:`C:\\Program Files\\PostgreSQL\\18\\bin;C:\\msys64\\ucrt64\\bin;${process.env.PATH}`},stdio:['pipe','pipe','pipe']});
  let out='',err='',settled=false;
  const timer=setTimeout(()=>{child.kill();fail(503,'Backend timed out');},10000);
  const fail=(status,message)=>{if(!settled){settled=true;clearTimeout(timer);reject(Object.assign(new Error(message),{status}));}};
  child.on('error',()=>fail(503,'C backend is unavailable. Run scripts/build.ps1.'));
  child.stdout.on('data',b=>{out+=b;if(out.length>8_000_000){child.kill();fail(503,'Backend response is too large');}});
  child.stderr.on('data',b=>{err+=b;});
  child.stdin.on('error',()=>{});
  child.on('close',code=>{
   if(settled)return;
   if(code!==0){if(process.env.MUSICSTRUCT_DEBUG)console.error(err);fail(code===3||code===6?409:code===4?404:code===5?503:400,code===3?'That song ID already exists.':code===6?'The collection changed. Refresh and try again.':code===4?'Record not found, or nothing remains to undo.':code===5?'Database unavailable. Start the local database or check your connection.':'The backend rejected this record. Check its values.');return;}
   clearTimeout(timer);settled=true;
   try{resolve(out.trim()?JSON.parse(out):{});}catch{reject(Object.assign(new Error('Invalid backend response'),{status:502}));}
  });
  child.stdin.end(input);
 });
}
function invalid(message){throw Object.assign(new Error(message),{status:400});}
export function validateSong(s){
 if(!s||typeof s!=='object'||Array.isArray(s))invalid('Provide a song object.');
 const result={};
 for(const [key,max,optional] of [['title',99],['artist',99],['genre',49],['album',99,true]]){
  const v=s[key]??(optional?'':null);
  if(typeof v!=='string'||v.includes('\0')||(!optional&&!v.trim())||Buffer.byteLength(v.trim())>max)invalid(`${key}: enter ${optional?'up to':'1–'}${max} UTF-8 bytes.`);
  result[key]=v.trim();
 }
 const ranges={id:[1,2147483647,true],year:[0,9999,true],duration:[1,86400,true],tempo:[0.01,400],energy:[0,1],danceability:[0,1],valence:[0,1],acousticness:[0,1,false,0],instrumentalness:[0,1,false,0],speechiness:[0,1,false,0],loudness:[-100,10,false,-12],musical_key:[0,11,true,0],time_signature:[1,16,true,4]};
 for(const [key,[min,max,integer,fallback]] of Object.entries(ranges)){
  const v=s[key]??fallback;if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))invalid(`${key} must be ${integer?'an integer':'a number'} between ${min} and ${max}.`);result[key]=v;
 }
 for(const key of ['sections','components']){
  const clips=s[key]??[];if(!Array.isArray(clips)||clips.length>200)invalid(`${key}: at most 200 clips.`);
  result[key]=clips.map(c=>{
   if(!c||typeof c.name!=='string'||!c.name.trim()||c.name.includes('\0')||Buffer.byteLength(c.name.trim())>49||typeof c.start!=='number'||typeof c.end!=='number'||!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end<=c.start||c.end>result.duration)invalid(`${key}: every clip needs a name and 0 ≤ start < end ≤ duration.`);
   return {name:c.name.trim(),start:c.start,end:c.end};
  });
 }
 result.synthetic=s.synthetic===true;return result;
}
const id=s=>{if(!/^[1-9]\d*$/.test(s??'')||Number(s)>2147483647)invalid('Invalid song ID.');return Number(s);};
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req){
 if(!req.headers['content-type']?.startsWith('application/json'))throw Object.assign(new Error('Use application/json.'),{status:415});
 let size=0;const chunks=[];
 for await(const chunk of req){size+=chunk.length;if(size>2097152)throw Object.assign(new Error('Import exceeds 2 MB.'),{status:413});chunks.push(chunk);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{invalid('Invalid JSON.');}
}
const call=(command,data={})=>backend([command],JSON.stringify(data));
export function createServer(){const features=featureRoutes({root,call,id,json,body,validateSong});return http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
   if(!['GET','HEAD'].includes(req.method)){
    const origin=req.headers.origin;
    if(origin&&origin!==`http://${req.headers.host}`)return json(res,403,{error:'Cross-origin writes are not allowed.'});
   }
   if(await features(req,res,url))return;
   if(req.method==='GET'&&url.pathname==='/api/health')return json(res,200,await backend(['health']));
   if(req.method==='GET'&&url.pathname==='/api/songs'){
    const q=url.searchParams.get('q')??'',genre=url.searchParams.get('genre')??'',sort=url.searchParams.get('sort')??'title';
    if(Buffer.byteLength(q)>200||Buffer.byteLength(genre)>49)invalid('Search text is too long.');
    if(!['title','tempo','energy','duration','recent'].includes(sort))invalid('Invalid sort order.');
    return json(res,200,await call('catalog',{q,genre,sort,descending:url.searchParams.get('descending')==='true'}));
   }
   if(req.method==='GET'&&/^\/api\/songs\/[^/]+$/.test(url.pathname)){
    return json(res,200,await call('detail',{id:id(url.pathname.split('/').pop())}));
   }
   if(req.method==='GET'&&url.pathname==='/api/compare'){
    const a=id(url.searchParams.get('a')),b=id(url.searchParams.get('b'));
    return json(res,200,await call('weighted-compare',{id:a,other:b,weights:weights(url.searchParams.get('weights'))}));
   }
   const trackRoute=url.pathname.match(/^\/api\/songs\/([1-9]\d*)\/(recommendations|analysis)$/);
   if(req.method==='GET'&&trackRoute)return json(res,200,await call(trackRoute[2]==='analysis'?'analyze':'recommend',{id:id(trackRoute[1]),weights:weights(url.searchParams.get('weights'))}));
   if(req.method==='GET'&&url.pathname==='/api/history')return json(res,200,await call('history'));
   if(req.method==='POST'&&url.pathname==='/api/undo')return json(res,200,await call('undo'));
   if(req.method==='GET'&&url.pathname==='/api/queue')return json(res,200,await call('queue'));
   if(req.method==='POST'&&url.pathname==='/api/queue')return json(res,201,await call('enqueue',{id:id(String((await body(req)).id))}));
   if(req.method==='POST'&&url.pathname==='/api/queue/process')return json(res,200,await call('process'));
   if(req.method==='DELETE'&&/^\/api\/queue\/\d+$/.test(url.pathname))return json(res,200,await call('cancel',{ticket:id(url.pathname.split('/').pop())}));
   if(req.method==='GET'&&url.pathname==='/api/export'){
    res.setHeader('Content-Disposition','attachment; filename="musicstruct-collection.json"');return json(res,200,{format:'MusicStruct',version:1,songs:await backend(['list'])});
   }
   if(req.method==='POST'&&url.pathname==='/api/import'){
    const data=await body(req),items=Array.isArray(data)?data:data?.songs;
    if(!Array.isArray(items)||items.length>1000)invalid('Import an array of up to 1,000 song records.');
    const validated=items.map(validateSong);return json(res,200,await call('import',validated));
   }
   if(req.method==='PUT'&&/^\/api\/songs\/[^/]+$/.test(url.pathname)){
    const song=validateSong(await body(req));if(song.id!==id(url.pathname.split('/').pop()))invalid('Song IDs cannot change during editing.');await call('edit',song);return json(res,200,song);
   }
   if(req.method==='DELETE'&&/^\/api\/songs\/[^/]+$/.test(url.pathname))return json(res,200,await call('delete',{id:id(url.pathname.split('/').pop())}));
   if(req.method==='POST'&&url.pathname==='/api/songs'){
    const song=validateSong(await body(req));await call('create',song);return json(res,201,song);
   }
   return json(res,404,{error:'Endpoint not found.'});
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed.'});
  const base=path.join(root,'frontend/dist');const pathname=decodeURIComponent(url.pathname);
  const filename=path.resolve(base,'.'+(pathname==='/'?'/index.html':pathname));
  if(!filename.startsWith(base+path.sep))return json(res,403,{error:'Forbidden'});
  let data;try{data=await readFile(filename);}catch{return json(res,404,{error:'Page not found. Build the frontend first.'});}
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
  res.writeHead(200,{'Content-Type':types[path.extname(filename)]??'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
 }catch(e){json(res,e.status??500,{error:e.status?e.message:'Unexpected server error.'});}
});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=createServer();server.listen(Number(process.env.PORT??3000),'127.0.0.1',()=>console.log(`MusicStruct: http://127.0.0.1:${server.address().port}`));
}
