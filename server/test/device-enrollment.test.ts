import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {generateKeyPairSync,sign,randomUUID,X509Certificate,createHash} from 'node:crypto';
import {mkdtemp,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import sharp from 'sharp';
import pg from 'pg';
import {migrate,runtimeRole} from '../scripts/migrate';
import {hashPassword} from '../src/auth/crypto';
import type {INestApplication} from '@nestjs/common';
const adminUrl=process.env.TAHA_TEST_POSTGRES_URL;
if(!adminUrl)throw new Error('Explicit isolated TAHA_TEST_POSTGRES_URL is required for enrollment tests.');
const admin=new pg.Client({connectionString:adminUrl});
let db:pg.Client,app:INestApplication,tls:https.Server,url:string,httpUrl:string,ownerToken:string,otherToken:string;
const store='10000000-0000-4000-8000-000000000001',owner=randomUUID(),other=randomUUID(),terminal='enrollment-counter',deviceId=randomUUID();
const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),publicKey=keys.publicKey.export({type:'spki',format:'pem'}).toString();
const signature=(message:string)=>sign('sha256',Buffer.from(message),keys.privateKey).toString('base64');
const origin='http://localhost:5173';
async function api(route:string,method='GET',body?:unknown,token=ownerToken,secure=false){
 const address=(secure?url:httpUrl)+'/api/v1'+route;
 const headers:Record<string,string>={Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})};
 let content=body===undefined?undefined:JSON.stringify(body);
 let bytes:Buffer|undefined;
 if(body instanceof FormData){const request=new Request('https://fixture.test',{method:'POST',body});headers['Content-Type']=request.headers.get('Content-Type')!;bytes=Buffer.from(await request.arrayBuffer());content=undefined;}
 if(!secure){const r=await fetch(address,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json() as any};}
 return new Promise<{status:number,data:any}>((resolve,reject)=>{const r=https.request(address,{method,headers,rejectUnauthorized:false},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>{let data:any;try{data=JSON.parse(text);}catch{data=text;}resolve({status:res.statusCode!,data});});});r.on('error',reject);r.end(bytes??content);});
}
before(async()=>{
 const parsed=new URL(adminUrl!);assert.equal(parsed.port,'55459');assert.equal(parsed.pathname,'/postgres');
 await admin.connect();const name='taha_enrollment_'+Date.now();await admin.query('create database '+name);parsed.pathname='/'+name;
 db=new pg.Client({connectionString:parsed.toString()});await db.connect();await migrate(db);
 const runtime=new URL(parsed);runtime.username='taha_api_enrollment';runtime.password='isolated-runtime-password';await runtimeRole(db,runtime.toString());
 const password='Secure enrollment fixture password!';const hash=await hashPassword(password);
 for(const [id,email] of [[owner,'enrollment@taha.test'],[other,'other-enrollment@taha.test']]){
  await db.query('insert into auth.users(id,email) values($1,$2)',[id,email]);await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,$2,'Enrollment Owner','owner','active')",[id,email]);await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)',[id,store]);await db.query('insert into app_private.accounts(user_id,email,password_hash) values($1,$2,$3)',[id,email,hash]);
 }
 const folder=await mkdtemp(path.join(os.tmpdir(),'taha-enroll-'));const cert=path.join(folder,'cert.pem'),key=path.join(folder,'key.pem');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});
 Object.assign(process.env,{DATABASE_URL:runtime.toString(),JWT_SECRET:'isolated-enrollment-fixture-secret-2026',FRONTEND_ORIGIN:origin,NODE_ENV:'test',STORAGE_ROOT:folder,TAHA_LAN_TLS_CERT:cert,TAHA_LAN_TLS_KEY:key,TAHA_LAN_TLS_ORIGIN:'https://127.0.0.1:3443'});
 const {createApp}=await import('../src/main');app=await createApp();await app.listen(0,'127.0.0.1');httpUrl=await app.getUrl();
 tls=https.createServer({cert:await readFile(cert),key:await readFile(key)},app.getHttpAdapter().getInstance());await new Promise<void>(resolve=>tls.listen(0,'127.0.0.1',resolve));url='https://127.0.0.1:'+(tls.address() as {port:number}).port;
 ownerToken=(await api('/auth/login','POST',{email:'enrollment@taha.test',password},'')).data.accessToken;otherToken=(await api('/auth/login','POST',{email:'other-enrollment@taha.test',password},'')).data.accessToken;
 assert.equal((await api(`/stores/${store}/camera/terminals/register`,'POST',{terminalId:terminal,name:'Main Counter'})).status,201);
},{timeout:300000});
after(async()=>{if(tls)await new Promise<void>(resolve=>tls.close(()=>resolve()));await app?.close();await db?.end();await admin.end();});
async function challenge(){const r=await api('/auth/enrollment','POST',{storeId:store,terminalId:terminal});assert.equal(r.status,201,JSON.stringify(r.data));return r.data;}
async function submit(c:any,id=deviceId,key=publicKey,sig=signature(`taha-enroll-v1\n${c.id}\n${c.challenge}\n${store}\n${terminal}\n${id}`)){
 return api('/auth/enrollment/'+c.id+'/request','POST',{challenge:c.challenge,storeId:store,terminalId:terminal,deviceId:id,deviceName:'Test Android',publicKey:key,signature:sig},'',true);
}
test('fresh phone enrolls with proof, PC approval and a restricted independently revocable session',async()=>{
 const c=await challenge();assert.match(c.qrPayload,/taha-mobile:\/\/enroll/);assert(!/password|refreshToken|accessToken/.test(c.qrPayload));assert.match(c.pin,/^[a-f0-9]{64}$/);
 assert.equal(c.pin,createHash('sha256').update(new X509Certificate(await readFile(process.env.TAHA_LAN_TLS_CERT!)).publicKey.export({type:'spki',format:'der'})).digest('hex'));
 assert.equal((await api('/auth/enrollment/'+c.id+'/request','POST',{},'')).status,403);
 assert.equal((await submit(c,deviceId,publicKey,'bad')).status,401);
 assert.equal((await submit(c)).status,201);
 assert.equal((await submit(c)).status,409);
 const body={challenge:c.challenge,signature:signature(`taha-complete-v1\n${c.id}\n${c.challenge}`)};
 assert.equal((await api('/auth/enrollment/'+c.id+'/complete','POST',body,'',true)).status,403);
 assert.equal((await api('/auth/enrollment/'+c.id+'/approve','POST',{},otherToken)).status,403);
 assert.equal((await api('/auth/enrollment/'+c.id+'/approve','POST',{})).status,201);
 const completed=await api('/auth/enrollment/'+c.id+'/complete','POST',body,'',true);assert.equal(completed.status,201,JSON.stringify(completed.data));
 const session=completed.data;assert.equal(session.context.profile.role,'employee');assert.equal(session.context.companion.scope,'camera');assert(!session.context.permissions.includes('settings.manage'));
 assert.equal((await api('/auth/enrollment/'+c.id+'/complete','POST',body,'',true)).status,400);
 assert.equal((await api('/auth/session','GET',undefined,session.accessToken)).status,403);
 assert.equal((await api('/auth/session','GET',undefined,session.accessToken,true)).status,200);
 assert.equal((await api('/auth/devices','GET',undefined,session.accessToken,true)).status,403);
 assert.equal((await api('/auth/enrollment','POST',{storeId:store,terminalId:terminal},session.accessToken,true)).status,403);
 assert.equal((await api(`/stores/${store}/sales`,'POST',{},session.accessToken,true)).status,403);
 assert.equal((await api(`/stores/${randomUUID()}/camera/jobs`,'GET',undefined,session.accessToken,true)).status,403);
 const phones=(await api(`/stores/${store}/camera/devices`)).data;const pair=phones.find((p:any)=>p.deviceId===deviceId);assert(pair);
 const testJob=await api(`/stores/${store}/camera/devices/${pair.id}/test`,'POST',{});assert.equal(testJob.status,201);
 assert.equal((await api(`/stores/${store}/camera/jobs/${testJob.data.id}/confirm`,'POST',{},session.accessToken,true)).status,201);
 const request=await api(`/stores/${store}/camera/jobs`,'POST',{terminalId:terminal,type:'product',label:'Protected companion image'});assert.equal(request.status,201);
 const image=await sharp({create:{width:16,height:16,channels:3,background:'white'}}).png().toBuffer();const form=new FormData();form.append('captureId',randomUUID());form.append('file',new Blob([image],{type:'image/png'}),'test.png');
 const upload=await api(`/stores/${store}/camera/jobs/${request.data.id}/captures`,'POST',form,session.accessToken,true);assert.equal(upload.status,201,JSON.stringify(upload.data));
 assert.equal(new URL(upload.data.imageUrl).protocol,'https:');const mediaPath=new URL(upload.data.imageUrl).pathname.replace('/api/v1','')+new URL(upload.data.imageUrl).search;
 assert.equal((await api(mediaPath,'GET',undefined,'')).status,403);assert.equal((await api(mediaPath,'GET',undefined,'',true)).status,200);
 const refreshed=await api('/auth/enrollment/refresh','POST',{refreshToken:session.refreshToken,signature:signature('taha-refresh-v1\n'+session.refreshToken)},'',true);assert.equal(refreshed.status,201);
 assert.equal((await api('/auth/enrollment/refresh','POST',{refreshToken:refreshed.data.refreshToken,signature:'bad'},'',true)).status,401);
 assert.equal((await api('/auth/devices/'+session.sessionId,'DELETE')).status,200);
 assert.equal((await api('/auth/session','GET',undefined,refreshed.data.accessToken,true)).status,401);
});
test('expired, wrong-shop and invalid-key requests cannot create sessions',async()=>{
 const c=await challenge();assert.equal((await api('/auth/enrollment/'+c.id+'/request','POST',{challenge:c.challenge,storeId:randomUUID(),terminalId:terminal,deviceId,publicKey,signature:'bad'},'',true)).status,400);
 await db.query("update app_private.device_enrollments set expires_at=now()-interval '1 second' where id=$1",[c.id]);assert.equal((await submit(c)).status,400);
});
test('session expiry, phone logout and disconnect end the companion credential',async()=>{
 for(const action of ['expire','logout','disconnect']){
  const phoneId=randomUUID(),c=await challenge();assert.equal((await submit(c,phoneId)).status,201);assert.equal((await api('/auth/enrollment/'+c.id+'/approve','POST',{})).status,201);
  const s=(await api('/auth/enrollment/'+c.id+'/complete','POST',{challenge:c.challenge,signature:signature(`taha-complete-v1\n${c.id}\n${c.challenge}`)},'',true)).data;
  if(action==='expire')await db.query("update app_private.sessions set expires_at=now()-interval '1 second' where id=$1",[s.sessionId]);
  if(action==='logout')assert.equal((await api('/auth/logout','POST',{},s.accessToken,true)).status,201);
  if(action==='disconnect'){const pairs=await api(`/stores/${store}/camera/devices`);const pair=pairs.data.find((p:any)=>p.deviceId===phoneId);assert(pair);assert.equal((await api(`/stores/${store}/camera/devices/${pair.id}`,'DELETE')).status,200);}
  assert.equal((await api('/auth/session','GET',undefined,s.accessToken,true)).status,401,action);
  assert.equal((await api('/auth/enrollment/refresh','POST',{refreshToken:s.refreshToken,signature:signature('taha-refresh-v1\n'+s.refreshToken)},'',true)).status,401,action);
 }
});
test('refresh replay revokes device and desktop sign-out invalidates previously approved phones',async()=>{
 for(const revokeDesktop of [false,true]){
 const c=await challenge();assert.equal((await submit(c,randomUUID())).status,201);await api('/auth/enrollment/'+c.id+'/approve','POST',{});
 const s=(await api('/auth/enrollment/'+c.id+'/complete','POST',{challenge:c.challenge,signature:signature(`taha-complete-v1\n${c.id}\n${c.challenge}`)},'',true)).data;
 if(revokeDesktop)await api('/auth/logout','POST',{});
 else {const body={refreshToken:s.refreshToken,signature:signature('taha-refresh-v1\n'+s.refreshToken)};assert.equal((await api('/auth/enrollment/refresh','POST',body,'',true)).status,201);assert.equal((await api('/auth/enrollment/refresh','POST',body,'',true)).status,401);}
 assert.equal((await api('/auth/session','GET',undefined,s.accessToken,true)).status,401);
 }
});
