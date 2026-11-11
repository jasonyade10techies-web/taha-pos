import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {migrate} from '../scripts/migrate';
import {serviceInput} from '../src/workflows/validation';

test('compound services preserve allocations, floor policy and classified returns', {timeout:300000}, async t=>{
 const url=new URL(process.env.TAHA_TEST_POSTGRES_URL??'postgresql://taha_phase5c@127.0.0.1:55459/postgres');
 assert.equal(url.port,'55459');assert.equal(url.pathname,'/postgres');assert(['127.0.0.1','localhost'].includes(url.hostname));
 const admin=new pg.Client({connectionString:url.toString()}),name='taha_compound_'+Date.now();let db:pg.Client|undefined;
 await admin.connect();
 try{
  await admin.query('create database '+name);url.pathname='/'+name;db=new pg.Client({connectionString:url.toString()});await db.connect();await migrate(db);
  const store='10000000-0000-4000-8000-000000000001',owner=randomUUID(),staff=randomUUID(),part=randomUUID();
  for(const [id,role] of [[owner,'owner'],[staff,'employee']]){
   await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@test.local']);
   await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,$2,'Compound Test',$3,'active')",[id,id+'@test.local',role]);
   await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)',[id,store]);
  }
  await db.query("insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key in ('sales.create','sales.view','services.create_custom','services.consume_inventory','returns.create','services.save_catalog','pricing.discount_within_range')",[staff,store]);
  await db.query("insert into public.products(id,store_id,name,category,selling_price,minimum_selling_price) values($1,$2,'Vivo Y20 Panel','Parts',2000,1500)",[part,store]);
  await db.query('insert into public.product_financials(product_id,store_id,purchase_cost) values($1,$2,1000)',[part,store]);
  const rack=randomUUID(),shelf=randomUUID(),box=randomUUID(),damage=randomUUID();
  for(const [id,kind,parent,condition]of[[rack,'rack',null,'Available'],[shelf,'shelf',rack,'Available'],[box,'box',shelf,'Available'],[damage,'box',shelf,'Damaged']])await db.query('insert into public.locations(id,store_id,name,kind,parent_location_id,stock_condition) values($1,$2,$3,$4,$5,$6)',[id,store,kind,kind,parent,condition]);
  await db.query("insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,actor_profile_id) values($1,$2,$3,100,'RECEIVE',$4)",[store,part,box,owner]);
  const cash=(await db.query("select id from public.payment_methods where store_id=$1 and kind='Cash'",[store])).rows[0].id;
  const actor=async(sql:string,args:unknown[]=[],who=owner)=>{
   await db!.query('begin');try{await db!.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[who]);await db!.query('set local role authenticated');const r=await db!.query(sql,args);await db!.query('commit');return r.rows[0]?.value;}catch(e){await db!.query('rollback');throw e;}
  };
  const line=(price=2500,quantity=1,review=true)=>({productId:'custom:'+randomUUID(),quantity,unitPrice:price,reason:price<2000?'Customer negotiated part price':'',customService:{name:'Vivo Y20 Panel screen replacement',description:'Screen replacement',sellingPrice:price,minimumSellingPrice:0,material:{productId:part,quantity:1,allocations:[{locationId:box,quantity:1}],...(review?{pricing:{sellingPrice:2000,minimumSellingPrice:1500,reviewedAt:new Date().toISOString()}}:{})}}});
  const body=(price=2500,quantity=1,review=true)=>{const total=price*quantity;return{idempotencyKey:randomUUID(),cartId:randomUUID(),lines:[line(price,quantity,review)],payments:[{methodId:cash,amount:total}],cashReceived:total};};
  const complete=(input:unknown,who=owner)=>actor('select public.complete_sale($1,$2) value',[store,input],who);
  const stock=async()=>Number((await db!.query('select sum(quantity) n from public.stock_movements where product_id=$1',[part])).rows[0].n);
  const returnBody=(sale:any,quantity=1,refundLabor=false)=>({idempotencyKey:randomUUID(),saleId:sale.id,productId:sale.lines[0].productId,quantity,destination:'Damaged',locationId:damage,receiptConfirmed:true,manualRefundConfirmed:true,reason:'Defective panel',...(refundLabor?{refundLabor:true}:{})});
  const returned=(input:unknown,who=owner)=>actor('select public.return_sale_item($1,$2) value',[store,input],who);
  await t.test('2500 charge allocates2000 product500 labor once and snapshots immutable private cost',async()=>{
   const input=body(),sale=await complete(input);assert.equal(sale.lines.length,1);assert.equal(await stock(),99);
   assert.deepEqual(sale.lines[0].compound,{productSellingBasis:2000,productMinimumBasis:1500,productRevenue:2000,laborRevenue:500,productDiscount:0,productTax:0,laborTax:0,productTotal:2000,laborTotal:500});
   assert.deepEqual(await complete(input),sale);assert.equal(await stock(),99);
   await assert.rejects(db!.query('update private.compound_service_allocations set product_revenue=1'),/append|immutable/i);
   await assert.rejects(actor('select * from private.compound_service_allocations',[],staff),/permission denied/i);
   const receipt=(await db!.query('select app_private.customer_receipt($1,$2) value',[store,sale.id])).rows[0].value;assert.equal(receipt.items.length,1);assert(!JSON.stringify(receipt).includes('purchase'));assert(!JSON.stringify(receipt).includes(part));
   const candidate=await actor('select public.return_receipt_lookup($1,$2) value',[store,{id:sale.id}],staff);assert.equal(candidate.rows[0].lines[0].compound.productTotal,2000);assert(!JSON.stringify(candidate).includes('productMinimumBasis'));
  });
  await t.test('same and lower retail charges never create negative labor and require a real discount reason',async()=>{
   for(const price of[2000,1800]){const sale=await complete(body(price));assert.equal(sale.lines[0].compound.productRevenue,price);assert.equal(sale.lines[0].compound.laborRevenue,0);assert.equal(sale.lines[0].compound.productDiscount,2000-price);}
   const input=body(1800);input.lines[0].reason='';await assert.rejects(complete(input),/discount|reason|bargaining/i);
  });
  await t.test('old linked input cannot bypass component floor and stale reviewed price/floor rejects atomically',async()=>{
   const before=await stock();await assert.rejects(complete(body(1400,1,false)),/minimum|approval/i);
   for(const field of['selling_price','minimum_selling_price']){await db!.query('update public.products set '+field+'='+ (field==='selling_price'?'2100':'1600')+' where id=$1',[part]);await assert.rejects(complete(body()),/price.*changed|review/i);await db!.query('update public.products set '+field+'='+ (field==='selling_price'?'2000':'1500')+' where id=$1',[part]);}
   assert.equal(await stock(),before);
  });
  await t.test('default partial/final return refunds only product, preserves labor and restores classified material once',async()=>{
   const sale=await complete(body(2500,3)),input=returnBody(sale);const first=await returned(input);assert.equal(first.amount,2000);assert.equal(first.refundLabor,false);assert.deepEqual(await returned(input),first);
   const last=await returned(returnBody(sale,2));assert.equal(last.amount,4000);
   assert.equal(Number((await db!.query('select sum(amount) n from public.payments where sale_id=$1 and kind=\'refund\'',[sale.id])).rows[0].n),6000);
   assert.equal(Number((await db!.query('select sum(quantity) n from private.condition_movements where action=\'return\' and lot_id in(select id from private.damaged_lots where sale_id=$1)',[sale.id])).rows[0].n),3);
  });
  await t.test('minimum override token binds original material identity and is consumed only once by both floor rules',async()=>{
   const input=body(1400);input.lines[0].customService.sellingPrice=2500;input.lines[0].customService.minimumSellingPrice=1500;
   const token=randomUUID(),wrong=randomUUID(),payload={cartId:input.cartId,productId:part,price:1400,reason:input.lines[0].reason};
   const approval=async(value:string,productId:string)=>db!.query("insert into private.transaction_approvals(store_id,seller_id,approver_id,purpose,payload_hash,token_hash,expires_at) values($1,$2,$2,'price',extensions.digest($3::jsonb::text,'sha256'),extensions.digest($4,'sha256'),now()+interval '5 minutes')",[store,owner,JSON.stringify({...payload,productId}),value]);
   await approval(wrong,input.lines[0].productId.substring(7));await assert.rejects(complete({...input,lines:[{...input.lines[0],approval:{token:wrong}}]}),/approval/i);
   await approval(token,part);const accepted={...input,lines:[{...input.lines[0],approval:{token}}]},sale=await complete(accepted);assert.equal(sale.lines[0].compound.productTotal,1400);
   assert.equal((await db!.query('select count(*)::int n from private.transaction_approvals where consumed_at is not null and token_hash=extensions.digest($1,\'sha256\')',[token])).rows[0].n,1);
   assert.deepEqual(await complete(accepted),sale);
  });
  await t.test('labor refund is explicit and separately authorized even when ordinary return approval is disabled',async()=>{
   await db!.query("update public.business_settings set settings=settings||'{\"returnApproval\":false}' where store_id=$1",[store]);
   const sale=await complete(body());await assert.rejects(returned(returnBody(sale,1,true),staff),/permission|Access denied/i);
   const refund=await returned(returnBody(sale,1,true));assert.equal(refund.amount,2500);assert.equal(refund.refundLabor,true);
  });
  await t.test('coupon and exclusive/inclusive tax allocations sum exactly and product refund includes its tax only',async()=>{
   const coupon=randomUUID();await db!.query("insert into public.coupons(id,store_id,code,type,value,minimum,starts_on,ends_on,eligible,active) values($1,$2,'COMPOUND','Fixed',100,0,current_date-1,current_date+1,'All',true)",[coupon,store]);
   for(const mode of['Exclusive','Inclusive']){
    await db!.query('update public.business_settings set settings=settings||$2::jsonb where store_id=$1',[store,JSON.stringify({taxProfiles:[{id:'compound-tax',name:'Tax',enabled:true,rate:10,mode,appliesTo:'Both'}],defaultTaxProfileId:'compound-tax'})]);
    const input={...body(),coupon:'COMPOUND'};input.payments[0].amount=mode==='Exclusive'?2640:2400;input.cashReceived=input.payments[0].amount;
    const sale=await complete(input),a=sale.lines[0].compound;assert.equal(a.productRevenue+a.laborRevenue,sale.total-sale.tax.amount);assert.equal(a.productTax+a.laborTax,sale.tax.amount);assert.equal(a.productTotal+a.laborTotal,sale.total);
    const refund=await returned(returnBody(sale));assert.equal(refund.amount,a.productTotal);
   }
   await db!.query("update public.business_settings set settings=settings||'{\"taxProfiles\":[],\"defaultTaxProfileId\":\"\"}' where store_id=$1",[store]);
   const input={...body(1500),coupon:'COMPOUND'};input.payments[0].amount=1400;input.cashReceived=1400;await assert.rejects(complete(input),/minimum|floor/i);
  });
  await t.test('partial credit returns conserve final pennies and leave only unpaid labor debt',async()=>{
   const customer=randomUUID();await db!.query("insert into public.customers(id,store_id,name,type) values($1,$2,'Compound credit customer','Individual')",[customer,store]);await db!.query('insert into public.credit_accounts(customer_id,store_id,enabled) values($1,$2,true)',[customer,store]);
   await db!.query('update public.products set selling_price=2000.03 where id=$1',[part]);
   await db!.query('update public.business_settings set settings=settings||$2::jsonb where store_id=$1',[store,JSON.stringify({creditEnabled:true,creditDueRequired:false,taxProfiles:[{id:'penny-tax',name:'Tax',enabled:true,rate:10,mode:'Exclusive',appliesTo:'Both'}],defaultTaxProfileId:'penny-tax'})]);
   const input={...body(2500.01,3),customerId:customer};input.lines[0].customService.material.pricing!.sellingPrice=2000.03;input.payments=[{methodId:cash,amount:1000},{methodId:'credit',amount:7250.03}];input.cashReceived=1000;
   const sale=await complete(input),first=await returned(returnBody(sale)),last=await returned(returnBody(sale,2));assert.equal(first.amount,2200.03);assert.equal(last.amount,4400.07);assert.equal(first.creditReduction+last.creditReduction,6600.10);assert.equal(first.manualRefund+last.manualRefund,0);
   const debt=Number((await db!.query('select sum(debit-credit) n from public.credit_ledger_entries where sale_id=$1',[sale.id])).rows[0].n);assert.equal(debt,649.93);
   assert.equal(first.taxAmount+last.taxAmount,sale.lines[0].compound.productTax);
   await db!.query('update public.products set selling_price=2000 where id=$1',[part]);await db!.query("update public.business_settings set settings=settings||'{\"taxProfiles\":[],\"defaultTaxProfileId\":\"\"}' where store_id=$1",[store]);
  });
  await t.test('linked template stores current-price rule and attribution; reopening uses current retail with review for archived part',async()=>{
   const template={id:randomUUID(),name:'Reusable Y20 replacement',category:'Repairs',sellingPrice:2500,minimumSellingPrice:0,active:true,notes:'',linkedProductId:part,defaultLaborCharge:500,pricingRule:'current-product-plus-labor',description:'screen replacement'};
   assert.equal(serviceInput(template).linkedProductId,part);
   const saved=await actor('select public.save_repair_service($1,$2) value',[store,template],staff);assert.equal(saved.linkedProductId,part);assert.equal(saved.createdBy,staff);
   const {linkedProductId:omittedLink,defaultLaborCharge:omittedLabor,pricingRule:omittedRule,description:omittedDescription,...legacyEdit}=template;
   void omittedLink;void omittedLabor;void omittedRule;void omittedDescription;
   const renamed=await actor('select public.save_repair_service($1,$2) value',[store,{...legacyEdit,name:'Renamed reusable Y20 replacement'}]);assert.equal(renamed.linkedProductId,part);assert.equal(renamed.defaultLaborCharge,500);assert.equal(renamed.description,'screen replacement');assert.equal(renamed.createdBy,staff);assert.equal(renamed.updatedBy,owner);
   const direct=body();direct.lines=[{...line(),productId:saved.id}];delete (direct.lines[0] as {customService?:unknown}).customService;
   await assert.rejects(complete(direct),/template|review|linked/i);
   await db!.query('update public.products set selling_price=2200 where id=$1',[part]);const fresh=await actor('select public.repair_service_data($1,$2) value',[store,saved.id]);assert.equal(fresh.sellingPrice,2700);assert.equal(fresh.defaultLaborCharge,500);
   await db!.query("update public.products set state='archived' where id=$1",[part]);const archived=await actor('select public.repair_service_data($1,$2) value',[store,saved.id]);assert.equal(archived.requiresReview,true);
   await assert.rejects(complete(body()),/active|component/i);await db!.query("update public.products set selling_price=2000,state='active' where id=$1",[part]);
  });
 }finally{await db?.end();await admin.query('drop database if exists '+name);await admin.end();}
});

