import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {migrate} from '../scripts/migrate';

test('Phase5D1 shop configuration, canonical values, complete ledger and offline/mobile boundary', {timeout:300000}, async t=>{
 const url=new URL(process.env.TAHA_TEST_POSTGRES_URL??'postgresql://taha_phase5c@127.0.0.1:55459/postgres');
 assert.equal(url.port,'55459');assert.equal(url.pathname,'/postgres');assert(['localhost','127.0.0.1'].includes(url.hostname));
 const admin=new pg.Client({connectionString:url.toString()});await admin.connect();
 const name='taha_phase5d1_'+Date.now();await admin.query('create database '+name);url.pathname='/'+name;
 const db=new pg.Client({connectionString:url.toString()});await db.connect();
 try{
  await migrate(db);
  const store='10000000-0000-4000-8000-000000000001',owner=randomUUID(),employee=randomUUID();
  for(const [id,role] of [[owner,'owner'],[employee,'employee']]){
   await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@test.local']);
   await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,$2,'5D1 isolated actor',$3,'active')",[id,id+'@test.local',role]);
   await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)',[id,store]);
  }
  const actor=async(id:string,sql:string,args:unknown[]=[])=>{await db.query('begin');try{await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[id]);await db.query('set local role authenticated');const result=await db.query(sql,args);await db.query('commit');return result.rows[0]?.value;}catch(e){await db.query('rollback');throw e;}};
  await t.test('existing installations retain staff mode until setup deliberately changes it',async()=>{
   const settings=await actor(owner,'select public.get_business_settings($1) value',[store]);
   assert.equal(settings.shopConfiguration?.operatingMode,'staff');
   assert.equal(settings.shopConfiguration.enabledFeatures.website,false);
  });
  await t.test('canonical master values use stable IDs and normalize case/whitespace without duplicates',async()=>{
   const a=await actor(owner,'select public.save_catalog_value($1,$2,$3) value',[store,'brand','  ViVo  ']);
   const b=await actor(owner,'select public.save_catalog_value($1,$2,$3) value',[store,'brand','vivo']);
   assert.equal(a.id,b.id);assert.equal(a.value,'ViVo');
   await assert.rejects(actor(employee,'select public.save_catalog_value($1,$2,$3) value',[store,'brand','forbidden']),/permission|denied/i);
  });
  await t.test('owner-only setup persists and does not remove profiles; switching with open shift is refused',async()=>{
   const settings=await actor(owner,'select public.get_business_settings($1) value',[store]);
   const config={...settings.shopConfiguration,operatingMode:'owner-only',setupCompleted:true};
   await actor(owner,'select public.save_business_settings($1,$2) value',[store,{...settings,shopConfiguration:config}]);
   assert.equal((await actor(owner,'select public.get_business_settings($1) value',[store])).shopConfiguration.operatingMode,'owner-only');
   assert.equal((await db.query('select count(*)::int n from public.profiles where id=any($1)',[[owner,employee]])).rows[0].n,2);
   await db.query("insert into public.shifts(id,store_id,employee_id,status,created_by) values($1,$2,$3,'open',$3)",[randomUUID(),store,owner]);
   await assert.rejects(actor(owner,'select public.save_business_settings($1,$2) value',[store,{...settings,shopConfiguration:{...config,operatingMode:'staff'}}]),/shift/i);
  });
  await t.test('customer ledger includes all 520 records and carries continuous balances',async()=>{
   const customer=randomUUID();await db.query("insert into public.customers(id,store_id,name,type) values($1,$2,'5D1 complete ledger','Individual')",[customer,store]);
   await db.query("insert into public.credit_ledger_entries(store_id,customer_id,reference,description,debit,employee_id,created_at) select $1,$2,'opening-'||i,'Historical charge',1,$3,now()+i*interval '1 second' from generate_series(1,520)i",[store,customer,owner]);
   const rows=await actor(owner,'select public.customer_ledger($1,$2) value',[store,customer]);
   assert.equal(rows.length,520);assert.equal(rows[0].balance,1);assert.equal(rows.at(-1).balance,520);
   const dashboard=await actor(owner,'select public.get_dashboard_transactions($1) value',[store]);assert.equal(dashboard.credit[0].id,customer);assert.equal(dashboard.credit[0].amount,520);assert(dashboard.activity.every((entry:{href:string})=>entry.href.startsWith('/')));
   await assert.rejects(actor(employee,'select public.customer_ledger($1,$2) value',[store,customer]),/permission|denied/i);
  });
  await t.test('mobile sale is blocked before any stock/payment mutation while offline authorization is live',async()=>{
   await db.query('select app_private.register_offline_lease($1,$2,$3,$4)',[store,randomUUID(),owner,new Date(Date.now()+60000)]);
   await assert.rejects(actor(owner,'select public.complete_sale($1,$2) value',[store,{clientChannel:'mobile',deviceId:randomUUID(),idempotencyKey:randomUUID(),cartId:randomUUID(),lines:[],payments:[]}]),/offline.*counter|counter.*offline/i);
   assert.equal((await db.query('select count(*)::int n from public.sales where store_id=$1',[store])).rows[0].n,0);
  });
  await t.test('damaged opening and receiving never become sellable; unknown cost remains absent',async()=>{
   const rack=randomUUID(),shelf=randomUUID(),box=randomUUID(),quarantine=randomUUID(),supplier=randomUUID();
   for(const row of [{id:rack,name:'Rack 5D1',kind:'rack'},{id:shelf,name:'Shelf A',kind:'shelf',parent_id:rack},{id:box,name:'Box 01',kind:'box',parent_id:shelf},{id:quarantine,name:'Quarantine',kind:'box',parent_id:shelf,stockCondition:'Damaged'}])await actor(owner,'select public.save_location($1,$2) value',[store,row]);
   await actor(owner,'select public.save_supplier($1,$2) value',[store,{id:supplier,name:'5D1 supplier',phone:'',address:'',whatsapp:'',notes:''}]);
   const product=await actor(owner,'select public.save_product($1,$2) value',[store,{name:'5D1 damaged opening',category:'Parts',selling_price:100,minimum_selling_price:80,initial_quantity:2,initial_condition:'Damaged',default_location_id:quarantine}]);
   let overview=(await actor(owner,'select public.inventory_conditions($1,$2) value',[store,product.id]))[0];
   assert.equal(overview.available,0);assert.equal(overview.damaged,2);
   const receipt=randomUUID(),input={id:receipt,supplier_id:supplier,date:'2026-10-21',lines:[{product_id:product.id,quantity:3,location_id:box,condition:'Available'}]};
   await actor(owner,'select public.save_stock_receipt($1,$2,$3) value',[store,input,true]);
   overview=(await actor(owner,'select public.inventory_conditions($1,$2) value',[store,product.id]))[0];assert.equal(overview.available,3);assert.equal(overview.damaged,2);
   assert.equal((await db.query('select count(*)::int n from public.product_financials where product_id=$1',[product.id])).rows[0].n,0);
   await assert.rejects(actor(owner,'select public.save_stock_receipt($1,$2,$3) value',[store,input,true]),/already received/i);
   const service=await actor(owner,'select public.save_product($1,$2) value',[store,{name:'5D1 service',category:'Services',selling_price:100,minimum_selling_price:0,initial_quantity:0}]);
   await assert.rejects(actor(owner,'select public.save_stock_receipt($1,$2,$3) value',[store,{...input,id:randomUUID(),lines:[{product_id:service.id,quantity:1,location_id:box}]},true]),/physical stock|service/i);
   const quarantineReceipt={...input,id:randomUUID(),lines:[{product_id:product.id,quantity:4,location_id:quarantine,condition:'Damaged'}]};
   await actor(owner,'select public.save_stock_receipt($1,$2,$3) value',[store,quarantineReceipt,true]);
   overview=(await actor(owner,'select public.inventory_conditions($1,$2) value',[store,product.id]))[0];assert.equal(overview.available,3);assert.equal(overview.damaged,6);
   const lots=await actor(owner,'select public.damaged_inventory($1,$2) value',[store,product.id]);assert.equal(lots.length,2);assert(lots.some((l:{originType:string})=>l.originType==='opening'));
  });
  await t.test('desktop and phone compete atomically for final unit; accepted mobile retries retain invoice',async()=>{
   await db.query('delete from app_private.offline_counter_leases');
   const box=(await db.query("select id from public.locations where store_id=$1 and kind='box' and stock_condition='Available' limit 1",[store])).rows[0].id;
   const product=await actor(owner,'select public.save_product($1,$2) value',[store,{name:'5D1 final unit',category:'Parts',selling_price:100,minimum_selling_price:80,initial_quantity:1,purchase_cost:40,default_location_id:box}]);
   const method=(await db.query("select id from public.payment_methods where store_id=$1 and kind='Cash' and enabled limit 1",[store])).rows[0].id;
   const mobile={clientChannel:'mobile',deviceId:randomUUID(),idempotencyKey:randomUUID(),cartId:randomUUID(),lines:[{productId:product.id,quantity:1,unitPrice:100}],payments:[{methodId:method,amount:100}],cashReceived:100};
   const desktop={...mobile,clientChannel:'desktop',idempotencyKey:randomUUID(),cartId:randomUUID()};
   const clients=[new pg.Client({connectionString:url.toString()}),new pg.Client({connectionString:url.toString()})];await Promise.all(clients.map(c=>c.connect()));
   try{
    const post=async(c:pg.Client,input:object)=>{await c.query('begin');try{await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[owner]);await c.query('set local role authenticated');const result=(await c.query('select public.complete_sale($1,$2) value',[store,input])).rows[0].value;await c.query('commit');return result;}catch(e){await c.query('rollback');throw e;}};
    const results=await Promise.allSettled([post(clients[0],mobile),post(clients[1],desktop)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(String((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason),/stock/i);
    const winner=results[0].status==='fulfilled'?mobile:desktop,result=results.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<{id:string;invoice:string}>;
    await db.query('select app_private.register_offline_lease($1,$2,$3,$4)',[store,randomUUID(),owner,new Date(Date.now()+60000)]);
    const replay=await actor(owner,'select public.complete_sale($1,$2) value',[store,winner]);assert.equal(replay.id,result.value.id);assert.equal(replay.invoice,result.value.invoice);
    assert.equal((await db.query('select count(*)::int n from public.sale_items where product_id=$1',[product.id])).rows[0].n,1);
    assert.equal((await db.query("select count(*)::int n from public.payments where sale_id=$1 and kind='sale'",[result.value.id])).rows[0].n,1);
   }finally{await Promise.all(clients.map(c=>c.end()));}
  });
 }finally{await db.end();await admin.query('drop database '+name+' with (force)');await admin.end();}
});
