import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

test('compiled Hostinger ZIP entry and build verifier work with production-only environment and reject tampering',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'taha-managed-contract-'));
 try{
  const pkg={name:'isolated-contract',version:'1.0.0',main:'main.js',private:true,scripts:{build:'node verify-release.cjs',start:'node main.js'},dependencies:{}};
  const lock={name:pkg.name,version:pkg.version,lockfileVersion:3,packages:{'':{name:pkg.name,version:pkg.version,dependencies:{},private:true,scripts:pkg.scripts}}};
  const payload={
   'main.js':await readFile('scripts/managed-release/main.js'),
   'server.cjs':await readFile('scripts/managed-release/server.cjs'),
   'verify-release.cjs':await readFile('scripts/managed-release/verify-release.cjs'),
   'verify-lock.cjs':await readFile('scripts/managed-release/verify-lock.cjs'),
   'package.json':JSON.stringify(pkg),
   'package-lock.json':JSON.stringify(lock),
   'release-lock.json':JSON.stringify(lock),
   'dist/main.js':`const server=new(require('node:events').EventEmitter)();exports.createApp=async()=>({get:()=>({port:41234,bindHost:'0.0.0.0',cloud:true,trustedProxy:false}),getHttpServer:()=>server,listen:async(port,host)=>{if(port!==41234||host!=='0.0.0.0'||process.env.NODE_ENV!=='production')throw Error('Invalid startup');server.emit('request',{socket:{remoteAddress:'127.0.0.1'},headers:{'x-forwarded-proto':'https',cookie:'DO_NOT_LOG_THIS_FIXTURE'},url:'/?private=DO_NOT_LOG_THIS_FIXTURE'});}});exports.startLanTls=async()=>{};`,
   'dist/config.js':`exports.CONFIG=Symbol('configuration');`,
   'dist-tools/scripts/migrate-staging.js':'// isolated contract fixture',
   'dist-tools/scripts/initialize-staging.js':'// isolated contract fixture',
   'dist-tools/scripts/seed-staging.js':'// isolated contract fixture',
   'public/index.html':'<!doctype html><title>Compiled fixture</title>',
   'public/deployment.json':JSON.stringify({dataProvider:'api',mockAuthentication:false,apiBase:'/api/v1'})
  };
  const files=[];for(const [name,value]of Object.entries(payload)){const bytes=Buffer.from(value);await mkdir(path.dirname(path.join(root,name)),{recursive:true});await writeFile(path.join(root,name),bytes);files.push({path:name,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
  files.find(file=>file.path==='package-lock.json').verification='npm-runtime-pins-v1';
  await writeFile(path.join(root,'release-manifest.json'),JSON.stringify({version:'fixture',sourceCommit:'a'.repeat(40),files}));
  const env={...process.env,NODE_ENV:'production',TAHA_RUNTIME:'local',NODE_PATH:'',PATH:'',MIGRATE_ON_START:'false'};
  const build=spawnSync(process.execPath,['verify-release.cjs'],{cwd:root,env,encoding:'utf8',timeout:10000});assert.equal(build.status,0,build.stderr);
  delete lock.packages[''].private;delete lock.packages[''].scripts;
  await writeFile(path.join(root,'package-lock.json'),JSON.stringify(lock,null,4)+'\n');
  const normalized=spawnSync(process.execPath,['verify-release.cjs'],{cwd:root,env,encoding:'utf8',timeout:10000});assert.equal(normalized.status,0,normalized.stderr);
  const start=spawnSync(process.execPath,['main.js'],{cwd:root,env,encoding:'utf8',timeout:10000});assert.equal(start.status,0,start.stderr);assert.match(start.stdout,/"stage":"ready"/);assert.match(start.stdout,/"peerAddress":"127.0.0.1"/);assert(!start.stdout.includes('DO_NOT_LOG_THIS_FIXTURE'));
  await writeFile(path.join(root,'public/index.html'),'corrupt');const invalid=spawnSync(process.execPath,['verify-release.cjs'],{cwd:root,env,encoding:'utf8',timeout:10000});assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/Release verification failed/);
 }finally{await rm(root,{recursive:true,force:true});}
});
