import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import pg from 'pg';
import type {INestApplication} from '@nestjs/common';
import {migrate,runtimeRole} from '../scripts/migrate';
import {initializeEmptyShop,validateInitialOwner} from '../scripts/initialize-staging';
import {seedStaging} from '../scripts/seed-staging';
import {migrationManifest} from '../src/database/migration-manifest';

test('initial owner requires explicit approval and privately supplied credentials',()=>{
 const input={approved:true,email:'owner@isolated.test',name:'Isolated owner',password:randomBytes(24).toString('hex')};assert.doesNotThrow(()=>validateInitialOwner(input));
 for(const change of [{approved:false},{email:'not-an-email'},{name:''},{password:'short'}])assert.throws(()=>validateInitialOwner({...input,...change}));
});

test('R2C clean initialization is empty, atomic, one-time and unavailable to the web runtime',{timeout:300000},async t=>{
 const source=new URL(process.env.TAHA_TEST_POSTGRES_URL??'');assert.equal(source.hostname,'127.0.0.1');assert.equal(source.port,'55459');assert.equal(source.pathname,'/postgres');
 const admin=new pg.Client({connectionString:source.toString()});await admin.connect();assert.match((await admin.query("select current_setting('data_directory') directory")).rows[0].directory.replaceAll('\\','/'),/\/\.test-postgres\/phase5c-20261014\/pgdata$/);
 const name='taha_r2c_init_'+Date.now(),role='r2c_'+randomBytes(6).toString('hex');let db:pg.Client|undefined,app:INestApplication|undefined;
 try{
  await admin.query('create database '+name);source.pathname='/'+name;db=new pg.Client({connectionString:source.toString()});await db.connect();await migrate(db);
  const runtime=new URL(source);runtime.username=role;runtime.password=randomBytes(24).toString('hex');await runtimeRole(db,runtime.toString());
  const one={approved:true,email:'first@isolated.test',name:'First owner',password:randomBytes(24).toString('hex')},two={...one,email:'second@isolated.test',name:'Second owner'};
  const shop=(await db.query('select id from public.stores')).rows[0].id;let owner:Awaited<ReturnType<typeof initializeEmptyShop>>,credentials=one;
  await t.test('pre-existing business records are refused without adding an account',async()=>{
   const supplier=randomUUID();await db!.query("insert into public.suppliers(id,store_id,name) values($1,$2,'Existing isolated record')",[supplier,shop]);await assert.rejects(()=>initializeEmptyShop(db!,one),/existing identities or shop records/);assert.equal((await db!.query('select count(*)::int n from app_private.accounts')).rows[0].n,0);await db!.query('delete from public.suppliers where id=$1',[supplier]);
  });
  await t.test('concurrent initialization creates exactly one authorized owner and closes bootstrap',async()=>{
   const a=new pg.Client({connectionString:source.toString()}),b=new pg.Client({connectionString:source.toString()});await a.connect();await b.connect();try{const results=await Promise.allSettled([initializeEmptyShop(a,one),initializeEmptyShop(b,two)]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);const winner=results.findIndex(result=>result.status==='fulfilled');const result=results[winner];assert(result.status==='fulfilled');owner=result.value;credentials=winner===0?one:two;}finally{await a.end();await b.end();}
   assert.equal((await db!.query('select count(*)::int n from app_private.accounts')).rows[0].n,1);assert.equal((await db!.query('select count(*)::int n from app_private.shop_initialization')).rows[0].n,1);
  });
  await t.test('first owner has setup state, no sample business activity and no plaintext password',async()=>{
   for(const table of ['products','customers','sales','payments','stock_movements','stock_receipts','locations','credit_ledger_entries','repair_jobs','suppliers'])assert.equal((await db!.query(`select count(*)::int n from public.${table}`)).rows[0].n,0,table);
   assert.equal((await db!.query('select count(*)::int n from app_private.staging_datasets')).rows[0].n,0);
   const settings=(await db!.query('select settings from public.business_settings')).rows[0].settings;assert.equal(settings.shopConfiguration.setupRequired,true);assert.equal(settings.shopConfiguration.setupCompleted,false);assert.equal(settings.shopConfiguration.operatingMode,'owner-only');assert(!JSON.stringify(settings).includes(credentials.password));
   const account=(await db!.query('select password_hash from app_private.accounts')).rows[0];assert.match(account.password_hash,/^\$argon2id\$/);assert.notEqual(account.password_hash,credentials.password);
  });
  await t.test('runtime cannot read/write/reopen bootstrap and normal startup exposes no public signup',async()=>{
   const restricted=new pg.Client({connectionString:runtime.toString()});await restricted.connect();try{assert.equal((await restricted.query("select has_table_privilege(current_user,'app_private.shop_initialization','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') allowed")).rows[0].allowed,false);await assert.rejects(()=>restricted.query('delete from app_private.shop_initialization'),{code:'42501'});}finally{await restricted.end();}
   Object.assign(process.env,{DATABASE_URL:runtime.toString(),JWT_SECRET:randomBytes(32).toString('hex'),NODE_ENV:'test',TAHA_RUNTIME:'local',VERCEL:'0',FRONTEND_ORIGIN:'http://localhost:5173',PUBLIC_API_URL:'http://localhost:3000',STORAGE_DRIVER:'local',STORAGE_ROOT:await mkdtemp(path.join(os.tmpdir(),'taha-r2c-init-')),PORT:'0'});delete process.env.TAHA_SERVE_FRONTEND;
   const {createApp}=await import('../src/main');app=await createApp();await app.listen(0,'127.0.0.1');const base=(await app.getUrl())+'/api/v1';
   for(const route of ['/auth/signup','/auth/bootstrap','/auth/initialize'])assert.equal((await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,404);
   const login=await fetch(base+'/auth/login',{method:'POST',headers:{Origin:'http://localhost:5173','Content-Type':'application/json'},body:JSON.stringify({email:credentials.email,password:credentials.password})});assert.equal(login.status,201);const session=await login.json();assert.equal(session.context.profile.id,owner.ownerId);
   const headers={Authorization:'Bearer '+session.accessToken};const ready=await fetch(base+'/health/ready?refresh=1',{headers});assert.equal(ready.status,200);assert.equal((await ready.json()).migrations.expected,(await migrationManifest(path.resolve('migrations'))).length);
   const settings=await(await fetch(base+'/stores/'+shop+'/settings',{headers})).json();assert.equal(settings.shopConfiguration.setupRequired,true);assert.equal(settings.defaultTaxProfileId??'','');
  });
  await t.test('repeat initialization, sample seeding and marker deletion cannot reset the clean shop',async()=>{
   await assert.rejects(()=>initializeEmptyShop(db!,one),/creation is closed/);await assert.rejects(()=>seedStaging(db!,{environment:'staging',approved:true,url:source.toString(),email:'samples@isolated.test',password:randomBytes(24).toString('hex')}),/existing accounts/);await assert.rejects(()=>db!.query('delete from app_private.shop_initialization'));
   assert.equal((await db!.query('select count(*)::int n from public.sales')).rows[0].n,0);assert.equal((await db!.query('select count(*)::int n from app_private.accounts')).rows[0].n,1);
  });
 }finally{await app?.close();await db?.end();assert.match(name,/^taha_r2c_init_\d+$/);await admin.query('drop database if exists '+name+' with(force)');await admin.query('drop role if exists '+role);await admin.end();}
});
