import {Inject,Injectable,OnApplicationBootstrap,OnModuleDestroy} from '@nestjs/common';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import jwt from 'jsonwebtoken';
import {CONFIG,type Configuration} from '../config';
import {Database} from '../database/database.service';
import {verifiedPostgresTls} from '../database/verified-tls';
import {migrationManifest} from '../database/migration-manifest';
import {LocalFileStorage} from '../media/file-storage';
import {hashPassword,verifyPassword} from '../auth/crypto';

type State='pass'|'fail'|'not-required'|'not-checked';
export interface ReadinessResult {
 application:'taha-pos';status:'ready'|'degraded'|'unavailable';version:string;checkedAt:string;
 checks:Record<'configuration'|'startup'|'database'|'tls'|'schema'|'functions'|'permissions'|'authentication'|'privateStorage',State>;
 migrations:{expected:number;applied:number;matched:number};storageCheckedAt?:string;
}
const requiredFunctions=['public.get_session_context()','public.has_permission(text,uuid)','public.get_pos_products(uuid)','public.complete_sale(uuid,jsonb)','public.return_sale_item(uuid,jsonb)','public.receive_credit_payment(uuid,jsonb)','public.save_repair_job(uuid,jsonb)','public.save_shift(uuid,jsonb)'];
const protectedTables=['public.products','public.product_financials','public.sales','public.sale_items','public.sale_item_financials','public.payments','public.credit_ledger_entries','public.customers','public.returns','public.repair_jobs','public.shifts'];

@Injectable()
export class ReadinessService implements OnApplicationBootstrap,OnModuleDestroy {
 private started=false;private stopping=false;private flight?:Promise<ReadinessResult>;private cached?:ReadinessResult;
 private storage?:{passed:boolean;at:number};private crypto?:Promise<boolean>;
 private manifest?:ReturnType<typeof migrationManifest>;
 constructor(@Inject(Database) private readonly db:Database,@Inject(LocalFileStorage) private readonly files:LocalFileStorage,@Inject(CONFIG) private readonly config:Configuration){}
 onApplicationBootstrap(){this.started=true;}
 onModuleDestroy(){this.stopping=true;this.cached=undefined;}
 async check(force=false):Promise<ReadinessResult>{
  if(this.flight)return this.flight;
  if(!force&&this.cached&&Date.now()-Date.parse(this.cached.checkedAt)<2000)return this.cached;
  this.flight=this.inspect(force).then(result=>{this.cached=result;return result;}).finally(()=>{this.flight=undefined;});return this.flight;
 }
 private async inspect(force:boolean):Promise<ReadinessResult>{
  const checks:ReadinessResult['checks']={configuration:'pass',startup:this.started&&!this.stopping?'pass':'fail',database:'not-checked',tls:this.config.cloud?'not-checked':'not-required',schema:'not-checked',functions:'not-checked',permissions:'not-checked',authentication:'not-checked',privateStorage:'not-checked'};
  if(this.config.cloud&&(!this.config.cookieSecure||!this.config.trustedProxy||this.config.storageDriver!=='s3'))checks.configuration='fail';
  let expected=0,applied=0,matched=0;
  try{
   const manifest=await (this.manifest??=migrationManifest(path.resolve(__dirname,'../../migrations')));expected=manifest.length;
   await this.db.transaction(async client=>{
    await client.query("set local statement_timeout='3500ms'");
    await client.query('select 1');checks.database='pass';
    if(this.config.cloud)checks.tls=verifiedPostgresTls(client)?'pass':'fail';
    const registry=(await client.query<{name:string;checksum:string}>('select name,checksum from app_migrations.applied')).rows;applied=registry.length;
    const installed=new Map(registry.map(row=>[row.name,row.checksum]));matched=manifest.filter(row=>installed.get(row.name)===row.checksum).length;
    checks.schema=matched===expected&&applied===expected?'pass':'fail';
    const functions=(await client.query<{ready:boolean}>("select (select exists(select 1 from pg_extension where extname='pgcrypto')) and not exists(select 1 from unnest($1::text[]) f where to_regprocedure(f) is null) ready",[requiredFunctions])).rows[0];checks.functions=functions.ready?'pass':'fail';
    const role=(await client.query<{safe:boolean}>(`select not r.rolsuper and not r.rolbypassrls and not r.rolcreatedb and not r.rolcreaterole and not r.rolinherit
      and pg_has_role(current_user,'authenticated','MEMBER')
      and r.oid<>(select datdba from pg_database where datname=current_database()) and r.rolcanlogin
      and not exists(select 1 from pg_namespace where nspname in ('public','private','app_private','auth') and nspowner=r.oid)
      and not has_table_privilege(current_user,'public.product_financials','SELECT')
      and not exists(select 1 from (values('app_private.accounts'),('app_private.sessions')) a(t) cross join unnest(array['SELECT','INSERT','UPDATE']) p where not has_table_privilege(current_user,a.t,p))
      and has_table_privilege(current_user,'app_private.sync_changes','SELECT')
      and not has_table_privilege(current_user,'app_private.sync_changes','UPDATE,DELETE')
      and not has_table_privilege(current_user,'app_private.cash_capture_events','UPDATE,DELETE')
      and not exists(select 1 from unnest($1::text[]) t left join pg_class c on c.oid=to_regclass(t) where c.oid is null or not c.relrowsecurity) safe
      from pg_roles r where r.rolname=current_user`,[protectedTables])).rows[0];
    checks.permissions=role?.safe?'pass':'fail';
    const provisioned=Boolean((await client.query('select exists(select 1 from app_private.accounts where enabled) ready')).rows[0]?.ready);
    await client.query('set local role authenticated');
    if(checks.functions==='pass'){
     const executable=(await client.query<{ready:boolean}>('select bool_and(has_function_privilege(current_user,to_regprocedure(f),\'EXECUTE\')) ready from unnest($1::text[]) f',[requiredFunctions])).rows[0];if(!executable.ready)checks.permissions='fail';
    }
    if(!this.crypto)this.crypto=(async()=>{try{const probe=randomBytes(24).toString('hex'),hash=await hashPassword(probe);if(!await verifyPassword(hash,probe))return false;const signed=jwt.sign({probe:true},this.config.secret,{algorithm:'HS256',expiresIn:30,audience:'taha-readiness'});jwt.verify(signed,this.config.secret,{algorithms:['HS256'],audience:'taha-readiness'});return true;}catch{return false;}})();
    checks.authentication=provisioned&&await this.crypto?'pass':'fail';
   });
  }catch{if(checks.database==='not-checked')checks.database='fail';else if(checks.schema==='not-checked')checks.schema='fail';else if(checks.permissions==='not-checked')checks.permissions='fail';}
  if(checks.database==='pass'){
   if(force||!this.storage||Date.now()-this.storage.at>(this.storage.passed?60000:5000)){
    let passed=false;try{await this.files.probePrivateStorage();passed=true;}catch{/* Never return provider paths, keys or raw errors. */}
    this.storage={passed,at:Date.now()};
   }
   checks.privateStorage=this.storage.passed?'pass':'fail';
  }
  const healthy=Object.values(checks).every(value=>value==='pass'||value==='not-required');
  return {application:'taha-pos',status:healthy?'ready':checks.database==='pass'?'degraded':'unavailable',version:'0.1.0',checkedAt:new Date().toISOString(),checks,migrations:{expected,applied,matched},...(this.storage?{storageCheckedAt:new Date(this.storage.at).toISOString()}:{} )};
 }
}
