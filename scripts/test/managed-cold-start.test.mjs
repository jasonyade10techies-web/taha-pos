import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';

test('required Hostinger entry listens before slow Nest initialization, returns 503 until ready, then serves the real handler',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'taha-hostinger-cold-'));let child,exited,output='';
 try{
  await mkdir(path.join(directory,'dist'));
  for(const name of ['main.js','server.cjs'])await writeFile(path.join(directory,name),await readFile('scripts/managed-release/'+name));
  await writeFile(path.join(directory,'runner.cjs'),"require('./main.js');");
  await writeFile(path.join(directory,'dist/config.js'),"exports.CONFIG=Symbol('config');");
  await writeFile(path.join(directory,'dist/main.js'),`exports.createApp=async()=>{await new Promise(resolve=>setTimeout(resolve,4000));return {get:()=>({cloud:true,trustedProxy:false,port:Number(process.env.PORT),bindHost:'127.0.0.1'}),init:async()=>{},getHttpAdapter:()=>({getInstance:()=>(req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:'real-api',method:req.method}));}}),getHttpServer:()=>{throw Error('Cloud must use the already listening server');},listen:()=>{throw Error('Cloud must not open a second listener');},close:async()=>{}};};exports.startLanTls=async()=>{};`);
  const reservation=createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  child=spawn(process.execPath,['runner.cjs'],{cwd:directory,env:{...process.env,NODE_ENV:'production',TAHA_RUNTIME:'cloud',TAHA_DEPLOYMENT_ENV:'staging',TAHA_BIND_HOST:'127.0.0.1',PORT:String(port),MIGRATE_ON_START:'false'},windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',bytes=>{output+=bytes;});child.stderr.on('data',bytes=>{output+=bytes;});
  exited=new Promise(resolve=>child.once('exit',resolve));
  const origin='http://127.0.0.1:'+port;let response;const deadline=Date.now()+1500;
  while(Date.now()<deadline){try{response=await fetch(origin+'/api/v1/checkout',{method:'POST',signal:AbortSignal.timeout(500)});break;}catch{await new Promise(resolve=>setTimeout(resolve,40));}}
  assert(response,'No listener before Hostinger deadline: '+output);assert.equal(response.status,503);assert.equal(response.headers.get('retry-after'),'1');assert.equal((await response.json()).code,'STARTING');
  const readyDeadline=Date.now()+7000;let ready=false;while(Date.now()<readyDeadline){const probe=await fetch(origin+'/api/v1/health/live',{signal:AbortSignal.timeout(1000)});if(probe.status===200){assert.equal((await probe.json()).status,'real-api');ready=true;break;}await new Promise(resolve=>setTimeout(resolve,100));}
  assert(ready,'Real handler did not become ready: '+output);assert.match(output,/"stage":"ready"/);
  child.kill();await Promise.race([exited,new Promise((_,reject)=>setTimeout(()=>reject(Error('Shutdown left the early listener open')),3000))]);assert(child.exitCode!==null||child.signalCode!==null);
 }finally{if(child&&child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exited;}await rm(directory,{recursive:true,force:true});}
});
