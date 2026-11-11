import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createHash,createHmac,randomBytes,randomUUID} from 'node:crypto';
import http from 'node:http';
import pg from 'pg';
import sharp from 'sharp';
import type {INestApplication} from '@nestjs/common';
import {migrate,runtimeRole} from '../scripts/migrate';
import {hashPassword} from '../src/auth/crypto';

// External provider contract fixture only: private HTTP service verifies POST policy
// independently; the real S3 SDK handles server PUT/GET/DELETE against this service.
const objects=new Map<string,Buffer>(), secret='fake-private-object-service-secret';
let provider:http.Server,app:INestApplication,db:pg.Client,admin:pg.Client,url:string,providerUrl:string,token:string,otherToken:string,staffToken:string;
const store='10000000-0000-4000-8000-000000000001',owner=randomUUID(),other=randomUUID(),staff=randomUUID(),origin='http://localhost:5173';
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
async function api(route:string,body?:unknown,auth=token,method='POST'){
 const r=await fetch(url+'/api/v1'+route,{method,headers:{Origin:origin,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,data:await r.json() as any};
}
const base=`/stores/${store}/media/upload-grants`;
async function restart(poolMax:string){await app.close();process.env.DATABASE_POOL_MAX=poolMax;const {createApp}=await import('../src/main');app=await createApp();await app.listen(0,'127.0.0.1');url=await app.getUrl();}
async function input(bytes:Buffer,extra:Record<string,unknown>={}){return {uploadId:randomUUID(),kind:'product',mimeType:'image/png',size:bytes.length,sha256:sha(bytes),staged:true,...extra};}
async function send(grant:any,bytes:Buffer,change:Record<string,string>={}){
 const form=new FormData();for(const [k,v] of Object.entries({...grant.fields,...change}))form.set(k,String(v));form.set('file',new Blob([bytes],{type:grant.fields['Content-Type']}),'photo.png');
 return fetch(grant.url,{method:'POST',body:form});
}
before(async()=>{
 const adminUrl=process.env.TAHA_TEST_POSTGRES_URL!;const parsed=new URL(adminUrl);assert.equal(parsed.port,'55459','Only isolated Phase6A PostgreSQL is permitted');assert.equal(parsed.pathname,'/postgres');
 admin=new pg.Client({connectionString:adminUrl});await admin.connect();parsed.pathname='/taha_cloud_media_'+Date.now();await admin.query('create database '+parsed.pathname.slice(1));
 db=new pg.Client({connectionString:parsed.toString()});await db.connect();await migrate(db);const runtime=new URL(parsed);runtime.username='taha_cloud_media';runtime.password='isolated-cloud-media-runtime';await runtimeRole(db,runtime.toString());
 const password='Isolated media fixture password!';const hash=await hashPassword(password);
 for(const [id,email,role] of [[owner,'media-owner@taha.test','owner'],[other,'media-other@taha.test','owner'],[staff,'media-staff@taha.test','employee']]){
  await db.query('insert into auth.users(id,email) values($1,$2)',[id,email]);await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,$2,'Cloud media fixture',$3,'active')",[id,email,role]);await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)',[id,store]);await db.query('insert into app_private.accounts(user_id,email,password_hash) values($1,$2,$3)',[id,email,hash]);
 }
 provider=http.createServer(async(req,res)=>{try{
  const chunks:Buffer[]=[];for await(const b of req)chunks.push(Buffer.from(b));const bytes=Buffer.concat(chunks);const key=decodeURIComponent(new URL(req.url!,'http://fixture').pathname).slice(1);
  if(req.method==='POST'){
   const form=await new Response(bytes,{headers:{'Content-Type':req.headers['content-type']!}}).formData();const policy=String(form.get('policy'));const p=JSON.parse(Buffer.from(policy,'base64').toString());
   const scope=String(form.get('x-amz-credential')).split('/');const h=(k:Buffer|string,v:string)=>createHmac('sha256',k).update(v).digest();const signing=h(h(h(h('AWS4'+secret,scope[1]),scope[2]),scope[3]),scope[4]);
   assert.equal(createHmac('sha256',signing).update(policy).digest('hex'),form.get('x-amz-signature'));assert(Date.parse(p.expiration)>Date.now());const file=form.get('file') as File;const content=Buffer.from(await file.arrayBuffer());
   for(const c of p.conditions){if(Array.isArray(c)){assert.equal(c[0],'content-length-range');assert(content.length>=c[1]&&content.length<=c[2]);}else for(const [name,v] of Object.entries(c))assert.equal(name==='bucket'?key:String(form.get(name)),v);}
   objects.set(key+'/'+form.get('key'),content);res.writeHead(204).end();return;
  }
  if(req.method==='PUT'){objects.set(key,bytes);res.writeHead(200,{'ETag':'"fixture"'}).end();return;}
  if(req.method==='DELETE'){objects.delete(key);res.writeHead(204).end();return;}
  const object=objects.get(key);if(!object){res.writeHead(404).end();return;}if(!req.headers.authorization){res.writeHead(403).end();return;}
  res.writeHead(200,{'Content-Length':object.length,'Content-Type':'application/octet-stream'}).end(object);
 }catch{res.writeHead(403).end();}});
 await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));providerUrl='http://127.0.0.1:'+(provider.address() as any).port;
 Object.assign(process.env,{DATABASE_URL:runtime.toString(),DATABASE_POOL_MAX:'1',JWT_SECRET:'isolated-cloud-media-fixture-secret-2026',FRONTEND_ORIGIN:origin,NODE_ENV:'test',STORAGE_DRIVER:'s3',S3_BUCKET:'private-fixture',S3_REGION:'us-east-1',S3_ENDPOINT:providerUrl,S3_ACCESS_KEY_ID:'fixture-access',S3_SECRET_ACCESS_KEY:secret});
 const {createApp}=await import('../src/main');app=await createApp();await app.listen(0,'127.0.0.1');url=await app.getUrl();
 token=(await api('/auth/login',{email:'media-owner@taha.test',password},'')).data.accessToken;
 otherToken=(await api('/auth/login',{email:'media-other@taha.test',password},'')).data.accessToken;
 staffToken=(await api('/auth/login',{email:'media-staff@taha.test',password},'')).data.accessToken;
},{timeout:300000});
after(async()=>{await app?.close();if(provider)await new Promise<void>(r=>provider.close(()=>r()));await db?.end();await admin?.end();});

test('large browser image bypasses API body, remains private and completion is durable/idempotent',async()=>{
 const bytes=await sharp(randomBytes(1600*1200*3),{raw:{width:1600,height:1200,channels:3}}).png().toBuffer();assert(bytes.length>4.5*1024*1024);
 const request=await input(bytes);const grant=await api(base,request);assert.equal(grant.status,201,JSON.stringify(grant.data));assert.equal(grant.data.mode,'direct');assert(grant.data.expiresAt);assert(!JSON.stringify(grant.data).includes(secret));
 assert.equal((await send(grant.data,bytes)).status,204);assert.equal((await fetch(grant.data.url+'/'+grant.data.fields.key)).status,403);
 const completed=await api(base+'/'+grant.data.id+'/complete',{});assert.equal(completed.status,201,JSON.stringify(completed.data));assert.equal(completed.data.mimeType,'image/webp');
 const again=await api(base+'/'+grant.data.id+'/complete',{});assert.equal(again.data.id,completed.data.id);
 const retried=await api(base,request);assert.equal(retried.data.result.id,completed.data.id);
 await restart('1');const links=await api(`/stores/${store}/media/urls`,{paths:[completed.data.path]},otherToken);assert(links.data[completed.data.path],'Another authorized browser reads PostgreSQL metadata after API instance replacement');
 const readUrl=new URL(completed.data.url);const image=await fetch(url+readUrl.pathname+readUrl.search);assert.equal(image.status,200);assert.equal(image.headers.get('cache-control'),'private, no-store');assert.equal((await sharp(Buffer.from(await image.arrayBuffer())).metadata()).format,'webp');
 const thumb=await fetch(url+readUrl.pathname+readUrl.search+'&thumbnail=1');assert.equal(thumb.status,200);assert((await sharp(Buffer.from(await thumb.arrayBuffer())).metadata()).width!<=360);
 assert.equal((await db.query('select count(*)::int n from app_private.media_uploads where request_id=$1',[request.uploadId])).rows[0].n,1);
},{timeout:60000});

test('grants bind identity, purpose, exact content and enforce provider size/key scope',async()=>{
 const bytes=await sharp({create:{width:64,height:64,channels:3,background:'red'}}).png().toBuffer();const request=await input(bytes);const grant=await api(base,request);assert.equal(grant.status,201);
 assert.equal((await api(base,request,'')).status,401);assert.equal((await api(base,{...request,uploadId:randomUUID()},staffToken)).status,403);
 assert.equal((await api(`/stores/${randomUUID()}/media/upload-grants`,request)).status,403);
 assert.equal((await api(base,{...request,kind:'proof'})).status,409);
 assert.equal((await api(base+'/'+grant.data.id+'/complete',{},otherToken)).status,404);
 assert.equal((await send(grant.data,bytes,{key:'outside-shop'})).status,403);
 assert.equal((await send(grant.data,Buffer.concat([bytes,bytes]))).status,403);
 assert.equal((await send(grant.data,bytes)).status,204);assert.equal((await api(base+'/'+grant.data.id+'/complete',{})).status,201);
});

test('invalid bytes, wrong hash, missing upload, cancellation, expiry and same-ID retry never publish media',async()=>{
 const invalid=Buffer.from('This is not a real image');const invalidGrant=(await api(base,await input(invalid))).data;await send(invalidGrant,invalid);
 assert.equal((await api(base+'/'+invalidGrant.id+'/complete',{})).status,400);
 const bytes=await sharp({create:{width:60,height:40,channels:3,background:'blue'}}).png().toBuffer();
 const missing=(await api(base,await input(bytes))).data;assert.equal((await api(base+'/'+missing.id+'/complete',{})).status,400);
 const wrong=(await api(base,await input(bytes,{sha256:'a'.repeat(64)}))).data;await send(wrong,bytes);assert.equal((await api(base+'/'+wrong.id+'/complete',{})).status,400);
 const request=await input(bytes);const expired=(await api(base,request)).data;await send(expired,bytes);await db.query("update app_private.media_upload_grants set expires_at=now()-interval '1 second' where id=$1",[expired.id]);assert.equal((await api(base+'/'+expired.id+'/complete',{})).status,410);
 const renewed=(await api(base,request)).data;assert.equal(renewed.id,expired.id);assert.notEqual(renewed.fields.key,expired.fields.key);await send(renewed,bytes);assert.equal((await api(base+'/'+renewed.id+'/complete',{})).status,201);
 const cancelled=(await api(base,await input(bytes))).data;await send(cancelled,bytes);assert.equal((await api(base+'/'+cancelled.id,undefined,token,'DELETE')).status,200);assert.equal((await api(base+'/'+cancelled.id+'/complete',{})).status,409);
});

test('new business drafts upload privately without attaching a missing or foreign record',async()=>{
 const bytes=await sharp({create:{width:48,height:36,channels:3,background:'orange'}}).png().toBuffer();const foreign=randomUUID(),foreignCustomer=randomUUID();
 await db.query("insert into public.stores(id,name,branch_name) values($1,'Isolated Other Store','Other')",[foreign]);await db.query("insert into public.customers(id,store_id,name,type) values($1,$2,'Other fixture','Individual')",[foreignCustomer,foreign]);
 for(const [kind,entityId] of [['customer',randomUUID()],['product',randomUUID()],['repair',randomUUID()],['device',randomUUID()],['customer',foreignCustomer]]){
  const grant=await api(base,await input(bytes,{kind,entityId,staged:false}));assert.equal(grant.status,201,JSON.stringify(grant.data));await send(grant.data,bytes);const complete=await api(base+'/'+grant.data.id+'/complete',{});assert.equal(complete.status,201,JSON.stringify(complete.data));assert.equal((await db.query('select entity_id from app_private.media where id=$1',[complete.data.id])).rows[0].entity_id,null);
 }
});
test('parallel grants enforce outstanding quota and concurrent completion creates one image',async()=>{
 const bytes=await sharp({create:{width:70,height:50,channels:3,background:'purple'}}).png().toBuffer();
 await restart('10');
 // Provider-sized requests can reach separate Function instances together.
 // Delay real PostgreSQL inserts so concurrent count/insert transactions overlap.
 await db.query("create function app_private.media_test_delay() returns trigger language plpgsql as $$ begin perform pg_sleep(0.4); return new; end $$; create trigger media_test_delay before insert on app_private.media_upload_grants for each row execute function app_private.media_test_delay()");
 let responses:Awaited<ReturnType<typeof api>>[];
 try{responses=await Promise.all(Array.from({length:9},async()=>api(base,await input(bytes),otherToken)));}finally{await db.query('drop trigger media_test_delay on app_private.media_upload_grants;drop function app_private.media_test_delay()');}
 assert.equal(responses.filter(x=>x.status===201).length,8,'One profile may have at most eight outstanding grants');assert.equal(responses.filter(x=>x.status===429).length,1);
 for(const grant of responses.filter(x=>x.status===201))await api(base+'/'+grant.data.id,undefined,otherToken,'DELETE');
 await restart('2');const grant=(await api(base,await input(bytes))).data;await send(grant,bytes);
 const complete=await Promise.all([api(base+'/'+grant.id+'/complete',{}),api(base+'/'+grant.id+'/complete',{})]);assert(complete.every(x=>x.status===201));assert.equal(complete[0].data.id,complete[1].data.id);
});
test('proof uploads do not yield anonymous or unrelated-profile access; revoked sessions lose image links',async()=>{
 const bytes=await sharp({create:{width:80,height:80,channels:3,background:'green'}}).png().toBuffer();const grant=(await api(base,await input(bytes,{kind:'proof'}))).data;await send(grant,bytes);const complete=await api(base+'/'+grant.id+'/complete',{});assert.equal(complete.status,201);
 assert.equal((await fetch(url+'/api/v1/media/'+complete.data.id)).status,403);
 const unrelated=await api(`/stores/${store}/media/urls`,{paths:[complete.data.path]},staffToken);assert.deepEqual(unrelated.data,{});
 await api('/auth/logout',{},token);const link=new URL(complete.data.url);assert.equal((await fetch(url+link.pathname+link.search)).status,401);
});




