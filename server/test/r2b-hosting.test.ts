import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createServer,type Server} from 'node:http';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type {NestExpressApplication} from '@nestjs/platform-express';
import {installFrontend} from '../src/frontend';
import {secureTransport} from '../src/health/secure-transport';
import {configuration,type Configuration} from '../src/config';
import {LocalFileStorage} from '../src/media/file-storage';
import {stagingTarget} from '../scripts/staging-target';

async function listen(server:Server){await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert(address&&typeof address==='object');return 'http://127.0.0.1:'+address.port;}
async function close(server:Server){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}

test('packaged SPA refreshes nested routes without intercepting APIs, assets, dotfiles or writes',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'taha-r2b-spa-'));await mkdir(path.join(root,'assets'));await writeFile(path.join(root,'index.html'),'<html>REAL API BUNDLE</html>');await writeFile(path.join(root,'assets','app.js'),'const actual=true;');await writeFile(path.join(root,'deployment.json'),JSON.stringify({dataProvider:'api',mockAuthentication:false,apiBase:'/api/v1'}));
 const app=express();await installFrontend(app as unknown as NestExpressApplication,{serveFrontend:true,frontendRoot:root} as Configuration);app.get('/api/v1/health/live',(_req,res)=>res.json({status:'ok'}));app.use((_req,res)=>res.status(404).json({message:'Not found.'}));const server=createServer(app),base=await listen(server);
 try{
  for(const route of ['/dashboard','/products/a/edit','/mobile','/profile','/camera','/alerts']){const response=await fetch(base+route,{headers:{Accept:'text/html'}});assert.equal(response.status,200);assert.match(await response.text(),/REAL API BUNDLE/);assert.match(response.headers.get('cache-control')??'',/no-store/);}
  assert.equal((await fetch(base+'/api/v1/health/live')).status,200);
  for(const route of ['/api/v1/missing','/API/missing','/assets/missing.js','/.env','/%2eenv']){const response=await fetch(base+route);assert.equal(response.status,404,route);assert.doesNotMatch(await response.text(),/REAL API BUNDLE/);}
  assert.equal((await fetch(base+'/products',{method:'POST'})).status,404);assert.equal((await fetch(base+'/assets/app.js')).status,200);
  await writeFile(path.join(root,'deployment.json'),JSON.stringify({dataProvider:'local',mockAuthentication:true,apiBase:'/api/v1'}));await assert.rejects(()=>installFrontend(app as unknown as NestExpressApplication,{serveFrontend:true,frontendRoot:root} as Configuration),/real same-origin/);
 }finally{await close(server);}
});

test('TLS offload is accepted only through an explicitly trusted cloud proxy',async()=>{
 for(const [cloud,proxy,expected] of [[false,'loopback',false],[true,false,false],[true,'10.42.0.0/16',false],[true,'loopback',true]] as const){
  const app=express();app.set('trust proxy',proxy);app.get('/',(req,res)=>res.json({secure:secureTransport(req,{cloud,trustedProxy:proxy})}));const server=createServer(app),base=await listen(server);
  try{assert.equal((await(await fetch(base,{headers:{'X-Forwarded-Proto':'https'}})).json()).secure,expected);assert.equal((await(await fetch(base)).json()).secure,false);}finally{await close(server);}
 }
});

test('proxy and staging administration reject trust-all, unexpected targets and saved databases',()=>{
 const old={...process.env};try{
  Object.assign(process.env,{DATABASE_URL:'postgresql://runtime@127.0.0.1:55459/test',JWT_SECRET:'a'.repeat(32),NODE_ENV:'test',TAHA_RUNTIME:'local',PORT:'0'});
  for(const value of ['true','*','0.0.0.0/0','::/0','127.0.0.1/33']){process.env.TAHA_TRUST_PROXY=value;assert.throws(()=>configuration(),/trusted proxy/);}
  process.env.DATABASE_URL='invalid connection carrying a private value';assert.throws(()=>configuration(),error=>error instanceof Error&&error.message==='DATABASE_URL must be a valid PostgreSQL connection.');
 }finally{for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];Object.assign(process.env,old);}
 const env={TAHA_DEPLOYMENT_ENV:'staging',TAHA_STAGING_DATABASE_APPROVED:'true',TAHA_STAGING_DATABASE_NAME:'taha_stage',MIGRATION_DATABASE_URL:'postgresql://admin@127.0.0.1:55459/taha_stage',TAHA_RUNTIME:'local'};
 assert.equal(stagingTarget(env).expected,'taha_stage');
 for(const changes of [{TAHA_STAGING_DATABASE_APPROVED:'false'},{TAHA_STAGING_DATABASE_NAME:'other'},{MIGRATION_DATABASE_URL:'postgresql://admin@127.0.0.1:55439/taha_stage'},{TAHA_RUNTIME:'cloud'}])assert.throws(()=>stagingTarget({...env,...changes}));
});

test('S3-compatible deep readiness writes, verifies privacy and bytes, and removes only its own key',async t=>{
 const objects=new Map<string,Buffer>(),calls:string[]=[];let mode='healthy';
 const server=createServer((req,res)=>{const key=(req.url??'').split('?')[0];calls.push(req.method+' '+key);if(!key.startsWith('/private-bucket/diagnostics/health-'))return res.writeHead(400).end();
  if(!req.headers.authorization){return res.writeHead(mode==='public'?200:403).end(mode==='public'?'public':'');}
  if(mode==='outage')return res.writeHead(503).end();
  if(req.method==='PUT'){const chunks:Buffer[]=[];req.on('data',chunk=>chunks.push(Buffer.from(chunk)));req.on('end',()=>{objects.set(key,Buffer.concat(chunks));res.writeHead(200).end();});return;}
  if(req.method==='GET'){if(mode==='denied')return res.writeHead(403).end();const value=mode==='corrupt'?Buffer.from('corrupt'):objects.get(key);return value?res.writeHead(200,{'Content-Length':String(value.length)}).end(value):res.writeHead(404).end();}
  if(req.method==='DELETE'){if(mode==='no-delete')return res.writeHead(403).end();objects.delete(key);return res.writeHead(204).end();}res.writeHead(405).end();
 });const base=await listen(server),storage=new LocalFileStorage({storageRoot:os.tmpdir(),storageDriver:'s3',s3Bucket:'private-bucket',s3Region:'us-east-1',s3Endpoint:base,s3AccessKey:'fixture',s3SecretKey:'fixture-secret'} as Configuration);
 try{
  await t.test('private exact byte roundtrip',async()=>{await storage.probePrivateStorage();assert.equal(objects.size,0);assert.equal(calls.filter(value=>value.startsWith('GET ')).length,2);});
  for(const failure of ['corrupt','public','denied','no-delete','outage'])await t.test(failure,async()=>{mode=failure;await assert.rejects(()=>storage.probePrivateStorage());if(failure!=='no-delete')assert.equal(objects.size,0);else objects.clear();});
  mode='healthy';await storage.probePrivateStorage();assert.equal(objects.size,0);
 }finally{storage.onModuleDestroy();await close(server);}
});
