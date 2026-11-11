import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import {migrate,runtimeRole} from '../scripts/migrate';
import {hashPassword} from '../src/auth/crypto';
import type {INestApplication} from '@nestjs/common';
import {io,type Socket} from 'socket.io-client';

const adminUrl=process.env.TAHA_TEST_POSTGRES_URL??'postgresql://taha_test@127.0.0.1:55439/postgres';
const admin=new pg.Client({connectionString:adminUrl});let db:pg.Client,app:INestApplication,url:string;
const store='10000000-0000-4000-8000-000000000001',owner=randomUUID(),staff=randomUUID(),otherStore=randomUUID();
const password='Secure isolated bridge password 2026!',origin='http://localhost:5173';
let desktop:string,phone:string,unrelated:string;
async function api(route:string,method='GET',body?:unknown,token=desktop){const response=await fetch(url+'/api/v1'+route,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),Authorization:'Bearer '+token},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json() as any};}
const login=async(email:string)=>(await api('/auth/login','POST',{email,password})).data.accessToken as string;
const route=(part:string)=>`/stores/${store}/camera/${part}`;
before(async()=>{
 const parsed=new URL(adminUrl);assert(['localhost','127.0.0.1'].includes(parsed.hostname)&&parsed.pathname==='/postgres');
 await admin.connect();const name='taha_device_bridge_'+Date.now();await admin.query('create database '+name);parsed.pathname='/'+name;
 db=new pg.Client({connectionString:parsed.toString()});await db.connect();await migrate(db);
 const runtime=new URL(parsed);runtime.username='taha_api_test';runtime.password='test-runtime-password';await runtimeRole(db,runtime.toString());
 const hash=await hashPassword(password);
 for(const [id,email,role] of [[owner,'bridge-owner@taha.test','owner'],[staff,'bridge-staff@taha.test','employee']]){
  await db.query('insert into auth.users(id,email) values($1,$2)',[id,email]);await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,$2,'Bridge Test',$3,'active')",[id,email,role]);await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)',[id,store]);await db.query('insert into app_private.accounts(user_id,email,password_hash) values($1,$2,$3)',[id,email,hash]);
 }
 await db.query("insert into public.stores(id,name,branch_name) values($1,'Other Shop','Other Branch')",[otherStore]);
 await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)',[owner,otherStore]);
 await db.query("insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key in ('devices.pair','media.upload','camera.request')",[staff,store]);
 process.env.DATABASE_URL=runtime.toString();process.env.JWT_SECRET='isolated-device-bridge-fixture-secret-2026';process.env.PORT='0';process.env.FRONTEND_ORIGIN=origin;process.env.NODE_ENV='test';process.env.STORAGE_ROOT=await mkdtemp(path.join(os.tmpdir(),'taha-device-bridge-'));
 const {createApp}=await import('../src/main');app=await createApp();await app.listen(0,'127.0.0.1');url=await app.getUrl();
 desktop=await login('bridge-owner@taha.test');phone=await login('bridge-owner@taha.test');unrelated=await login('bridge-staff@taha.test');
},{timeout:300000});
after(async()=>{await app?.close();await db?.end();await admin.end();});

test('persistent registration keeps owned identities and refuses profile or branch hijacking',async()=>{
 const terminalId=randomUUID(),deviceId=randomUUID();
 const terminal=await api(route('terminals/register'),'POST',{terminalId,name:'Main Counter'});assert.equal(terminal.status,201,JSON.stringify(terminal.data));assert.equal(terminal.data.terminalId,terminalId);assert.equal(terminal.data.name,'Main Counter');
 const registered=await api(route('devices/register'),'POST',{deviceId,name:'My Android',platform:'Android'},phone);assert.equal(registered.status,201);assert.equal(registered.data.deviceId,deviceId);
 assert.equal((await api(route('devices/register'),'POST',{deviceId,name:'Hijacked',platform:'Android'},unrelated)).status,403);
 assert.equal((await api(route('terminals/register'),'POST',{terminalId,name:'Hijacked'},unrelated)).status,403);
 assert.equal((await api(`/stores/${otherStore}/camera/devices/register`,'POST',{deviceId,name:'Moved',platform:'Android'},phone)).status,403);
 const pairing=await api(route('pairing'),'POST',{terminalId});assert.match(pairing.data.code,/^\d{6}$/);assert.equal(pairing.data.type,'device-pairing');assert.equal(pairing.data.terminalName,'Main Counter');assert.match(pairing.data.qrPayload,/taha-mobile:\/\/pair/);assert(!pairing.data.qrPayload.includes('accessToken'));
 assert.equal((await api(`/stores/${otherStore}/camera/pair`,'POST',{code:pairing.data.code,deviceId,deviceName:'Android'},phone)).status,403);
 const paired=await api(route('pair'),'POST',{code:pairing.data.code,deviceId,deviceName:'Android'},phone);assert.equal(paired.status,201);assert.equal(paired.data.deviceId,deviceId);
 assert.equal((await api(route('pair'),'POST',{code:pairing.data.code,deviceId},phone)).status,400);
 const pending=await api(route('jobs'),'POST',{terminalId,type:'profile',label:'Persistent session photo'});assert.equal(pending.status,201);
 const renewed=await login('bridge-owner@taha.test');const rebound=await api(route('devices/register'),'POST',{deviceId,name:'Android',platform:'Android'},renewed);assert.equal(rebound.status,201);assert.equal(rebound.data.pairing.id,paired.data.id);
 assert.equal((await api(route('jobs/'+pending.data.id),'GET',undefined,phone)).status,404);assert.equal((await api(route('jobs/'+pending.data.id),'GET',undefined,renewed)).status,200);
 const devices=await api(route('devices')+'?terminalId='+terminalId);assert.equal(devices.data[0].online,true);assert.equal(devices.data[0].deviceId,deviceId);
 const current=await api(route('devices'), 'GET',undefined,renewed);assert.equal(current.data.find((d:any)=>d.id===paired.data.id).pairedToThisDevice,true);
 await db.query("update app_private.staff_devices set last_seen_at=now()-interval '2 minutes' where id=$1",[deviceId]);assert.equal((await api(route('devices')+'?terminalId='+terminalId)).data[0].online,false);
 assert.equal((await api(route('devices/heartbeat'),'POST',{deviceId},phone)).status,403);
 assert.equal((await api(route('devices/heartbeat'),'POST',{deviceId},renewed)).status,201);assert.equal((await api(route('devices')+'?terminalId='+terminalId)).data[0].online,true);
 assert.equal((await api(route('devices/'+paired.data.id),'PATCH',{deviceName:'Counter Phone'})).data.deviceName,'Counter Phone');
 const named=await api(route('devices/register'),'POST',{deviceId,name:'Old default model',platform:'Android'},renewed);assert.equal(named.data.name,'Counter Phone');assert.equal(named.data.pairing.deviceName,'Counter Phone');
 assert.equal((await api(route('devices/'+paired.data.id),'PATCH',{deviceName:'Intruder'},unrelated)).status,404);
 const expired=await api(route('pairing'),'POST',{terminalId});await db.query("update app_private.device_pairings set expires_at=now()-interval '1 second' where id=$1",[expired.data.id]);assert.equal((await api(route('pair'),'POST',{code:expired.data.code,deviceId},renewed)).status,400);
 await api(route('jobs/'+pending.data.id),'PATCH',{status:'cancelled'});
 const job=await api(route('devices/'+paired.data.id+'/test'),'POST',{});assert.equal(job.status,201);assert.equal(job.data.type,'connection-test');assert.equal(job.data.assignmentState,'ASSIGNED');
 assert.equal((await api(route('jobs/'+job.data.id+'/confirm'),'POST',{},unrelated)).status,404);
 const confirmed=await api(route('jobs/'+job.data.id+'/confirm'),'POST',{},renewed);assert.equal(confirmed.status,201);assert.equal(confirmed.data.status,'received');assert.equal(confirmed.data.assignmentState,'COMPLETED');
 assert.equal((await api(route('jobs/'+job.data.id))).data.status,'received');
 await api(route('pairings')+'?terminalId='+terminalId,'DELETE',{});assert.equal((await api(route('devices')+'?terminalId='+terminalId)).data.length,0);
});

test('reset cancels only its counter requests including QR requests without a phone',async()=>{
 const first='reset-'+randomUUID(),second='keep-'+randomUUID();
 for(const terminalId of [first,second])await api(route('terminals/register'),'POST',{terminalId,name:'Main Counter'});
 const create=(terminalId:string)=>api(route('jobs'),'POST',{terminalId,type:'profile',label:'Reset test',fallback:true});const removed=await create(first),kept=await create(second);assert.equal(removed.status,201);assert.equal(kept.status,201);
 assert.equal((await api(route('pairings')+'?terminalId='+first,'DELETE',{},unrelated)).status,403);
 assert.equal((await api(route('pairings')+'?terminalId='+first,'DELETE',{})).status,200);
 assert.equal((await api(route('jobs/'+removed.data.id))).data.status,'cancelled');assert.equal((await api(route('jobs/'+kept.data.id))).data.status,'waiting');
});

test('a persistent phone pairs to one counter and replacing that pairing cancels its old requests',async()=>{
 const deviceId=randomUUID(),first='replace-'+randomUUID(),second='next-'+randomUUID();await api(route('devices/register'),'POST',{deviceId,name:'Phone',platform:'Android'},phone);
 const pair=async(terminalId:string)=>{const code=await api(route('pairing'),'POST',{terminalId});return api(route('pair'),'POST',{code:code.data.code,deviceId},phone);};
 const initial=await pair(first);const job=await api(route('jobs'),'POST',{terminalId:first,type:'profile',label:'Old counter photo'});assert.equal(job.status,201);const replacement=await pair(second);assert.equal(replacement.status,201);
 assert.equal((await api(route('devices')+'?terminalId='+first)).data.length,0);assert.equal((await api(route('devices')+'?terminalId='+second)).data[0].id,replacement.data.id);
 assert.equal((await api(route('jobs/'+job.data.id))).data.status,'cancelled');assert.notEqual(initial.data.id,replacement.data.id);
});

test('request handoff preserves the request and grants the current QR exactly once',async()=>{
 const terminalId='handoff-'+randomUUID(),deviceId=randomUUID();await api(route('terminals/register'),'POST',{terminalId,name:'Main Counter'});await api(route('devices/register'),'POST',{deviceId,name:'Phone',platform:'Android'},phone);
 const pairing=await api(route('pairing'),'POST',{terminalId});await api(route('pair'),'POST',{code:pairing.data.code,deviceId},phone);
 const job=await api(route('jobs'),'POST',{terminalId,type:'product',label:'Handoff photo'});assert.equal(job.status,201);assert.equal(job.data.assignmentState,'ASSIGNED');
 const initialToken=new URL(job.data.qrPayload).searchParams.get('token');assert.equal((await api(route('jobs/'+job.data.id+'/claim'),'POST',{token:initialToken},phone)).status,201);
 const handed=await api(route('jobs/'+job.data.id+'/qr'),'POST',{});assert.equal(handed.status,201);assert.equal(handed.data.id,job.data.id);assert.equal(handed.data.status,'waiting');assert.equal(handed.data.assignmentState,'UNASSIGNED');
 assert.equal((await api(route('jobs/'+job.data.id+'/claim'),'POST',{token:initialToken},phone)).status,400);
 const token=new URL(handed.data.qrPayload).searchParams.get('token');const won=await api(route('jobs/'+job.data.id+'/claim'),'POST',{token},unrelated);assert.equal(won.status,201);assert.equal(won.data.assignmentState,'CLAIMED');assert.equal((await api(route('jobs/'+job.data.id+'/claim'),'POST',{token},phone)).status,400);
 assert.equal((await api(route('jobs/'+job.data.id))).data.status,'waiting');
 assert.equal((await api(route('jobs/'+job.data.id),'GET',undefined,phone)).status,404);
});

test('WebSocket registration rooms authorize stable identities and isolate pairing events',async()=>{
 const terminalId=randomUUID(),deviceId=randomUUID();await api(route('terminals/register'),'POST',{terminalId,name:'Main Counter'});await api(route('devices/register'),'POST',{deviceId,name:'Phone',platform:'Android'},phone);
 const sockets:Socket[]=[];const connect=async(token:string)=>{const s=io(url+'/counter',{transports:['websocket'],auth:{accessToken:token},extraHeaders:{Origin:origin},reconnection:false});sockets.push(s);await new Promise<void>((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;};
 const subscribe=(s:Socket,body:unknown)=>new Promise<any>(resolve=>s.emit('subscribe',{storeId:store,...body as object},resolve));
 try{const counter=await connect(desktop),mobile=await connect(phone),intruder=await connect(unrelated);assert.equal((await subscribe(counter,{terminalId})).ok,true);assert.equal((await subscribe(mobile,{deviceId})).ok,true);assert.equal((await subscribe(intruder,{deviceId})).ok,false);assert.equal((await subscribe(intruder,{terminalId})).ok,false);assert.equal((await subscribe(intruder,{})).ok,true);
  let leaked=0;intruder.on('pairing.completed',()=>leaked++);const received=new Promise<any>((resolve,reject)=>{counter.once('pairing.completed',resolve);setTimeout(()=>reject(new Error('Pairing event timed out')),3000).unref();});const code=await api(route('pairing'),'POST',{terminalId});await api(route('pair'),'POST',{code:code.data.code,deviceId},phone);assert.equal((await received).terminalId,terminalId);assert.equal(leaked,0);
  const assigned=new Promise<any>((resolve,reject)=>{mobile.once('camera.request.created',resolve);setTimeout(()=>reject(new Error('Phone request timed out')),3000).unref();});let cancelled=0;counter.on('camera.updated',(j:any)=>{if(j.status==='cancelled')cancelled++;});intruder.on('camera.request.created',()=>leaked++);const job=await api(route('jobs'),'POST',{terminalId,type:'profile',label:'WebSocket photo'});assert.equal((await assigned).id,job.data.id);
  const changed=new Promise<any>((resolve,reject)=>{counter.once('camera.assignment.changed',resolve);setTimeout(()=>reject(new Error('Handoff event timed out')),3000).unref();});await api(route('jobs/'+job.data.id+'/qr'),'POST',{});const handoff=await changed;assert.equal(handoff.id,job.data.id);assert.equal(handoff.assignmentState,'UNASSIGNED');assert.equal(handoff.status,'waiting');assert.equal(cancelled,0);assert.equal(leaked,0);
  await db.query("update app_private.staff_devices set last_seen_at=now()-interval '2 minutes' where id=$1",[deviceId]);assert.equal((await api(route('devices')+'?terminalId='+terminalId)).data[0].online,true);
  const offline=new Promise<any>((resolve,reject)=>{counter.once('device.offline',resolve);setTimeout(()=>reject(new Error('Offline event timed out')),3000).unref();});mobile.disconnect();assert.equal((await offline).deviceId,deviceId);assert.equal((await api(route('devices')+'?terminalId='+terminalId)).data[0].online,false);
 }finally{sockets.forEach(s=>s.disconnect());}
});
