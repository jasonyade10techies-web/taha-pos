import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,writeFile,readFile,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import type {INestApplication} from '@nestjs/common';
import {migrate,runtimeRole} from '../scripts/migrate';
import {hashPassword} from '../src/auth/crypto';
import {LocalFileStorage} from '../src/media/file-storage';
import type {Configuration} from '../src/config';
import type {ReadinessResult} from '../src/health/readiness.service';

test('R2B actual application readiness separates process, schema, runtime grants and storage',{timeout:300000},async t=>{
 const address=new URL(process.env.TAHA_TEST_POSTGRES_URL??'');assert.equal(address.hostname,'127.0.0.1');assert.equal(address.port,'55459');assert.equal(address.pathname,'/postgres');
 const admin=new pg.Client({connectionString:address.toString()});await admin.connect();const name='taha_r2b_readiness_'+Date.now(),role='r2b_'+randomBytes(6).toString('hex');let db:pg.Client|undefined,app:INestApplication|undefined;
 try{
  await admin.query('create database '+name);address.pathname='/'+name;db=new pg.Client({connectionString:address.toString()});await db.connect();await migrate(db);const runtime=new URL(address);runtime.username=role;runtime.password=randomBytes(24).toString('hex');await runtimeRole(db,runtime.toString());
  const owner=randomUUID(),store='10000000-0000-4000-8000-000000000001',password=randomBytes(20).toString('hex');
  await db.query('insert into auth.users(id,email) values($1,$2)',[owner,owner+'@fixture.test']);await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,$2,'R2B Owner','owner','active')",[owner,owner+'@fixture.test']);await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)',[owner,store]);await db.query('insert into app_private.accounts(user_id,email,password_hash) values($1,$2,$3)',[owner,owner+'@fixture.test',await hashPassword(password)]);
  const storageRoot=await mkdtemp(path.join(os.tmpdir(),'taha-r2b-readiness-'));
  Object.assign(process.env,{DATABASE_URL:runtime.toString(),JWT_SECRET:randomBytes(32).toString('hex'),NODE_ENV:'test',TAHA_RUNTIME:'local',FRONTEND_ORIGIN:'http://localhost:5173',PUBLIC_API_URL:'http://localhost:3000',STORAGE_DRIVER:'local',STORAGE_ROOT:storageRoot,PORT:'0'});delete process.env.TAHA_SERVE_FRONTEND;
  const {createApp}=await import('../src/main');app=await createApp();await app.listen(0,'127.0.0.1');const base=(await app.getUrl())+'/api/v1';
  const login=await fetch(base+'/auth/login',{method:'POST',headers:{Origin:'http://localhost:5173','Content-Type':'application/json'},body:JSON.stringify({email:owner+'@fixture.test',password})});assert.equal(login.status,201);const token=(await login.json()).accessToken as string;
  const inspect=async()=>{const response=await fetch(base+'/health/ready?refresh=1',{headers:{Authorization:'Bearer '+token}});return{status:response.status,value:await response.json() as ReadinessResult};};
  await t.test('healthy explicit runtime passes the complete current registry and leaves no diagnostic object',async()=>{
   const result=await inspect();assert.equal(result.status,200,JSON.stringify(result.value));assert.equal(result.value.status,'ready');assert.equal(result.value.migrations.expected,(await db!.query('select count(*)::int n from app_migrations.applied')).rows[0].n);assert.equal(result.value.migrations.applied,result.value.migrations.matched);assert.equal(result.value.checks.permissions,'pass');assert.equal(result.value.checks.tls,'not-required');
   assert.deepEqual(await readdir(path.join(storageRoot,'diagnostics')),[]);assert(!JSON.stringify(result).includes(runtime.password));assert(!JSON.stringify(result).includes(storageRoot));
  });
  await t.test('public readiness never exposes the deep diagnostic fields and anonymous deep access is denied',async()=>{
   const publicResult=await fetch(base+'/health/readyz');assert.equal(publicResult.status,200);const body=await publicResult.json();assert.equal(body.checks,undefined);assert.equal(body.migrations,undefined);assert.equal((await fetch(base+'/health/ready')).status,401);
  });
  await t.test('a connected database with a missing migration is not ready',async()=>{
   const row=(await db!.query('select name,checksum from app_migrations.applied order by name desc limit 1')).rows[0];await db!.query('delete from app_migrations.applied where name=$1',[row.name]);
   try{const result=await inspect();assert.equal(result.status,503);assert.equal(result.value.checks.database,'pass');assert.equal(result.value.checks.schema,'fail');}finally{await db!.query('insert into app_migrations.applied(name,checksum) values($1,$2)',[row.name,row.checksum]);}
  });
  await t.test('a changed registry checksum and missing required function are rejected',async()=>{
   const row=(await db!.query('select name,checksum from app_migrations.applied order by name desc limit 1')).rows[0];await db!.query("update app_migrations.applied set checksum='changed' where name=$1",[row.name]);try{assert.equal((await inspect()).value.checks.schema,'fail');}finally{await db!.query('update app_migrations.applied set checksum=$2 where name=$1',[row.name,row.checksum]);}
   await db!.query('alter function public.get_pos_products(uuid) rename to r2b_temporarily_missing');try{const result=await inspect();assert.equal(result.status,503);assert.equal(result.value.checks.functions,'fail');}finally{await db!.query('alter function public.r2b_temporarily_missing(uuid) rename to get_pos_products');}
  });
  await t.test('removing an essential runtime grant or enabling privilege inheritance fails readiness',async()=>{
   await db!.query('revoke insert on app_private.sessions from '+role);try{assert.equal((await inspect()).value.checks.permissions,'fail');}finally{await db!.query('grant insert on app_private.sessions to '+role);}
   await db!.query('alter role '+role+' inherit');try{assert.equal((await inspect()).value.checks.permissions,'fail');}finally{await db!.query('alter role '+role+' noinherit');}
  });
  await t.test('storage errors are degraded, sanitized, retriable, and cached on public probes',async()=>{
   const files=app!.get(LocalFileStorage),original=files.probePrivateStorage.bind(files);let count=0;
   files.probePrivateStorage=async()=>{count++;throw Error('provider-private-secret-never-return');};
   try{const first=await inspect();assert.equal(first.status,503);assert.equal(first.value.status,'degraded');assert.equal(first.value.checks.privateStorage,'fail');assert(!JSON.stringify(first).includes('provider-private-secret'));await fetch(base+'/health/readyz');await fetch(base+'/health/readyz');assert.equal(count,1);}finally{files.probePrivateStorage=original;}
   assert.equal((await inspect()).status,200);
  });
  await t.test('pure liveness stays available while a real independent database connection fails',async()=>{
   const {ReadinessService}=await import('../src/health/readiness.service'),{Database}=await import('../src/database/database.service');
   const config={databaseUrl:'postgresql://unavailable@127.0.0.1:1/not_a_shop',databasePoolMax:1,cloud:false,storageDriver:'local',secret:randomBytes(32).toString('hex')} as Configuration;
   const dead=new Database(config),readiness=new ReadinessService(dead,app!.get(LocalFileStorage),config);readiness.onApplicationBootstrap();
   try{const state=await readiness.check(true);assert.equal(state.status,'unavailable');assert.equal(state.checks.database,'fail');assert.equal((await fetch(base+'/health/live')).status,200);}finally{await dead.onModuleDestroy();}
  });
  await t.test('termination of a checked-out transaction rejects safely without crashing the API',async()=>{
   const {Database}=await import('../src/database/database.service');let entered!:(pid:number)=>void;
   const ready=new Promise<number>(resolve=>{entered=resolve;});
   const transaction=app!.get(Database).transaction(async connection=>{entered((await connection.query('select pg_backend_pid() pid')).rows[0].pid);await connection.query('select pg_sleep(15)');});
   const rejected=assert.rejects(transaction);const pid=await ready;
   await db!.query('select pg_terminate_backend(pid) from pg_stat_activity where pid=$1 and datname=current_database()',[pid]);await rejected;
   assert.equal((await fetch(base+'/health/live')).status,200);assert.equal((await inspect()).status,200);
  });
 }finally{await app?.close();await db?.end();assert.match(name,/^taha_r2b_readiness_\d+$/);await admin.query('drop database if exists '+name);await admin.query('drop role if exists '+role);await admin.end();}
});

test('local private storage probe validates exact bytes and preserves pre-existing files',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'taha-r2b-storage-')),storage=new LocalFileStorage({storageRoot:root,storageDriver:'local'} as Configuration);await writeFile(path.join(root,'retained-photo'),'unique fixture bytes');await storage.probePrivateStorage();assert.equal(await readFile(path.join(root,'retained-photo'),'utf8'),'unique fixture bytes');assert.deepEqual(await readdir(path.join(root,'diagnostics')),[]);assert.equal(await storage.objectStatus('retained-photo'),'present');assert.equal(await storage.objectStatus('missing-original'),'missing');
});
