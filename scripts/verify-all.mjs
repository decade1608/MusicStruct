/* One process tree keeps localhost access consistent in restricted Windows sessions. */
import {spawn} from 'node:child_process';
import {mkdir,readFile,appendFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import net from 'node:net';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pg='C:/Program Files/PostgreSQL/18/bin/';
const run=async(exe,args,options={})=>new Promise((resolve,reject)=>{const p=spawn(exe,args,{windowsHide:true,stdio:'inherit',...options});p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(Error(`${path.basename(exe)} exited ${c}`)));});
const freePort=async()=>{const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;};
const runDir=process.env.MUSICSTRUCT_VERIFY_DIR||path.join(root,'.local',`verification-${Date.now()}`);await mkdir(runDir,{recursive:true});
const data=path.join(runDir,'postgres');
try{await readFile(path.join(data,'PG_VERSION'));}catch{await run(pg+'initdb.exe',['-D',data,'-U','musicstruct','--auth=trust','--encoding=UTF8','--locale=C','--no-sync','-c','max_connections=20','-c','shared_buffers=16MB']);}
const port=await freePort();let database,browser;
try{
 database=spawn(pg+'postgres.exe',['-D',data,'-p',String(port),'-h','127.0.0.1'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Database readiness timeout')),20000);database.stderr.on('data',b=>{const s=b.toString();if(s.includes('ready to accept connections')){clearTimeout(timer);resolve();}if(s.includes('FATAL'))console.error(s);});database.on('error',reject);database.on('exit',c=>{clearTimeout(timer);reject(Error(`Database exited ${c}`));});});
 console.log(`Isolated verification database ready on ${port}`);
 const env={...process.env,MUSICSTRUCT_TEST_PORT:String(port),PGCONNECT_TIMEOUT:'5'};
 if(!process.env.MUSICSTRUCT_SKIP_CORE_TESTS)await run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/test.ps1')],{env});
 if(!process.env.MUSICSTRUCT_SKIP_CORE_TESTS)await run(process.execPath,[path.join(root,'tests/launcher.mjs')],{env:{...env,MUSICSTRUCT_DATA_DIR:data,MUSICSTRUCT_PGPORT:String(port)}});
 const browserPort=await freePort();
 browser=spawn(process.env.MUSICSTRUCT_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--disable-gpu','--disable-software-rasterizer','--disable-breakpad','--disable-crash-reporter','--noerrdialogs','--no-first-run',`--remote-debugging-port=${browserPort}`,`--user-data-dir=${path.join(runDir,'browser')}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 browser.stderr.on('data',b=>{appendFile(path.join(runDir,'browser-error.log'),b).catch(()=>{});});
 let ready=false;for(let i=0;i<80;i++){try{await fetch(`http://127.0.0.1:${browserPort}/json/version`,{signal:AbortSignal.timeout(500)});ready=true;break;}catch{await new Promise(r=>setTimeout(r,200));}}
 if(!ready)throw Error('Browser debugger did not become ready');
 await run(process.execPath,[path.join(root,'tests/browser-runner.mjs')],{env:{...env,BROWSER_DEBUG_PORT:String(browserPort)}});
 console.log('ALL CHECKS PASSED. Screenshots: .local/screenshots. Disposable database retained only for diagnostic files.');
}finally{
 if(browser)browser.kill();
 if(database){try{await run(pg+'pg_ctl.exe',['-D',data,'-m','fast','-w','stop']);}catch{database.kill();}}
}
