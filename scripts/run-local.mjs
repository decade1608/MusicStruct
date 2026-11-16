import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,access} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createServer} from '../api/server.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pg=process.env.MUSICSTRUCT_PG_BIN||'C:/Program Files/PostgreSQL/18/bin';
const data=process.env.MUSICSTRUCT_DATA_DIR||path.join(root,'.local/postgres');
const dbPort=process.env.MUSICSTRUCT_PGPORT||'55432';
const exec=promisify(execFile);
let ownedDatabase,server,log,closing=false;
const pgArgs=['-h','127.0.0.1','-p',dbPort,'-U','musicstruct'];
const psql=async(sql,database='postgres')=>(await exec(path.join(pg,'psql.exe'),[...pgArgs,'-d',database,'-tAc',sql],{windowsHide:true,timeout:5000,env:{...process.env,PGCONNECT_TIMEOUT:'2'}})).stdout.trim();
async function shutdown(){
 if(closing)return;closing=true;
 if(server)await new Promise(resolve=>server.close(resolve));
 if(ownedDatabase&&ownedDatabase.exitCode===null){
  try{await exec(path.join(pg,'pg_ctl.exe'),['-D',data,'-m','fast','-w','stop'],{windowsHide:true,timeout:15000});}
  catch{ownedDatabase.kill();}
 }
 log?.end();
}
async function main(){
 if(!process.env.MUSICSTRUCT_DATABASE_URL){
  await mkdir(path.dirname(data),{recursive:true});
  let running=false;
  try{const activeDirectory=await psql('SHOW data_directory');if(path.resolve(activeDirectory).toLowerCase()!==path.resolve(data).toLowerCase())throw Object.assign(Error(`Port ${dbPort} belongs to a different PostgreSQL cluster. Set MUSICSTRUCT_PGPORT to a free port.`),{foreign:true});running=true;}
  catch(e){if(e.foreign)throw e;}
  if(!running){
   try{await access(path.join(data,'PG_VERSION'));}catch{await exec(path.join(pg,'initdb.exe'),['-D',data,'-U','musicstruct','--auth=trust','--encoding=UTF8','--locale=C'],{windowsHide:true,timeout:180000});}
   const logPath=path.join(root,'.local',`postgres-${Date.now()}.log`);await mkdir(path.dirname(logPath),{recursive:true});log=createWriteStream(logPath);
   ownedDatabase=spawn(path.join(pg,'postgres.exe'),['-D',data,'-p',dbPort,'-h','127.0.0.1'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
   ownedDatabase.stdout.pipe(log,{end:false});ownedDatabase.stderr.pipe(log,{end:false});
   await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error(`Database startup timed out. See ${logPath}`)),30000);ownedDatabase.stderr.on('data',chunk=>{output+=chunk;if(output.includes('ready to accept connections')){clearTimeout(timer);resolve();}});ownedDatabase.once('error',e=>{clearTimeout(timer);reject(e);});ownedDatabase.once('exit',code=>{clearTimeout(timer);reject(Error(`Database exited ${code}. See ${logPath}`));});});
  }
  if((await psql("SELECT 1 FROM pg_database WHERE datname='musicstruct'"))!=='1')await exec(path.join(pg,'createdb.exe'),[...pgArgs,'musicstruct'],{windowsHide:true,timeout:15000});
  process.env.MUSICSTRUCT_DATABASE_URL=`host=127.0.0.1 port=${dbPort} user=musicstruct dbname=musicstruct connect_timeout=5`;
 }
 const seeded=await exec(process.execPath,[path.join(root,'scripts/seed.mjs')],{windowsHide:true,timeout:60000});process.stdout.write(seeded.stdout);
 server=createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(process.env.PORT||3000),'127.0.0.1',resolve);});
 console.log(`MusicStruct is ready: http://127.0.0.1:${server.address().port}\nKeep this window open. Press Ctrl+C to stop.`);
 if(ownedDatabase)ownedDatabase.on('exit',()=>{if(!closing){console.error('The local database stopped. Restart MusicStruct to reconnect.');shutdown().then(()=>{process.exitCode=1;});}});
}
process.on('SIGINT',()=>shutdown());process.on('SIGTERM',()=>shutdown());
try{await main();}catch(e){console.error(e.message);await shutdown();process.exitCode=1;}
