import {mkdir,open,unlink,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
const MAX=104857600;
const failure=(status,message)=>Object.assign(Error(message),{status});
export function parseRange(header,size){
 if(!header)return {start:0,end:size-1,partial:false};
 const match=/^bytes=(\d*)-(\d*)$/.exec(header);if(!match||(!match[1]&&!match[2]))throw failure(416,'Use one valid byte range.');
 let start,end;if(!match[1]){const count=Number(match[2]);if(!Number.isSafeInteger(count)||count<=0)throw failure(416,'Invalid suffix range.');start=Math.max(0,size-count);end=size-1;}
 else{start=Number(match[1]);end=match[2]?Number(match[2]):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)throw failure(416,'Range outside file.');end=Math.min(end,size-1);}
 return {start,end,partial:true};
}
function analyze(root,file){return new Promise((resolve,reject)=>{
 const child=spawn(path.join(root,'backend/bin/audio-analyze.exe'),[file],{windowsHide:true,env:{...process.env,PATH:`C:\\msys64\\ucrt64\\bin;${process.env.PATH}`},stdio:['ignore','pipe','pipe']});let output='',error='';
 const timer=setTimeout(()=>{child.kill();reject(failure(422,'Audio analysis timed out.'));},20000);
 child.stdout.setEncoding('utf8');child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>error+=b);
 child.on('error',()=>{clearTimeout(timer);reject(failure(503,'Build the audio analyzer first.'));});
 child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(failure(422,error.trim()||'Unsupported or malformed WAV.'));try{resolve(JSON.parse(output));}catch{reject(failure(502,'Invalid analyzer response.'));}});
});}
export function createMedia(root,call){
 const directory=process.env.MUSICSTRUCT_MEDIA_DIR||path.join(root,'.local/media');
 const assetPath=id=>{if(!/^[0-9a-f-]{36}$/.test(id))throw failure(500,'Invalid stored asset ID.');return path.join(directory,id);};
 return {
  async upload(req,id){
   await call('detail',{id});const mime=(req.headers['content-type']??'').split(';')[0];if(!['audio/wav','audio/x-wav','audio/mpeg','audio/mp4','audio/ogg','audio/flac'].includes(mime))throw failure(415,'Upload WAV, MP3, M4A, OGG, or FLAC as a raw audio body.');
   if(Number(req.headers['content-length'])>MAX)throw failure(413,'Audio exceeds 100 MB.');
   const asset=randomUUID();await mkdir(directory,{recursive:true});const file=assetPath(asset);let handle,registered=false;
   try{
    handle=await open(file,'wx');const hash=createHash('sha256');let size=0,header=Buffer.alloc(0);
    for await(const chunk of req){size+=chunk.length;if(size>MAX)throw failure(413,'Audio exceeds 100 MB.');if(header.length<64)header=Buffer.concat([header,chunk]).subarray(0,64);hash.update(chunk);let offset=0;while(offset<chunk.length){const wrote=await handle.write(chunk,offset,chunk.length-offset);offset+=wrote.bytesWritten;}}
    await handle.close();handle=null;if(size<12)throw failure(422,'Empty or truncated audio.');
    const wav=header.toString('ascii',0,4)==='RIFF'&&header.toString('ascii',8,12)==='WAVE';
    const mp3=header.toString('ascii',0,3)==='ID3'||(header[0]===255&&(header[1]&224)===224);
    const mp4=header.toString('ascii',4,8)==='ftyp';
    if(!(mime.includes('wav')?wav:mime==='audio/mpeg'?mp3:mime==='audio/ogg'?header.toString('ascii',0,4)==='OggS':mime==='audio/flac'?header.toString('ascii',0,4)==='fLaC':mp4))throw failure(422,'Audio signature does not match the content type.');
    const analysis=wav?{status:'complete',...await analyze(root,file)}:{status:'unsupported',reason:'Automatic analysis currently supports PCM or float WAV. MP3/M4A playback depends on browser codec support.'};
    let name;try{name=decodeURIComponent(req.headers['x-audio-name']??'audio');}catch{throw failure(400,'x-audio-name must be URI-encoded text.');}
    name=path.basename(name.replaceAll('\\','/')).replace(/[\x00-\x1f\x7f]/g,'').slice(0,200)||'audio';
    const result=await call('audio-attach',{id,asset_id:asset,name,mime:mime.includes('wav')?'audio/wav':mime,bytes:size,sha256:hash.digest('hex'),analysis});registered=true;
    if(result.previous_asset)await unlink(assetPath(result.previous_asset)).catch(()=>{});
    return await call('audio-get',{id});
   }finally{if(handle)await handle.close().catch(()=>{});if(!registered)await unlink(file).catch(()=>{});}
  },
  async metadata(id){const result=await call('audio-get',{id});if(!result)throw failure(404,'No audio attached.');return result;},
  async stream(req,res,id){
   const item=await this.metadata(id);const file=assetPath(item.asset_id);let info;try{info=await stat(file);}catch{throw failure(404,'The audio file is missing from local storage.');}
   if(new URL(req.url,'http://localhost').searchParams.has('download'))res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(item.name)}`);
   const etag=`"${item.sha256}"`;res.setHeader('Accept-Ranges','bytes');res.setHeader('ETag',etag);res.setHeader('Cache-Control','private, no-cache');res.setHeader('X-Content-Type-Options','nosniff');
   if(req.headers['if-none-match']===etag){res.writeHead(304);res.end();return;}
   let range;try{range=parseRange(req.headers['if-range']&&req.headers['if-range']!==etag?null:req.headers.range,info.size);}catch(e){res.setHeader('Content-Range',`bytes */${info.size}`);throw e;}
   res.setHeader('Content-Type',item.mime);res.setHeader('Content-Length',range.end-range.start+1);if(range.partial)res.setHeader('Content-Range',`bytes ${range.start}-${range.end}/${info.size}`);
   res.writeHead(range.partial?206:200);if(req.method==='HEAD'){res.end();return;}try{await pipeline(createReadStream(file,{start:range.start,end:range.end}),res);}catch(e){if(!res.destroyed)res.destroy(e);}
  },
  async detach(id){await call('detail',{id});const previous=await call('audio-detach',{id});if(previous?.asset_id)await unlink(assetPath(previous.asset_id)).catch(()=>{});return {removed:!!previous};}
 };
}
