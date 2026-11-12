import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import pg from 'pg';
import type {INestApplication} from '@nestjs/common';
import {migrate,runtimeRole} from '../scripts/migrate';
import {hashPassword} from '../src/auth/crypto';
import type {CounterGateway} from '../src/realtime/counter.gateway';

test('R2B committed revisions cover workflows, permissions, missed notifications and rollback',{timeout:300000},async t=>{
 const adminAddress=new URL(process.env.TAHA_TEST_POSTGRES_URL??'');assert.equal(adminAddress.hostname,'127.0.0.1');assert.equal(adminAddress.port,'55459');assert.equal(adminAddress.pathname,'/postgres');
 const admin=new pg.Client({connectionString:adminAddress.toString()});await admin.connect();
 const identity=(await admin.query("select current_setting('data_directory') directory")).rows[0].directory as string;assert.match(identity.replaceAll('\\','/'),/\/\.test-postgres\/phase5c-20261014\/pgdata$/);
 const name='taha_r2b_revisions_'+Date.now(),role='r2b_'+randomBytes(6).toString('hex'),store='10000000-0000-4000-8000-000000000001',owner=randomUUID(),staff=randomUUID();
 let db:pg.Client|undefined,app:INestApplication|undefined;
 try{
  await admin.query('create database '+name);const url=new URL(adminAddress);url.pathname='/'+name;db=new pg.Client({connectionString:url.toString()});await db.connect();await migrate(db);
  const runtime=new URL(url);runtime.username=role;runtime.password=randomBytes(24).toString('hex');await runtimeRole(db,runtime.toString());
  const password=randomBytes(24).toString('hex'),hash=await hashPassword(password);
  for(const [id,kind] of [[owner,'owner'],[staff,'employee']]){
   await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@fixture.test']);
   await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,$2,'R2B isolated',$3,'active')",[id,id+'@fixture.test',kind]);
   await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)',[id,store]);
   await db.query('insert into app_private.accounts(user_id,email,password_hash) values($1,$2,$3)',[id,id+'@fixture.test',hash]);
  }
  await db.query("insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key='sales.create'",[staff,store]);
  Object.assign(process.env,{DATABASE_URL:runtime.toString(),JWT_SECRET:randomBytes(32).toString('hex'),NODE_ENV:'test',TAHA_RUNTIME:'local',FRONTEND_ORIGIN:'http://localhost:5173',PUBLIC_API_URL:'http://localhost:3000',STORAGE_DRIVER:'local',PORT:'0'});
  delete process.env.TAHA_SERVE_FRONTEND;
  const {createApp}=await import('../src/main');app=await createApp();await app.listen(0,'127.0.0.1');const base=(await app.getUrl())+'/api/v1';
  const {Database}=await import('../src/database/database.service');
  const {AuthService}=await import('../src/auth/auth.service');
  const {WorkflowsService}=await import('../src/workflows/workflows.service');
  const api=async(path:string,token='',body?:unknown)=>{const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:'http://localhost:5173','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,data:await r.json()};};
  const login=async(id:string)=>{const result=await api('/auth/login','',{email:id+'@fixture.test',password});assert.equal(result.status,201);return result.data.accessToken as string;};
  const ownerToken=await login(owner),staffToken=await login(staff);
  const head=async()=>String((await db!.query('select revision from app_private.sync_heads where store_id=$1',[store])).rows[0]?.revision??0);
  const changes=async(after:string,token=ownerToken,extra='')=>{const r=await api(`/stores/${store}/sync/changes?after=${after}${extra}`,token);assert.equal(r.status,200,JSON.stringify(r.data));return r.data as{cursor:string;hasMore:boolean;resetRequired:boolean;changes:{id:string;resource:string;revision:string}[]};};

  await t.test('repair and shift mutations are durable without a socket notification',async()=>{
   const before=await head(),broken={changed:async()=>{throw Error('notification deliberately unavailable');}} as unknown as CounterGateway;
   const actor=await app!.get(AuthService).authenticate(ownerToken),workflows=new WorkflowsService(app!.get(Database),broken);
   const job=await workflows.saveJob(actor,store,{id:randomUUID(),customerName:'Isolated counter',device:'Fixture phone',problem:'Charging port',status:'Received'});
   const shift=await workflows.saveShift(actor,store,{id:randomUUID(),employeeId:owner,date:'2026-11-12',start:'09:00',end:'17:00',status:'Open',openingCash:0});
   const result=await changes(before);assert(result.changes.some(c=>c.resource==='jobs'&&c.id===job.id));assert(result.changes.some(c=>c.resource==='shifts'&&c.id===shift.id));
   assert.equal((await db!.query('select count(*)::int n from public.repair_jobs where id=$1',[job.id])).rows[0].n,1);
   const update=await api(`/stores/${store}/jobs`,ownerToken,{...job,status:'Diagnosing'});assert.equal(update.status,201,JSON.stringify(update.data));
   assert.equal((await db!.query('select status from public.repair_jobs where id=$1',[job.id])).rows[0].status,'Diagnosing');
  });
  await t.test('permissions filter IDs, advance denied pages and notify only the affected staff session',async()=>{
   const beginning='0',filtered=await changes(beginning,staffToken);assert(!filtered.changes.some(c=>['jobs','shifts','audit'].includes(c.resource)));assert(BigInt(filtered.cursor)>0n);
   const before=await head();await db!.query("insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key='repairs.view'",[staff,store]);
   await db!.query("update public.profiles set phone='fixture-only' where id=$1",[owner]);
   const granted=await changes(before,staffToken);assert(granted.changes.some(c=>c.resource==='permissions'&&c.id===staff));assert(!granted.changes.some(c=>c.resource==='employees'&&c.id===owner));
   assert.equal((await api(`/stores/${randomUUID()}/sync/changes?after=0`,ownerToken)).status,403);assert.equal((await api(`/stores/${store}/sync/changes?after=0`)).status,401);
   assert(!/purchase_cost|labor_revenue|customerName|phone|password_hash/.test(JSON.stringify(granted)));
  });
  await t.test('bootstrap and future cursors reset safely, empty polls and reads do not create changes',async()=>{
   const current=await head(),boot=await changes('0',ownerToken,'&bootstrap=1');assert.equal(boot.cursor,current);assert.equal(boot.resetRequired,true);assert.equal(boot.changes.length,0);
   const future=await changes(String(BigInt(current)+1000n));assert.equal(future.resetRequired,true);assert.equal(future.cursor,current);
   for(const path of ['products/pos','jobs','shifts'])assert.equal((await api(`/stores/${store}/${path}`,ownerToken)).status,200);
   assert.equal(await head(),current);assert.equal((await changes(current)).changes.length,0);
   assert.equal((await api(`/stores/${store}/sync/changes?after=9223372036854775808`,ownerToken)).status,400);
  });
  await t.test('a rollback publishes nothing and concurrent commits cannot skip an earlier revision',async()=>{
   const before=await head();await db!.query('begin');await db!.query("select app_private.emit_revision($1,'jobs',$2)",[store,randomUUID()]);await db!.query('rollback');assert.equal(await head(),before);
   const a=new pg.Client({connectionString:url.toString()}),b=new pg.Client({connectionString:url.toString()});await a.connect();await b.connect();
   try{
    await a.query('begin');await b.query('begin');await a.query("select app_private.emit_revision($1,'jobs','first')",[store]);
    let secondFinished=false;const pending=b.query("select app_private.emit_revision($1,'jobs','second')",[store]).then(()=>{secondFinished=true;});
    await new Promise(resolve=>setTimeout(resolve,80));assert.equal(secondFinished,false);assert.equal(await head(),before);
    await a.query('commit');await pending;await b.query('commit');const rows=(await changes(before)).changes.filter(c=>c.resource==='jobs');assert.deepEqual(rows.map(r=>r.id),['first','second']);assert(BigInt(rows[0].revision)<BigInt(rows[1].revision));
   }finally{await a.end();await b.end();}
  });
  await t.test('catalog/supplier/financial-only changes revise safely and heartbeats do not',async()=>{
   const before=await head(),supplier=randomUUID();await db!.query("insert into public.catalog_values(store_id,kind,value) values($1,'brand','R2B Fixture Brand')",[store]);await db!.query("insert into public.suppliers(id,store_id,name) values($1,$2,'R2B Supplier')",[supplier,store]);
   const result=await changes(before);assert(result.changes.some(c=>c.resource==='catalog'));assert(result.changes.some(c=>c.resource==='suppliers'&&c.id===supplier));
   const product=randomUUID();assert.equal((await api(`/stores/${store}/products`,ownerToken,{id:product,name:'R2B financial revision fixture',category:'Parts',selling_price:2000,minimum_selling_price:1700,purchase_cost:900})).status,201);
   const prior=await head();await db!.query('update public.product_financials set purchase_cost=901 where product_id=$1',[product]);const financial=await changes(prior);assert(financial.changes.some(c=>c.resource==='products'&&c.id===product));assert(!JSON.stringify(financial).includes('901'));
   const actor=await app!.get(AuthService).authenticate(ownerToken),device=randomUUID();await db!.query("insert into app_private.staff_devices(id,store_id,owner_profile_id,current_session_id,name,platform) values($1,$2,$3,$4,'Fixture phone','Android')",[device,store,owner,actor.sessionId]);
   const previous=await head();await db!.query("update app_private.staff_devices set last_seen_at=now()+interval '1 minute' where id=$1",[device]);assert.equal(await head(),previous);
  });
  await t.test('all shared domain mutation tables have transaction-bound revision coverage',async()=>{
   const tables=['products','product_financials','locations','stock_movements','customers','sales','payments','payment_methods','business_settings','employee_permissions','repair_services','repair_jobs','shifts','catalog_values','suppliers','stock_receipts','stock_receipt_lines','stock_receipt_costs','returns','credit_accounts','purchased_devices','coupons','audit_logs','store_memberships','profiles','stores'];
   const covered=(await db!.query("select distinct c.relname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal and t.tgname in ('desktop_revision','phase5c_revision','cloud_revision')")).rows.map(row=>row.relname);assert.deepEqual(tables.filter(table=>!covered.includes(table)),[]);
  });
 }finally{
  await app?.close();await db?.end();assert.match(name,/^taha_r2b_revisions_\d+$/);await admin.query('drop database if exists '+name);await admin.query('drop role if exists '+role);await admin.end();
 }
});
