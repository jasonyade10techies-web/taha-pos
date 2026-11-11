import 'dotenv/config';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {hashPassword,validatePassword} from '../src/auth/crypto';

type SeedOptions={environment:string;approved:boolean;url:string;email:string;password:string};
export function validateStagingSeedTarget(input:SeedOptions){
 if(input.environment!=='staging'||!input.approved)throw new Error('Explicit isolated staging database approval is required.');
 let address:URL;try{address=new URL(input.url);}catch{throw new Error('A staging migration connection is required.');}
 if(!['postgresql:','postgres:'].includes(address.protocol)||address.port==='55439'||/taha_api_browser_/i.test(address.pathname))throw new Error('The saved owner development database cannot be seeded.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)||input.email.length>254)throw new Error('A staging owner email is required.');
 validatePassword(input.password);
}

/** Only empty, migrated staging databases may receive this sample dataset.
 * Stock/sales/credit/returns use the real controlled PostgreSQL operations. */
export async function seedStaging(db:pg.Client,input:SeedOptions){
 validateStagingSeedTarget(input);const passwordHash=await hashPassword(input.password);
 await db.query('BEGIN');try{
  await db.query('select pg_advisory_xact_lock(816263)');
  const existing=(await db.query('select manifest from app_private.staging_datasets where id=true')).rows[0];
  if(existing){await db.query('COMMIT');return {created:false,manifest:existing.manifest};}
  if(Number((await db.query('select count(*) n from app_private.accounts')).rows[0].n)!==0)throw new Error('Refusing to seed a database with existing accounts and no staging dataset marker.');
  const store='10000000-0000-4000-8000-000000000001',owner=randomUUID();
  await db.query('insert into auth.users(id,email) values($1,$2)',[owner,input.email]);
  await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,$2,'Staging Shop Owner','owner','active')",[owner,input.email]);
  await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)',[owner,store]);
  await db.query('insert into app_private.accounts(user_id,email,password_hash) values($1,$2,$3)',[owner,input.email,passwordHash]);
  await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[owner]);await db.query('SET LOCAL ROLE authenticated');
  const call=async(fn:string,body:unknown)=>(await db.query(`select public.${fn}($1,$2) value`,[store,body])).rows[0]?.value;
  const rack=randomUUID(),shelf=randomUUID(),box=randomUUID(),damage=randomUUID();
  for(const value of[{id:rack,name:'Parts Rack',kind:'rack'},{id:shelf,name:'A',kind:'shelf',parent_id:rack},{id:box,name:'01',kind:'box',parent_id:shelf},{id:damage,name:'Quarantine',kind:'box',parent_id:shelf,stockCondition:'Damaged'}])await call('save_location',value);
  const products=[];for(const [name,model,price,cost,minimum]of[
   ['Vivo Y20 Panel','Vivo Y20',2000,1100,1600],['Samsung A15 Charging Board','Samsung A15',1450,800,1300],['iPhone13 Battery','iPhone13',3600,2200,3000],['Type-C Charging Port','Universal',850,350,700]
  ] as const){const id=randomUUID();await call('save_product',{id,name,category:'Parts',brand:name.startsWith('iPhone')?'Apple':name.split(' ')[0],compatible_model:model,quality_grade:'Original',selling_price:price,purchase_cost:cost,minimum_selling_price:minimum,initial_quantity:20,default_location_id:box,aliases:name.includes('Panel')?['y20 panal','y20 screen']:[],notes:'Isolated staging sample'});products.push({id,name,price,minimum});}
  const service=randomUUID();await call('save_repair_service',{id:service,name:'Phone diagnostic service',category:'Repairs',sellingPrice:750,minimumSellingPrice:0,active:true,notes:'Staging sample; no physical stock consumed'});
  const customer=randomUUID();await call('save_customer',{id:customer,name:'Demo Repair Centre',type:'Shop / Business',shopName:'Demo Repair Centre',phone:'',whatsapp:'',creditEnabled:true,creditLimit:50000,notes:'Staging example; no real customer details'});
  const supplier=randomUUID();await call('save_supplier',{id:supplier,name:'Demo Parts Supply',phone:'',whatsapp:'',address:'',notes:'Isolated staging example'});
  const cash=(await db.query("select id from public.payment_methods where store_id=$1 and kind='Cash' and enabled limit 1",[store])).rows[0]?.id;
  if(!cash)throw new Error('A configured cash method is required for the staging dataset.');
  const sale=async(lines:unknown[],amount:number,credit=false)=>call('complete_sale',{idempotencyKey:randomUUID(),cartId:randomUUID(),...(credit?{customerId:customer}:{}),lines,payments:[{methodId:credit?'credit':cash,amount}],...(!credit?{cashReceived:amount}:{})});
  const cashSale=await sale([{productId:products[1].id,quantity:2,unitPrice:1450}],2900);
  const part=products[0];const compound=await sale([{productId:'custom:'+randomUUID(),quantity:1,unitPrice:2500,customService:{name:'Vivo Y20 Panel screen replacement',description:'Screen replacement',sellingPrice:2500,minimumSellingPrice:0,material:{productId:part.id,quantity:1,allocations:[{locationId:box,quantity:1}],pricing:{sellingPrice:part.price,minimumSellingPrice:part.minimum,reviewedAt:new Date().toISOString()}}}}],2500);
  const credit=await sale([{productId:products[2].id,quantity:1,unitPrice:3600}],3600,true);
  await call('receive_credit_payment',{idempotencyKey:randomUUID(),customerId:customer,methodId:cash,amount:1000,notes:'Staging partial collection'});
  const returned=await call('return_sale_item',{idempotencyKey:randomUUID(),saleId:cashSale.id,productId:products[1].id,quantity:1,destination:'Damaged',locationId:damage,receiptConfirmed:true,manualRefundConfirmed:true,reason:'Staging defective part example'});
  await sale([{productId:service,quantity:1,unitPrice:750}],750);
  const manifest={datasetId:randomUUID(),store,owner,customer,supplier,rack,shelf,box,damage,products,service,sales:[cashSale.id,compound.id,credit.id],returnId:returned.id,expectedCredit:2600,kind:'isolated-staging-samples'};
  await db.query('RESET ROLE');
  await db.query('insert into app_private.staging_datasets(id,dataset_id,store_id,manifest) values(true,$1,$2,$3)',[manifest.datasetId,store,manifest]);
  await db.query('COMMIT');return {created:true,manifest};
 }catch(error){await db.query('ROLLBACK');throw error;}
}
if(require.main===module){
 const options={environment:process.env.TAHA_DEPLOYMENT_ENV??'',approved:process.env.TAHA_STAGING_DATABASE_APPROVED==='true',url:process.env.MIGRATION_DATABASE_URL??'',email:process.env.STAGING_OWNER_EMAIL??'',password:process.env.STAGING_OWNER_PASSWORD??''};
 validateStagingSeedTarget(options);const db=new pg.Client({connectionString:options.url});db.connect().then(async()=>{try{const result=await seedStaging(db,options);console.log(JSON.stringify({created:result.created,datasetId:result.manifest.datasetId,status:'Staging sample history is internally linked. No credentials printed.'}));}finally{await db.end();}}).catch(()=>{console.error('Staging seed failed. Check the isolated target and required migrated domain operations. No credentials were logged.');process.exitCode=1;});
}
