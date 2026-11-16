import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
const freePort=async()=>{const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;};
assert.ok(process.env.MUSICSTRUCT_DATA_DIR?.includes('verification-'),'Launcher smoke test requires a disposable verification cluster');
async function launch(){
 const port=await freePort();const child=spawn(process.execPath,[fileURLToPath(new URL('../scripts/run-local.mjs',import.meta.url))],{windowsHide:true,env:{...process.env,MUSICSTRUCT_SEED_DEMOS:'1',PORT:String(port),MUSICSTRUCT_DATABASE_URL:''},stdio:['ignore','pipe','pipe']});
 let output='';child.stderr.on('data',b=>output+=b);
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{child.kill();reject(Error('Launcher timeout: '+output));},30000);child.stdout.on('data',b=>{output+=b;if(output.includes('MusicStruct is ready:')){clearTimeout(timeout);resolve();}});child.once('error',reject);child.once('exit',code=>{clearTimeout(timeout);reject(Error(`Launcher exited ${code}: ${output}`));});});
 return {child,url:`http://127.0.0.1:${port}`};
}
async function stop(child){if(child.exitCode!==null)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
let app;
try{
 app=await launch();assert.equal((await(await fetch(app.url+'/api/songs')).json()).length,15);
 assert.equal((await fetch(app.url+'/api/songs/1',{method:'DELETE'})).status,200);await stop(app.child);
 app=await launch();assert.equal((await fetch(app.url+'/api/songs/1')).status,404,'demo deletion survives complete application restart');
 assert.equal((await fetch(app.url+'/api/undo',{method:'POST'})).status,200);assert.equal((await fetch(app.url+'/api/songs/1')).status,200);
 console.log('PASS: launcher initializes/migrates/seeds, serves UI/API, restart preserves deletion, undo restores track');
}finally{if(app)await stop(app.child);}
