import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {migrate} from '../scripts/migrate';
import {serviceInput} from '../src/workflows/validation';
import type {Sale,ReturnRecord,RepairService} from '../../src/types/demo';

test('R2A counter operations preserve money, stock, reviewed payouts and template history',{timeout:300000},async t=>{
 const url=new URL(process.env.TAHA_TEST_POSTGRES_URL??'postgresql://taha_phase5c@127.0.0.1:55459/postgres');
 assert.equal(url.port,'55459');assert.equal(url.pathname,'/postgres');assert(['127.0.0.1','localhost'].includes(url.hostname));
 const admin=new pg.Client({connectionString:url.toString()}),name='taha_r2a_'+Date.now();await admin.connect();
 let db:pg.Client|undefined;
 try{
  await admin.query('create database '+name);url.pathname='/'+name;db=new pg.Client({connectionString:url.toString()});await db.connect();await migrate(db);
  const store='10000000-0000-4000-8000-000000000001',owner=randomUUID(),staff=randomUUID(),part=randomUUID(),creditPart=randomUUID(),customer=randomUUID();
  for(const [id,role] of [[owner,'owner'],[staff,'employee']]){
   await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@test.local']);
   await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,$2,'Isolated R2A',$3,'active')",[id,id+'@test.local',role]);
   await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)',[id,store]);
  }
  await db.query("insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key in ('sales.create','sales.view','returns.create')",[staff,store]);
  const rack=randomUUID(),shelf=randomUUID(),box=randomUUID(),quarantine=randomUUID();
  for(const [id,kind,parent,condition] of [[rack,'rack',null,'Available'],[shelf,'shelf',rack,'Available'],[box,'box',shelf,'Available'],[quarantine,'box',shelf,'Damaged']])await db.query('insert into public.locations(id,store_id,name,kind,parent_location_id,stock_condition) values($1,$2,$3,$4,$5,$6)',[id,store,kind,kind,parent,condition]);
  await db.query("insert into public.products(id,store_id,name,category,selling_price,minimum_selling_price) values($1,$2,'R2A Battery','Parts',2000,1700)",[part,store]);
  await db.query('insert into public.product_financials(product_id,store_id,purchase_cost) values($1,$2,900)',[part,store]);
  await db.query("insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,actor_profile_id) values($1,$2,$3,100,'RECEIVE',$4)",[store,part,box,owner]);
  await db.query("insert into public.products(id,store_id,name,category,selling_price,minimum_selling_price) values($1,$2,'R2A Credit Battery','Parts',3600,3000)",[creditPart,store]);
  await db.query("insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,actor_profile_id) values($1,$2,$3,20,'RECEIVE',$4)",[store,creditPart,box,owner]);
  const actor=async<T>(sql:string,args:unknown[]=[],who=owner):Promise<T>=>{
   await db!.query('begin');try{await db!.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[who]);await db!.query('set local role authenticated');const result=await db!.query(sql,args);await db!.query('commit');return result.rows[0]?.value as T;}catch(error){await db!.query('rollback');throw error;}
  };
  await actor('select public.save_customer($1,$2) value',[store,{id:customer,name:'Isolated R2A Credit',type:'Individual',creditEnabled:true,creditLimit:50000}]);
  const cash=(await db.query("select id from public.payment_methods where store_id=$1 and kind='Cash'",[store])).rows[0].id as string;
  const credit='credit'; // Established virtual method; it is not a payment-method row.
  const saleInput=(quantity=1,price=2000,method=cash)=>({cartId:randomUUID(),idempotencyKey:randomUUID(),customerId:method===credit?customer:null,lines:[{productId:part,quantity,unitPrice:price}],payments:[{methodId:method,amount:price*quantity}],cashReceived:method===cash?price*quantity:0});
  const complete=(input:unknown)=>actor<Sale>('select public.complete_sale($1,$2) value',[store,input]);
  const returned=(input:unknown)=>actor<ReturnRecord>('select public.return_sale_item($1,$2) value',[store,input]);
  const request=(sale:Sale,quantity=1,manual=2000,reduction=0)=>({idempotencyKey:randomUUID(),saleId:sale.id,productId:sale.lines[0].productId,quantity,destination:'Sellable Stock',locationId:box,reason:'Isolated counter return',receiptConfirmed:true,manualRefundConfirmed:true,refundMethodId:cash,expectedManualRefund:manual,expectedCreditReduction:reduction});
  const stock=async()=>Number((await db!.query('select sum(quantity) quantity from public.stock_movements where product_id=$1',[part])).rows[0].quantity);
  const balance=async()=>Number((await db!.query('select coalesce(sum(debit-credit),0) balance from public.credit_ledger_entries where customer_id=$1',[customer])).rows[0].balance);
  await t.test('partial/full returns and retries restore only eligible quantities and record one payout',async()=>{
   const before=await stock(),sale=await complete(saleInput(3)),input=request(sale),r=await returned(input);
   assert.equal(r.amount,2000);assert.equal(r.manualRefund,2000);assert.equal(r.creditReduction,0);assert.equal(await stock(),before-2);
   assert.deepEqual(await returned(input),r);assert.equal(await stock(),before-2);
   assert.equal(Number((await db!.query('select count(*) n from public.returns where sale_id=$1',[sale.id])).rows[0].n),1);
   await assert.rejects(returned(request(sale,3,6000)),/quantity|remaining|return/i);assert.equal(await stock(),before-2);
   await returned(request(sale,2,4000));assert.equal(await stock(),before);
   await assert.rejects(returned(request(sale)),/eligible|quantity|return|invalid/i);
  });
  await t.test('credit3600 less collection1000 is2600; return reduces this invoice and pays only1000',async()=>{
   const sale=await complete({...saleInput(1,3600,credit),lines:[{productId:creditPart,quantity:1,unitPrice:3600}]}),collection={idempotencyKey:randomUUID(),customerId:customer,amount:1000,methodId:cash,reference:'R2A partial',notes:''};
   await actor('select public.receive_credit_payment($1,$2) value',[store,collection]);assert.equal(await balance(),2600);
   await actor('select public.receive_credit_payment($1,$2) value',[store,collection]);assert.equal(await balance(),2600,'Collection retry must not duplicate credit');
   await complete(saleInput(1,2000,credit));assert.equal(await balance(),4600);
   const r=await returned(request(sale,1,1000,2600));assert.equal(r.creditReduction,2600);assert.equal(r.manualRefund,1000);assert.equal(await balance(),2000,'Other invoice remains outstanding');
  });
  await t.test('stale reviewed payout fails atomically rather than changing the confirmed amount',async()=>{
   const sale=await complete(saleInput()),before=await stock(),input=request(sale,1,0,2000);
   await assert.rejects(returned(input),/amounts changed/i);assert.equal(await stock(),before);
   assert.equal(Number((await db!.query('select count(*) n from public.returns where sale_id=$1',[sale.id])).rows[0].n),0);
  });
  await t.test('credit-only returns need no payout confirmation and leave other debts untouched',async()=>{
   const before=await balance(),sale=await complete(saleInput(1,2000,credit));
   const r=await returned({...request(sale,1,0,2000),manualRefundConfirmed:false,refundMethodId:''});
   assert.equal(r.manualRefund,0);assert.equal(r.creditReduction,2000);assert.equal(await balance(),before);
   assert.equal(Number((await db!.query("select count(*) n from public.payments where sale_id=$1 and kind='refund'",[sale.id])).rows[0].n),0);
  });
  await t.test('manual payout uses the explicitly selected bank method and retains its recorded name',async()=>{
   const method=randomUUID();await actor('select public.save_payment_method($1,$2) value',[store,{id:method,name:'R2A Bank',kind:'Digital',subtype:'Bank',title:'TAHA MOBILES',number:'0000123456',iban:'PK00TEST0000000000000001',enabled:true,requiresProof:false}]);
   const sale=await complete(saleInput());await returned({...request(sale),refundMethodId:method});
   const payment=(await db!.query("select method_id,method_name,amount,employee_id from public.payments where sale_id=$1 and kind='refund'",[sale.id])).rows[0];
   assert.equal(payment.method_id,method);assert.equal(payment.method_name,'R2A Bank');assert.equal(Number(payment.amount),2000);assert.equal(payment.employee_id,owner);
  });
  await t.test('damaged/quarantine quantity is visible in safe POS data and cannot become sellable stock',async()=>{
   const sale=await complete(saleInput()),before=await stock();await returned({...request(sale),destination:'Damaged',locationId:quarantine});
   const rows=await actor<{id:string;quantity:number;damaged_quantity:number}[]>('select public.get_pos_products($1) value',[store],staff),row=rows.find(p=>p.id===part)!;
   assert.equal(row.quantity,before);assert.equal(row.damaged_quantity,1);assert(!JSON.stringify(row).includes('purchase_cost'));
   assert.equal(await stock(),before);await assert.rejects(actor('select public.get_pos_products_before_r2a($1) value',[store],staff),/permission denied/i);
  });
  await t.test('linked service2000+500 retries once and template unlink preserves immutable old allocation',async()=>{
   const id=randomUUID(),template={id,name:'R2A linked battery replacement',category:'Repair',sellingPrice:2500,minimumSellingPrice:0,active:true,linkedProductId:part,defaultLaborCharge:500,pricingRule:'current-product-plus-labor'};
   await actor('select public.save_repair_service($1,$2) value',[store,serviceInput(template)]);
   const line={productId:'custom:'+randomUUID(),quantity:1,unitPrice:2500,customService:{name:'R2A linked battery replacement',description:'Replacement',sellingPrice:2500,minimumSellingPrice:0,material:{productId:part,quantity:1,allocations:[{locationId:box,quantity:1}],pricing:{sellingPrice:2000,minimumSellingPrice:1700,reviewedAt:new Date().toISOString()}}}};
   const input={...saleInput(),lines:[line],payments:[{methodId:cash,amount:2500}],cashReceived:2500},before=await stock(),sale=await complete(input);assert.equal(await stock(),before-1);assert.deepEqual(await complete(input),sale);assert.equal(await stock(),before-1);
   assert.equal(sale.lines[0].compound?.productRevenue,2000);assert.equal(sale.lines[0].compound?.laborRevenue,500);
   const {linkedProductId,defaultLaborCharge,pricingRule,...ordinary}=template;void linkedProductId;void defaultLaborCharge;void pricingRule;
   const preserved=await actor<RepairService>('select public.save_repair_service($1,$2) value',[store,serviceInput(ordinary)]);assert.equal(preserved.linkedProductId,part);
   const patch=serviceInput({...ordinary,linkedProductId:null});await actor('select public.save_repair_service($1,$2) value',[store,patch]);await actor('select public.save_repair_service($1,$2) value',[store,patch]);
   const stored=(await db!.query('select linked_product_id from public.repair_services where id=$1',[id])).rows[0];assert.equal(stored.linked_product_id,null);
   const after=await actor<Sale>('select public.get_sale($1,$2) value',[store,sale.id]);
   assert.deepEqual(after.lines,sale.lines);assert.equal(await stock(),before-1);
  });
 }finally{if(db)await db.end();await admin.query('drop database '+name+' with (force)');await admin.end();}
});
