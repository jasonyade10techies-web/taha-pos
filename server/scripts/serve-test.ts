import 'reflect-metadata';
import pg from 'pg';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdtemp,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {migrate,runtimeRole} from './migrate';
import {hashPassword} from '../src/auth/crypto';
// Isolated localhost integration fixture. Never seeds a production database or accepts remote admin URLs.
async function serve(){
 const adminUrl=process.env.TAHA_TEST_POSTGRES_URL??'postgresql://taha_test@127.0.0.1:55439/postgres';const parsed=new URL(adminUrl);
 if(!['localhost','127.0.0.1'].includes(parsed.hostname)||parsed.pathname!=='/postgres')throw new Error('A localhost administrator /postgres URL is required.');
 const admin=new pg.Client({connectionString:adminUrl});await admin.connect();const database='taha_api_browser_'+Date.now();await admin.query(`create database ${database}`);await admin.end();parsed.pathname='/'+database;
 const db=new pg.Client({connectionString:parsed.toString()});await db.connect();await migrate(db);
 const runtimeUrl=new URL(parsed);runtimeUrl.username='taha_api_test';runtimeUrl.password='test-runtime-password';await runtimeRole(db,runtimeUrl.toString());
 const owner='50000000-0000-4000-8000-000000000001',employee='50000000-0000-4000-8000-000000000002',store='10000000-0000-4000-8000-000000000001';
 const password='Secure test password 2026!',hash=await hashPassword(password);
 const manager='50000000-0000-4000-8000-000000000003';
 for(const [id,email,name,role] of [[owner,'owner@taha.test','Ahmed Khan','owner'],[employee,'employee@taha.test','Hamza','employee'],[manager,'manager@taha.test','Ali','manager']]){
  await db.query('insert into auth.users(id,email) values($1,$2)',[id,email]);await db.query("insert into public.profiles(id,full_name,email,role,status) values($1,$2,$3,$4,'active')",[id,name,email,role]);await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)',[id,store]);await db.query('insert into app_private.accounts(user_id,email,password_hash) values($1,$2,$3)',[id,email,hash]);
 }
 await db.query("insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key in ('sales.create','sales.view','customers.view','customers.create','customers.edit','devices.pair','media.upload','camera.request','services.create_custom','pricing.discount_within_range')",[employee,store]);
 await db.query("insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key in ('sales.create','sales.view','customers.view','customers.create','customers.edit','credit.create','credit.receive_payment','inventory.view','products.edit','services.create_custom','services.save_catalog','pricing.discount_within_range','pricing.override_minimum','devices.pair','media.upload','camera.request','appearance.customize')",[manager,store]);
 await db.query('BEGIN');await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[owner]);await db.query('SET LOCAL ROLE authenticated');
 const location='50000000-0000-4000-8000-000000000012';
 await db.query('select public.save_location($1,$2)',[store,{id:'50000000-0000-4000-8000-000000000010',name:'Rack 12',kind:'rack'}]);
 await db.query('select public.save_location($1,$2)',[store,{id:'50000000-0000-4000-8000-000000000011',name:'Shelf B',kind:'shelf',parent_id:'50000000-0000-4000-8000-000000000010'}]);
 await db.query('select public.save_location($1,$2)',[store,{id:location,name:'Box 04',kind:'box',parent_id:'50000000-0000-4000-8000-000000000011'}]);
 const products=[['Samsung Galaxy A15 Charging Board',1450,1300,'Samsung A15'],['iPhone 13 Battery',3600,3000,'iPhone 13'],['iPhone 13 Screen OLED',12500,11000,'iPhone 13'],['Type-C Charging Port',850,700,'Universal']];
 for(let i=0;i<products.length;i++){const [name,price,min,model]=products[i];await db.query('select public.save_product($1,$2)',[store,{id:`50000000-0000-4000-8000-${String(20+i).padStart(12,'0')}`,name,category:'Parts',brand:i?'Apple':'Samsung',compatible_model:model,quality_grade:i?'Original':'Grade A',selling_price:price,minimum_selling_price:min,purchase_cost:500,initial_quantity:20,default_location_id:location}]);}
 await db.query('select public.save_customer($1,$2)',[store,{id:'50000000-0000-4000-8000-000000000030',name:'Ali Mobiles',type:'Shop / Business',shopName:'Ali Mobiles',phone:'03001234567',creditEnabled:true,creditLimit:50000}]);
 await db.query('select public.save_supplier($1,$2)',[store,{id:'50000000-0000-4000-8000-000000000040',name:'Test Parts Supplier',phone:'03007654321',whatsapp:'',address:'',notes:'Isolated browser fixture only'}]);
 for(const subtype of ['JazzCash','Easypaisa','Bank'])await db.query('select public.save_payment_method($1,$2)',[store,{id:randomUUID(),name:subtype==='Bank'?'Bank Transfer':subtype,kind:'Digital',subtype,title:'TAHA MOBILES',number:'03001234567',iban:subtype==='Bank'?'PK00TEST0000000000000001':'',enabled:true,requiresProof:true}]);
 await db.query('select public.set_employee_pin($1,$2,$3)',[owner,store,'739182']);await db.query('COMMIT');await db.end();
 process.env.DATABASE_URL=runtimeUrl.toString();process.env.JWT_SECRET=randomBytes(32).toString('hex');process.env.NODE_ENV='test';process.env.PORT=process.env.TAHA_TEST_API_PORT??'3000';process.env.PUBLIC_API_URL='http://localhost:'+process.env.PORT;process.env.FRONTEND_ORIGIN=process.env.TAHA_TEST_FRONTEND_ORIGINS??'http://localhost:1422,http://127.0.0.1:1422,http://localhost:5173,http://127.0.0.1:5173';process.env.STORAGE_ROOT=await mkdtemp(path.join(os.tmpdir(),'taha-api-browser-media-'));
 const {createApp}=await import('../src/main');const app=await createApp();await app.listen(Number(process.env.PORT),'127.0.0.1');
 // A launcher only trusts a fresh fixture that proves its process/session and
 // disposable database target. This file never contains credentials or secrets.
 if(process.env.TAHA_TEST_FIXTURE_MANIFEST){const source=new URL(adminUrl);await writeFile(process.env.TAHA_TEST_FIXTURE_MANIFEST,JSON.stringify({runId:process.env.TAHA_TEST_FIXTURE_RUN_ID,pid:process.pid,host:'127.0.0.1',port:Number(process.env.PORT),postgresHost:source.hostname,postgresPort:Number(source.port),adminRole:source.username,database,ready:true},null,2),{flag:'wx'});}
 console.log(`API browser fixture ready on ${process.env.PORT}, isolated database ${database}. Credentials are test-only and are not printed.`);
}
serve().catch(e=>{console.error(e.message);process.exit(1);});
