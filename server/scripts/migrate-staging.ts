import 'dotenv/config';
import {migrate,runtimeRole} from './migrate';
import {stagingTarget,stagingClient} from './staging-target';
export async function migrateStaging(){
 const target=stagingTarget(),runtime=process.env.DATABASE_URL;
 if(!runtime)throw Error('A separate restricted runtime database connection is required.');
 const address=new URL(runtime);
 if(address.pathname!==target.address.pathname||address.username===target.address.username||
  (target.local?(address.hostname!==target.address.hostname||address.port!==target.address.port):
   (address.hostname!==target.address.hostname&&process.env.TAHA_STAGING_RUNTIME_HOST!==address.hostname)))throw Error('Migration and restricted runtime identities must target the same approved database; separately approve a provider pooling hostname.');
 const db=stagingClient(target);await db.connect();try{
  if(!target.local&&!(await db.query('select ssl from pg_stat_ssl where pid=pg_backend_pid()')).rows[0]?.ssl)throw Error('Verified database TLS is required.');
  await migrate(db);await runtimeRole(db,runtime);
  const restricted=stagingClient({...target,url:runtime,address});await restricted.connect();try{const identity=(await restricted.query('select current_database() name,(select count(*)::int from app_migrations.applied) migrations')).rows[0];if(identity.name!==target.expected||identity.migrations<1)throw Error('The restricted runtime endpoint does not see the approved migrated database.');}finally{await restricted.end();}
  console.log(JSON.stringify({status:'migrated',database:target.expected,registry:'app_migrations.applied',startupMigrations:false}));
 }finally{await db.end();}
}
if(require.main===module)migrateStaging().catch(()=>{console.error('Staging migration failed. Check the approved target, separate role privileges and private administration logs. No credentials printed.');process.exitCode=1;});
