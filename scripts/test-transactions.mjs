import assert from 'node:assert/strict';
import {testDatabase} from './check-migrations.mjs';
export const store='10000000-0000-4000-8000-000000000001';
export const id=n=>`50000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export async function seedTransactions(db) {
  await db.query(`insert into auth.users(id,email) values($1,'owner@invalid.test'),($2,'employee@invalid.test'),($3,'outsider@invalid.test');`,[id(1),id(2),id(3)]);
  await db.query(`insert into public.profiles(id,full_name,email,role,status) values($1,'Ahmed Khan','owner@invalid.test','owner','active'),($2,'Hamza','employee@invalid.test','employee','active');`,[id(1),id(2)]);
  await db.query(`insert into public.store_memberships(profile_id,store_id) values($1,$3),($2,$3);`,[id(1),id(2),store]);
}
export async function setActor(db,uid) {
  await db.exec('RESET ROLE');
  await db.query(`select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false),set_config('request.headers','{}',false)`,[uid]);
  await db.exec('SET ROLE authenticated');
}
export async function call(db,name,...args) { return (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result; }
export async function prepareCatalog(db) {
  await setActor(db,id(1));
  await call(db,'save_location',store,{id:id(10),name:'Rack 1',kind:'rack'});
  await call(db,'save_location',store,{id:id(11),name:'Shelf A',kind:'shelf',parent_id:id(10)});
  await call(db,'save_location',store,{id:id(12),name:'Box 01',kind:'box',parent_id:id(11)});
  await call(db,'save_location',store,{id:id(13),name:'Box 02',kind:'box',parent_id:id(11)});
  for (const n of [20,21]) await call(db,'save_product',store,{id:id(n),name:n===20?'Samsung A15 Charging Board':'iPhone 13 Battery',category:'Parts',selling_price:1000,minimum_selling_price:800,purchase_cost:400,initial_quantity:10,default_location_id:id(12)});
  await call(db,'save_product',store,{id:id(22),name:'Screen fitting',category:'Services',selling_price:500,minimum_selling_price:400,initial_quantity:0});
  await call(db,'save_customer',store,{id:id(30),name:'ABC Mobiles',type:'Shop / Business',creditLimit:10000});
  const methods=await call(db,'transaction_data',store,'methods',{});
  return {cash:methods.find(m=>m.kind==='Cash').id,customer:id(30),box:id(12),product:id(20)};
}
export function saleInput(cash,n,overrides={}) { return {idempotencyKey:id(n),cartId:id(n+10000),customerId:'',coupon:'',lines:[{productId:id(20),quantity:1,unitPrice:1000}],payments:[{methodId:cash,amount:1000}],cashReceived:1000,...overrides}; }
async function main() {
 const db=await testDatabase(); let checks=0;
 const check=async(label,fn)=>{await fn();checks++;console.log('PASS '+label);};
 const raw=async(sql,args=[])=>{await db.exec('RESET ROLE');return db.query(sql,args);};
 try {
  await seedTransactions(db); const {cash}=await prepareCatalog(db);
  const complete=input=>call(db,'complete_sale',store,input);
  let s;
  await check('atomic cash sale, snapshots, stock, money applied and change',async()=>{
   s=await complete(saleInput(cash,100,{cashReceived:1200}));assert.equal(s.total,1000);assert.equal(s.change,200);assert.equal(s.paid,1000);assert.equal(s.outstanding,0);assert.match(s.invoice,/^TM-INV-/);
   assert.equal((await call(db,'get_pos_products',store)).find(p=>p.id===id(20)).quantity,9);
   assert(!JSON.stringify(s).includes('purchase_cost'));assert.equal(s.lines[0].name,'Samsung A15 Charging Board');
  });
  await check('sale idempotency and payload conflict',async()=>{
   assert.equal((await complete(saleInput(cash,100,{cashReceived:1200}))).id,s.id);
   await assert.rejects(complete(saleInput(cash,100)),/reused/);
   assert.equal((await call(db,'get_pos_products',store)).find(p=>p.id===id(20)).quantity,9);
  });
  await check('last-line failure rolls back earlier line, sale, payment and audit',async()=>{
   await assert.rejects(complete(saleInput(cash,101,{lines:[{productId:id(20),quantity:1,unitPrice:1000},{productId:id(21),quantity:99,unitPrice:1000}],payments:[{methodId:cash,amount:100000}],cashReceived:100000})),/Insufficient stock/);
   assert.equal((await call(db,'get_pos_products',store)).find(p=>p.id===id(20)).quantity,9);
   assert.equal((await call(db,'list_sales',store,{})).total,1);
  });
  await check('exact payment sum and minimum floor enforced server-side',async()=>{
   await assert.rejects(complete(saleInput(cash,102,{payments:[{methodId:cash,amount:999}]})),/equal/);
   await assert.rejects(complete(saleInput(cash,103,{lines:[{productId:id(20),quantity:1,unitPrice:700,reason:'Bargaining'}],payments:[{methodId:cash,amount:700}]})),/approval/);
  });
  let credit;
  await check('split cash plus credit creates only cash payment and receivable debit',async()=>{
   credit=await complete(saleInput(cash,104,{customerId:id(30),payments:[{methodId:cash,amount:300},{methodId:'credit',amount:700}],cashReceived:500}));
   assert.equal(credit.paid,300);assert.equal(credit.change,200);assert.equal(credit.outstanding,700);assert.equal(credit.payments.length,1);
   assert.equal(Number(await call(db,'get_customer_balance',store,id(30))),700);
  });
  let collection;
  await check('old debt collection is idempotent and neither revenue nor stock',async()=>{
   const input={idempotencyKey:id(105),customerId:id(30),methodId:cash,amount:200,reference:'paid',notes:''};
   collection=await call(db,'receive_credit_payment',store,input);
   assert.equal((await call(db,'receive_credit_payment',store,input)).id,collection.id);
   assert.equal(Number(await call(db,'get_customer_balance',store,id(30))),500);
   const rep=await call(db,'get_transaction_report',store,'2000-01-01','2000-01-01');assert.equal(rep.summary.sales,0);
   assert.equal((await call(db,'list_sales',store,{})).total,2);
   assert.equal((await call(db,'get_pos_products',store)).find(p=>p.id===id(20)).quantity,8);
  });
  await check('payment reversal preserves original, adds reversal and reinstates debt',async()=>{
   const input={idempotencyKey:id(106),paymentId:collection.id,reason:'Incorrect collection'};
   const r=await call(db,'reverse_payment',store,input);assert.equal((await call(db,'reverse_payment',store,input)).id,r.id);
   assert.equal(Number(await call(db,'get_customer_balance',store,id(30))),700);
   const entries=await call(db,'transaction_data',store,'payments',{});assert.equal(entries.find(p=>p.id===collection.id).status,'Reversed');
  });
  await check('credit return decreases receivable and restores only chosen sellable box',async()=>{
   const input={idempotencyKey:id(107),saleId:credit.id,productId:id(20),quantity:1,reason:'Wrong part',destination:'Sellable Stock',locationId:id(13),receiptConfirmed:true,manualRefundConfirmed:true};
   const r=await call(db,'return_sale_item',store,input);assert.equal(r.creditReduction,700);assert.equal(r.manualRefund,300);
   assert.equal((await call(db,'return_sale_item',store,input)).id,r.id);assert.equal(Number(await call(db,'get_customer_balance',store,id(30))),0);
   await assert.rejects(call(db,'return_sale_item',store,{...input,idempotencyKey:id(108)}),/remaining/);
   assert.equal((await call(db,'get_pos_products',store)).find(p=>p.id===id(20)).quantity,9);
  });
  await check('void is append-only, retry-safe, restores stock and records manual refund',async()=>{
   const input={idempotencyKey:id(109),saleId:s.id,reason:'Cancelled',manualRefundConfirmed:true};
   const v=await call(db,'void_sale',store,input);assert.equal(v.status,'Voided');assert.equal((await call(db,'void_sale',store,input)).id,s.id);
   assert.equal((await call(db,'get_pos_products',store)).find(p=>p.id===id(20)).quantity,10);
  });
  let test;
  await check('test out holds stock without sale or credit and can return once',async()=>{
   const input={idempotencyKey:id(110),id:id(111),customerId:id(30),productId:id(20),locationId:id(12),quantity:1,takenDate:'2026-10-03',dueDate:'2026-10-05'};
   test=await call(db,'save_test_out',store,input);assert.equal((await call(db,'save_test_out',store,input)).id,test.id);
   assert.equal((await call(db,'get_pos_products',store)).find(p=>p.id===id(20)).quantity,9);
   const update={idempotencyKey:id(112),id:test.id,action:'return',locationId:id(13)};
   assert.equal((await call(db,'update_test_out',store,update)).status,'RETURNED');await call(db,'update_test_out',store,update);
   assert.equal((await call(db,'get_pos_products',store)).find(p=>p.id===id(20)).quantity,10);
  });
  await check('test conversion commits one invoice without double stock deduction',async()=>{
   test=await call(db,'save_test_out',store,{idempotencyKey:id(113),id:id(114),customerId:id(30),productId:id(20),locationId:id(12),quantity:1,takenDate:'2026-10-03',dueDate:'2026-10-05'});
   const input=saleInput(cash,115,{customerId:id(30),sourceTestId:test.id});const sale=await complete(input);assert.equal((await complete(input)).id,sale.id);
   assert.equal((await call(db,'get_pos_products',store)).find(p=>p.id===id(20)).quantity,9);
   assert.equal((await call(db,'transaction_data',store,'tests',{})).find(t=>t.id===test.id).status,'CONVERTED TO SALE');
  });
  await check('service sale does not move physical stock',async()=>{
   const input=saleInput(cash,116,{lines:[{productId:id(22),quantity:1,unitPrice:500}],payments:[{methodId:cash,amount:500}],cashReceived:500});
   const sale=await complete(input);assert.equal(sale.lines[0].service,true);assert.equal(sale.lines[0].stockAllocations.length,0);
  });
  await check('employee receives no costs, profit, credit ledger or unauthorized transactions',async()=>{
   await raw(`insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key='sales.create'`,[id(2),store]);
   await setActor(db,id(2));
   const pos=await call(db,'get_pos_products',store);assert(!JSON.stringify(pos).includes('purchase_cost'));
   assert.equal((await db.query('select * from public.sale_item_financials')).rows.length,0);
   await assert.rejects(call(db,'get_profit_summary',store),/permission|denied/i);
   await assert.rejects(call(db,'get_customer_balance',store,id(30)),/permission|denied/i);
   await assert.rejects(call(db,'transaction_data',store,'ledger',{}),/permission|denied/i);
   await assert.rejects(call(db,'list_sales',store,{}),/permission|denied/i);
   await assert.rejects(call(db,'get_sale',store,s.id),/denied/);
   await assert.rejects(complete(saleInput(cash,117,{customerId:id(30),payments:[{methodId:'credit',amount:1000}]})),/permission|denied/i);
  });
  await check('employee can sell at listed price and print only their own safe invoice',async()=>{
   const own=await complete(saleInput(cash,118));assert.equal((await call(db,'get_sale',store,own.id)).id,own.id);assert(!JSON.stringify(own).includes('purchase_cost'));
   await assert.rejects(db.query(`update public.sales set total=1 where id=$1`,[own.id]),/permission|denied/i);
  });
  await check('anonymous and inactive membership cannot write',async()=>{
   await setActor(db,id(3));await assert.rejects(complete(saleInput(cash,119)),/permission|denied/i);
   await db.exec('RESET ROLE; SET ROLE anon');await assert.rejects(complete(saleInput(cash,120)),/permission|denied/i);
  });
  await setActor(db,id(1));
  await check('server pagination and protected aggregate profit avoid raw cost leakage',async()=>{
   const p=await call(db,'list_sales',store,{limit:1,page:1});assert.equal(p.rows.length,1);assert(p.total>1);
   const d=new Date().toISOString().slice(0,10);const report=await call(db,'get_transaction_report',store,d,d);assert.equal(typeof report.profit,'number');assert(!JSON.stringify(report).includes('purchase_cost'));
   assert.equal((await call(db,'get_profit_summary',store)).available,true);
  });
  await check('employee report fields and new-store defaults are branch scoped',async()=>{
   const d=new Date().toISOString().slice(0,10);const employees=await call(db,'get_employee_report',store,d,d);
   assert(Array.isArray(employees));assert(employees.every(e=>Object.hasOwn(e,'discounted')&&Object.hasOwn(e,'overrides')&&Object.hasOwn(e,'cashDifference')));
   assert(!JSON.stringify(employees).includes('purchase_cost'));
   const secondStore=id(900);await raw(`insert into public.stores(id,name,branch_name) values($1,'Second Store','Second Branch')`,[secondStore]);
   const defaults=(await raw(`select (select count(*) from public.business_settings where store_id=$1)::int settings,(select count(*) from public.payment_methods where store_id=$1 and name='Cash')::int cash`,[secondStore])).rows[0];
   assert.equal(defaults.settings,1);assert.equal(defaults.cash,1);
  });
  await call(db,'set_employee_pin',id(1),store,'739182');
  await check('secure price approval is bound to cart, seller, product and price; consumes once',async()=>{
   await raw(`insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key='pricing.discount_within_range'`,[id(2),store]);await setActor(db,id(2));
   const payload={cartId:id(10130),productId:id(20),price:700,reason:'Trade customer'};
   const approval=await call(db,'approve_transaction',store,id(1),'739182','price',payload);assert.equal(approval.ok,true);
   const input=saleInput(cash,130,{cartId:payload.cartId,lines:[{productId:id(20),quantity:1,unitPrice:700,reason:payload.reason,approval:{token:approval.token}}],payments:[{methodId:cash,amount:700}],cashReceived:700});
   await assert.rejects(complete({...input,idempotencyKey:id(131),cartId:id(10131)}),/approval/);
   const sale=await complete(input);assert.equal(sale.total,700);assert.equal((await complete(input)).id,sale.id);
   await assert.rejects(complete({...input,idempotencyKey:id(132)}),/approval/);
   await assert.rejects(db.query('select * from private.transaction_approvals'),/permission/i);
  });
  await check('public demo PIN rejected and five failures persist a rate-limit lock',async()=>{
   for(let n=0;n<5;n++) assert.equal((await call(db,'approve_transaction',store,id(1),'123456','price',{cartId:id(140),productId:id(20),price:700,reason:'X'})).ok,false);
   const locked=await call(db,'approve_transaction',store,id(1),'739182','price',{});assert.equal(locked.ok,false);assert.match(locked.message,/15 minutes/);
   await raw(`update private.approval_attempts set failures=0,locked_until=null,window_start=now() where seller_id=$1`,[id(2)]);await setActor(db,id(1));
  });
  await check('digital payments require proof and authorized verification; no client verified bypass',async()=>{
   await call(db,'save_payment_method',store,{id:id(60),name:'JazzCash',kind:'Digital',subtype:'JazzCash',enabled:true,requiresProof:true});
   const input=saleInput(cash,141,{payments:[{methodId:id(60),amount:1000,verified:true}]});
   await assert.rejects(complete(input),/proof/);
   const proof=store+'/proof/'+id(61)+'.webp';await raw(`insert into storage.objects(bucket_id,name) values('business-assets',$1)`,[proof]);await setActor(db,id(2));
   await assert.rejects(complete({...input,payments:[{methodId:id(60),amount:1000,proof,verified:true}]}),/approval/);
   const payload={cartId:input.cartId,methodId:id(60),amount:1000,reference:'JC-141',proof};const approval=await call(db,'approve_transaction',store,id(1),'739182','payment',payload);
   const sale=await complete({...input,payments:[{methodId:id(60),amount:1000,reference:'JC-141',proof,approvalToken:approval.token}]});assert.equal(sale.payments[0].status,'Confirmed');assert.equal(sale.payments[0].verifiedBy,id(1));
   await setActor(db,id(1));
  });
  await check('coupon eligibility, usage, customer minimum and negotiated-price stacking floor',async()=>{
   const date=new Date().toISOString().slice(0,10);
   await call(db,'save_coupon',store,{id:id(70),code:'TAHA50',type:'Percentage',value:50,start:date,end:date,minimum:100,maxUses:1,perCustomerLimit:1,eligible:'All',targets:[],active:true});
   const input=saleInput(cash,150,{customerId:id(30),coupon:'TAHA50',lines:[{productId:id(20),quantity:1,unitPrice:900,reason:'Trade'}],payments:[{methodId:cash,amount:800}],cashReceived:800});
   const sale=await complete(input);assert.equal(sale.couponDiscount,100);assert.equal(sale.total,800);assert.equal(sale.lines[0].total,800);
   await assert.rejects(complete({...input,idempotencyKey:id(151)}),/usage limit/);
  });
  await check('damaged and finance-only returns never increase sellable stock',async()=>{
   for(const [n,destination] of [[160,'Damaged'],[162,'Do Not Restore Stock']]){
    const sale=await complete(saleInput(cash,n));const before=(await call(db,'get_pos_products',store)).find(p=>p.id===id(20)).quantity;
    const returned=await call(db,'return_sale_item',store,{idempotencyKey:id(n+1),saleId:sale.id,productId:id(20),quantity:1,reason:'Damaged',destination,receiptConfirmed:true,manualRefundConfirmed:true});assert.equal(returned.amount,1000);
    assert.equal((await call(db,'get_pos_products',store)).find(p=>p.id===id(20)).quantity,before);
   }
  });
  await check('credit limits are enforced; privileged overrides require an audited reason',async()=>{
   await call(db,'save_customer',store,{id:id(31),name:'Limit customer',type:'Individual',creditLimit:100});
   const input=saleInput(cash,170,{customerId:id(31),payments:[{methodId:'credit',amount:1000}]});
   await assert.rejects(complete(input),/override needs a reason/);
   const sale=await complete({...input,creditOverrideReason:'Owner approved trade order'});assert.equal(sale.outstanding,1000);
  });
  await check('used device has one unit, sells once, cannot be restocked or manually marked available',async()=>{
   const input={id:id(80),action:'purchase',seller:'Device Seller',brand:'Apple',model:'iPhone 13',storage:'128GB',color:'Black',purchasePrice:400,targetPrice:1000,minimumPrice:800,locationId:id(12),imei1:'123456789012345',photos:[]};
   const device=await call(db,'device_data',store,input);assert.equal(device.productId,id(80));assert.equal((await call(db,'device_data',store,input)).id,device.id);
   const sale=await complete(saleInput(cash,180,{lines:[{productId:id(80),quantity:1,unitPrice:1000}]}));assert.equal(sale.total,1000);
   await assert.rejects(complete(saleInput(cash,181,{lines:[{productId:id(80),quantity:1,unitPrice:1000}]})),/device is unavailable/);
   await assert.rejects(call(db,'device_data',store,{action:'status',id:device.id,status:'In Stock'}),/cannot be reset/);
   assert.equal((await call(db,'device_data',store,{action:'list'})).find(d=>d.id===device.id).status,'Sold');
  });
  await check('profit-only employee gets aggregate profit without purchase cost access',async()=>{
   await raw(`insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key in ('profit.view','reports.view')`,[id(2),store]);await setActor(db,id(2));
   const date=new Date().toISOString().slice(0,10);const report=await call(db,'get_transaction_report',store,date,date);assert.equal(typeof report.profit,'number');assert(!JSON.stringify(report).includes('purchase_cost'));assert.equal((await db.query('select * from public.sale_item_financials')).rows.length,0);
  });
  console.log(`${checks} transaction checks passed`);
 } finally {await db.close();}
}
if (process.argv[1]?.endsWith('test-transactions.mjs')) await main();


