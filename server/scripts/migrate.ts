import 'dotenv/config';
import {createHash} from 'node:crypto';
import path from 'node:path';
import pg from 'pg';
import {migrationManifest} from '../src/database/migration-manifest';

export async function migrate(client:pg.Client){
 await client.query(`select pg_advisory_lock(838912349)`);
 try {
  await client.query('create schema if not exists app_migrations;create table if not exists app_migrations.applied(name text primary key,checksum text not null,applied_at timestamptz not null default now())');
  const root=path.resolve(__dirname,'../migrations');
  for(const {name,source,checksum:digest} of await migrationManifest(root)){
   const applied=(await client.query('select checksum from app_migrations.applied where name=$1',[name])).rows[0];
   if(applied){if(applied.checksum!==digest)throw new Error(`Applied migration changed: ${name}. Create a new migration.`);continue;}
   // Record each migration atomically, including the imported scripts' schema changes.
   await client.query('BEGIN');try{await client.query(source.trim().replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,''));await client.query('insert into app_migrations.applied(name,checksum) values($1,$2)',[name,digest]);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}console.log(`Applied ${name}`);
  }
 }finally{await client.query('select pg_advisory_unlock(838912349)');}
}
export async function runtimeRole(client:pg.Client,url:string){
 const parsed=new URL(url);const user=decodeURIComponent(parsed.username),pass=decodeURIComponent(parsed.password);
 if(!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(user)||['postgres','authenticated','service_role','anon'].includes(user))throw new Error('DATABASE_URL must use a dedicated runtime login.');
 const quoted='"'+user+'"';
 if(!(await client.query('select 1 from pg_roles where rolname=$1',[user])).rowCount){
  // PostgreSQL utility DDL cannot bind passwords as parameters. Quote literals by doubling apostrophes.
  await client.query(`create role ${quoted} login password '${pass.replaceAll("'","''")}' nosuperuser nobypassrls nocreatedb nocreaterole noinherit`);
 }
 await client.query(`alter role ${quoted} nosuperuser nobypassrls nocreatedb nocreaterole noinherit;grant authenticated to ${quoted};grant usage on schema app_private to ${quoted};grant select,insert,update,delete on all tables in schema app_private to ${quoted};grant usage on schema public,auth,storage to ${quoted}`);
 await client.query(`grant usage on schema app_migrations to ${quoted};grant select on app_migrations.applied to ${quoted}`);
 await client.query(`revoke update,delete on app_private.offline_imports,app_private.sync_changes,app_private.media_uploads,app_private.cash_captures,app_private.cash_capture_events from ${quoted}`);
 // Runtime storage catalog access is private metadata; files are served only by the authorization service.
 await client.query(`grant select,insert,delete on storage.objects to ${quoted};grant select on storage.buckets to ${quoted};grant execute on all functions in schema app_private to ${quoted}`);
 await client.query(`grant usage,select on all sequences in schema app_private to ${quoted}`);
 for(const table of ['cash_captures','cash_capture_events']) {
  const policy='cash_server_'+createHash('sha256').update(user).digest('hex').slice(0,16);
  if(!(await client.query('select 1 from pg_policies where schemaname=$1 and tablename=$2 and policyname=$3',['app_private',table,policy])).rowCount)
   await client.query(`create policy "${policy}" on app_private.${table} for all to ${quoted} using(true) with check(true)`);
 }
 if(!(await client.query("select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='api_storage_catalog'")).rowCount)
  await client.query(`create policy api_storage_catalog on storage.objects for all to ${quoted} using(true) with check(true)`);
}
if(require.main===module){
 const url=process.env.MIGRATION_DATABASE_URL;if(!url)throw new Error('MIGRATION_DATABASE_URL is required.');
 const client=new pg.Client({connectionString:url});client.connect().then(async()=>{try{await migrate(client);if(process.env.DATABASE_URL)await runtimeRole(client,process.env.DATABASE_URL);}finally{await client.end();}}).catch(e=>{console.error(e.message);process.exitCode=1;});
}
