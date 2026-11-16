import {fileURLToPath} from 'node:url';
import {execFileSync,spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {readFile,mkdir,mkdtemp} from 'node:fs/promises';
import {backend,createServer} from '../api/server.mjs';
const name='musicstruct_test_'+randomUUID().replaceAll('-','');
const pg='C:/Program Files/PostgreSQL/18/bin/';
const port=process.env.MUSICSTRUCT_TEST_PORT??'55432';
const args=['-h','127.0.0.1','-p',port,'-U','musicstruct'];
execFileSync(pg+'createdb.exe',[...args,name],{windowsHide:true});
let server;
try{
 process.env.MUSICSTRUCT_DATABASE_URL=`host=127.0.0.1 port=${port} user=musicstruct dbname=${name} connect_timeout=5`;
 await backend(['init'],await readFile(new URL('../database/schema.sql',import.meta.url),'utf8'));
 await backend(['init'],await readFile(new URL('../database/workflows.sql',import.meta.url),'utf8'));
await backend(['init'],await readFile(new URL('../database/media.sql',import.meta.url),'utf8'));
await backend(['init'],await readFile(new URL('../database/collections.sql',import.meta.url),'utf8'));
 for(const song of JSON.parse(await readFile(new URL('../backend/data/demo.json',import.meta.url),'utf8')))await backend(['add'],JSON.stringify(song));
 process.env.MUSICSTRUCT_CATALOG_FIXTURE=fileURLToPath(new URL('./catalog-fixture.json',import.meta.url));
 const mediaRoot=new URL('../.local/test-media/',import.meta.url);await mkdir(mediaRoot,{recursive:true});process.env.MUSICSTRUCT_MEDIA_DIR=await mkdtemp(fileURLToPath(mediaRoot)+'browser-');
 const nativeFetch=globalThis.fetch;globalThis.fetch=async(url,options)=>{const prefix='https://incompetech.com/music/royalty-free/mp3-royaltyfree/';if(String(url).startsWith(prefix)){const name=decodeURIComponent(String(url).slice(prefix.length));if(!['Carefree.mp3','Cipher2.mp3','The Builder.mp3'].includes(name))throw Error('Unknown fixture audio');const bytes=await readFile(new URL('../.local/licensed-downloads/'+encodeURIComponent(name),import.meta.url));return new Response(bytes,{headers:{'Content-Type':'audio/mpeg','Content-Length':String(bytes.length)}});}return nativeFetch(url,options);};
 server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[fileURLToPath(new URL(process.env.MUSICSTRUCT_LIVE_YOUTUBE?'./youtube-live.mjs':'./browser.mjs',import.meta.url))],{stdio:'inherit',windowsHide:true,env:{...process.env,BROWSER_BASE_URL:`http://127.0.0.1:${server.address().port}`}});child.on('error',reject);child.on('exit',resolve);});
 if(code!==0)throw Error('Browser tests failed');
}finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}execFileSync(pg+'dropdb.exe',[...args,'--force',name],{windowsHide:true});}
