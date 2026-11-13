import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {migrate,runtimeRole} from '../scripts/migrate';

test('R2C managed migration uses a non-superuser and refuses privileged runtime identities',{timeout:180000},async t=>{
 const source=new URL(process.env.TAHA_TEST_POSTGRES_URL??'');assert.equal(source.hostname,'127.0.0.1');assert.equal(source.port,'55459');assert.equal(source.pathname,'/postgres');
 const admin=new pg.Client({connectionString:source.toString()});await admin.connect();assert.match((await admin.query("select current_setting('data_directory') directory")).rows[0].directory.replaceAll('\\','/'),/\/\.test-postgres\/phase5c-20261014\/pgdata$/);
 const suffix=randomBytes(6).toString('hex'),name='taha_r2c_managed_'+suffix,migration='r2c_migrator_'+suffix,runtime='r2c_runtime_'+suffix,unsafe='r2c_unsafe_'+suffix,password=randomBytes(24).toString('hex');let db:pg.Client|undefined;
 try{
  await admin.query(`create role ${migration} login password '${password}' nosuperuser nobypassrls nocreatedb createrole noinherit`);
  await admin.query(`grant anon,authenticated,service_role to ${migration} with admin option`);
  await admin.query(`create database ${name} owner ${migration}`);source.pathname='/'+name;source.username=migration;source.password=password;db=new pg.Client({connectionString:source.toString()});await db.connect();
  await t.test('all migrations run under the dedicated non-superuser database owner',async()=>{await migrate(db!);assert.equal((await db!.query('select rolsuper from pg_roles where rolname=current_user')).rows[0].rolsuper,false);assert.equal((await db!.query('select count(*)::int n from app_migrations.applied')).rows[0].n,69);});
  const runtimeUrl=new URL(source);runtimeUrl.username=runtime;runtimeUrl.password=randomBytes(24).toString('hex');
  await t.test('create and replay of restricted runtime grants need no superuser-only ALTER',async()=>{
   await runtimeRole(db!,runtimeUrl.toString());await runtimeRole(db!,runtimeUrl.toString());const row=(await db!.query('select rolsuper,rolbypassrls,rolreplication,rolcreatedb,rolcreaterole,rolinherit,rolcanlogin from pg_roles where rolname=$1',[runtime])).rows[0];assert.deepEqual(row,{rolsuper:false,rolbypassrls:false,rolreplication:false,rolcreatedb:false,rolcreaterole:false,rolinherit:false,rolcanlogin:true});
   const client=new pg.Client({connectionString:runtimeUrl.toString()});await client.connect();try{assert.equal((await client.query('select count(*)::int n from app_migrations.applied')).rows[0].n,69);await assert.rejects(()=>client.query('select * from public.product_financials'),{code:'42501'});assert.equal((await client.query("select has_table_privilege(current_user,'app_private.shop_initialization','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') allowed")).rows[0].allowed,false);}finally{await client.end();}
  });
  await t.test('privileged existing runtime is refused before any private grant or silent downgrade',async()=>{
   await admin.query(`create role ${unsafe} login bypassrls`);const target=new URL(source);target.username=unsafe;await assert.rejects(()=>runtimeRole(db!,target.toString()),/dedicated restricted/);assert.equal((await db!.query('select rolbypassrls from pg_roles where rolname=$1',[unsafe])).rows[0].rolbypassrls,true);assert.equal((await db!.query("select has_table_privilege($1,'app_private.accounts','SELECT') allowed",[unsafe])).rows[0].allowed,false);
  });
  await t.test('additional role membership is refused even when NOINHERIT is set',async()=>{
   await admin.query(`alter role ${unsafe} nobypassrls noinherit;grant service_role to ${unsafe}`);const target=new URL(source);target.username=unsafe;await assert.rejects(()=>runtimeRole(db!,target.toString()),/dedicated restricted/);assert.equal((await db!.query("select has_table_privilege($1,'app_private.accounts','SELECT') allowed",[unsafe])).rows[0].allowed,false);
  });
 }finally{await db?.end();assert.match(name,/^taha_r2c_managed_[a-f0-9]{12}$/);await admin.query('drop database if exists '+name+' with(force)');for(const role of [runtime,unsafe,migration])await admin.query('drop role if exists '+role);await admin.end();}
});
