import 'dotenv/config';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {hashPassword,validatePassword} from '../src/auth/crypto';
import {stagingTarget,stagingClient} from './staging-target';

export interface InitialOwner {email:string;name:string;password:string;approved:boolean}
export function validateInitialOwner(input:InitialOwner){
 if(!input.approved)throw Error('Explicit one-time shop initialization approval is required.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)||input.email.length>254||!input.name.trim()||input.name.length>120)throw Error('Supply the first owner identity privately.');
 validatePassword(input.password);
}

/** Fresh, migrated staging only. Never creates sample business activity. */
export async function initializeEmptyShop(db:pg.Client,input:InitialOwner){
 validateInitialOwner(input);const hash=await hashPassword(input.password);
 await db.query('begin');try{
  await db.query('select pg_advisory_xact_lock(816264)');
  if((await db.query('select exists(select 1 from app_private.shop_initialization) present')).rows[0].present)throw Error('Initial owner creation is closed for this database.');
  for(const table of ['auth.users','app_private.accounts','app_private.media','app_private.staging_datasets','public.profiles','public.products','public.customers','public.sales','public.payments','public.stock_movements','public.stock_receipts','public.locations','public.credit_ledger_entries','public.repair_jobs','public.shifts','public.suppliers','public.purchased_devices']){
   if((await db.query(`select exists(select 1 from ${table}) occupied`)).rows[0].occupied)throw Error('Initialization refuses a database containing existing identities or shop records.');
  }
  const stores=(await db.query<{id:string}>('select id from public.stores order by id')).rows;if(stores.length!==1)throw Error('An empty single-shop database is required.');
  const store=stores[0].id,owner=randomUUID(),email=input.email.trim().toLowerCase();
  await db.query('insert into auth.users(id,email) values($1,$2)',[owner,email]);
  await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,$2,$3,'owner','active')",[owner,email,input.name.trim()]);
  await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)',[owner,store]);
  await db.query('insert into app_private.accounts(user_id,email,password_hash) values($1,$2,$3)',[owner,email,hash]);
  // A new installation opts in. Existing shops and sample fixtures are never
  // redirected merely because older settings lack a completion flag.
  const configuration={operatingMode:'owner-only',setupRequired:true,setupCompleted:false,setupStep:0,enabledFeatures:{credit:true,testItems:false,repairs:true,usedDevices:false,suppliers:true,mobileSales:true,website:false},storageLabels:{rack:'Rack',shelf:'Shelf',box:'Box'},quarantineLocationId:'',showCashierOnReceipt:false};
  const settings=await db.query("update public.business_settings set settings=jsonb_set(settings,'{shopConfiguration}',$2::jsonb),updated_at=now() where store_id=$1",[store,JSON.stringify(configuration)]);if(settings.rowCount!==1)throw Error('The migrated shop settings are incomplete.');
  await db.query('insert into app_private.shop_initialization(store_id,owner_id) values($1,$2)',[store,owner]);
  await db.query('commit');return{storeId:store,ownerId:owner,initialized:true,bootstrapClosed:true};
 }catch(error){await db.query('rollback');throw error;}
}

async function run(){
 const target=stagingTarget(),input={email:process.env.PROVISION_EMAIL??'',name:process.env.PROVISION_NAME??'',password:process.env.PROVISION_PASSWORD??'',approved:process.env.INITIALIZE_SHOP_APPROVED==='true'};
 validateInitialOwner(input);const db=stagingClient(target);await db.connect();try{await initializeEmptyShop(db,input);console.log(JSON.stringify({status:'initialized',bootstrapClosed:true,businessRecordsCreated:0,credentialsPrinted:false}));}finally{await db.end();}
}
if(require.main===module)run().catch(()=>{console.error('One-time staging initialization failed. Verify the approved empty target and private owner configuration. No credentials printed.');process.exitCode=1;});
