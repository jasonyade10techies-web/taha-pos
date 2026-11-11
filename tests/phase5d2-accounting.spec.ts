import {test,expect} from '@playwright/test';
import type {SaleInput} from '../src/types/demo';

test('local compound checkout validates current part price, floors, allocations and product-only returns',async({page})=>{
 await page.goto('/pos');await expect(page.getByRole('button',{name:'Custom Service',exact:true})).toBeVisible();
 const result=await page.evaluate(async()=>{
  const path='/src/lib/repositories/index.ts',dbPath='/src/lib/local/database.ts';const r=(await import(path)).repositories,db=(await import(dbPath)).demoDb;
  const original=(await r.products.list())[0],box=(await r.locations.list()).find((l:{kind:string;archived:boolean})=>l.kind==='box'&&!l.archived);
  const p=await r.products.save({...original,id:undefined,internalCode:undefined,createdAt:undefined,name:'Compound accounting panel',category:'Parts',sellingPrice:2000,minimumSellingPrice:1500,initialQuantity:20,purchaseCost:1000,locationId:box.id});
  const cash=(await r.payments.list()).find((m:{kind:string;enabled:boolean})=>m.kind==='Cash'&&m.enabled);
  const body=(price=2500,quantity=1,review=true):SaleInput=>({idempotencyKey:crypto.randomUUID(),cartId:crypto.randomUUID(),customerId:'',coupon:'',lines:[{productId:'custom:'+crypto.randomUUID(),quantity,unitPrice:price,reason:price<2000?'Negotiated':'',customService:{name:'Panel installation',description:'',sellingPrice:price,minimumSellingPrice:0,material:{productId:p.id,quantity:1,allocations:[{locationId:box.id,quantity:1}],...(review?{pricing:{sellingPrice:2000,minimumSellingPrice:1500,reviewedAt:new Date().toISOString()}}:{})}}}],payments:[{methodId:cash.id,amount:price*quantity,reference:''}],cashReceived:price*quantity});
  const input=body(2500,2),sale=await r.sales.complete(input),retry=await r.sales.complete(input),stock=(await r.inventory.balances()).find((b:{productId:string;locationId:string})=>b.productId===p.id&&b.locationId===box.id).quantity;
  const candidate=await r.sales.lookup({id:sale.id}),floorLeaked=JSON.stringify(candidate).includes('productMinimumBasis');
  const ret=await r.sales.returnItem(sale.id,sale.lines[0].productId,1,'Part defective','Do Not Restore Stock',undefined,{idempotencyKey:crypto.randomUUID(),receiptConfirmed:true,manualRefundConfirmed:true});
  const blocked=async(input:unknown)=>{try{await r.sales.complete(input);return '';}catch(e){return String(e);}};
  const floor=await blocked(body(1400,1,false));await db.products.update(p.id,{sellingPrice:2100});const stale=await blocked(body());
  const template=await r.services.save({id:crypto.randomUUID(),code:'',name:'Linked reusable accounting',category:'Repairs',sellingPrice:2500,minimumSellingPrice:0,active:true,notes:'',linkedProductId:p.id,defaultLaborCharge:500,pricingRule:'current-product-plus-labor',description:'Panel installation'});
  const fresh=await r.services.get(template.id);
  const direct=body();direct.lines=[{productId:template.id,quantity:1,unitPrice:2500}];direct.payments[0].amount=2500;direct.cashReceived=2500;const templateGuard=await blocked(direct);
  return {allocation:sale.lines[0].compound,stock,retry:sale.id===retry.id,refund:ret.amount,floor,stale,template:fresh,templateGuard,floorLeaked};
 });
 expect(result.stock).toBe(18);expect(result.retry).toBe(true);expect(result.allocation).toMatchObject({productSellingBasis:4000,productRevenue:4000,laborRevenue:1000,productTotal:4000,laborTotal:1000});expect(result.refund).toBe(2000);expect(result.floor).toMatch(/minimum|approval/i);expect(result.stale).toMatch(/changed|review/i);expect(result.template.sellingPrice).toBe(2600);expect(result.template.createdBy).toBeTruthy();expect(result.templateGuard).toMatch(/template|review|linked/i);expect(result.floorLeaked).toBe(false);
});

test('local dashboard ranged and default charts exclude tax and retain labor after a product-only return',async({page})=>{
 await page.goto('/pos');await expect(page.getByRole('button',{name:'Custom Service',exact:true})).toBeVisible();
 const result=await page.evaluate(async()=>{
  const repoPath='/src/lib/repositories/index.ts',dbPath='/src/lib/local/database.ts',dashboardPath='/src/lib/dashboard-source.ts',rangePath='/src/lib/dashboard-range.ts';
  const r=(await import(repoPath)).repositories,db=(await import(dbPath)).demoDb,{localDashboard}=await import(dashboardPath),{presetRange}=await import(rangePath),range=presetRange('Today');
  const initial=(await r.products.list())[0],box=(await r.locations.list()).find((l:{kind:string;archived:boolean})=>l.kind==='box'&&!l.archived);
  const p=await r.products.save({...initial,id:undefined,internalCode:undefined,createdAt:undefined,name:'Chart tax panel',category:'Parts',sellingPrice:2000,minimumSellingPrice:1500,initialQuantity:10,purchaseCost:1000,locationId:box.id});
  await db.settings.update('main',{returnApproval:false,taxProfiles:[{id:'chart-tax',name:'Tax',rate:10,mode:'Exclusive',enabled:true,appliesTo:'Both'}],defaultTaxProfileId:'chart-tax'});
  const before=[await localDashboard(),await localDashboard(range)],cash=(await r.payments.list()).find((m:{kind:string;enabled:boolean})=>m.kind==='Cash'&&m.enabled);
  const sale=await r.sales.complete({idempotencyKey:crypto.randomUUID(),cartId:crypto.randomUUID(),customerId:'',coupon:'',lines:[{productId:'custom:'+crypto.randomUUID(),quantity:1,unitPrice:2500,customService:{name:'Chart panel fitting',description:'',sellingPrice:2500,minimumSellingPrice:0,material:{productId:p.id,quantity:1,allocations:[{locationId:box.id,quantity:1}],pricing:{sellingPrice:2000,minimumSellingPrice:1500,reviewedAt:new Date().toISOString()}}}}],payments:[{methodId:cash.id,amount:2750,reference:''}],cashReceived:2750});
  const returned=await r.sales.returnItem(sale.id,sale.lines[0].productId,1,'Part defective','Do Not Restore Stock',undefined,{receiptConfirmed:true,manualRefundConfirmed:true,idempotencyKey:crypto.randomUUID()});
  const after=[await localDashboard(),await localDashboard(range)];
  const sum=(chart:{sales:number;profit:number|null}[],field:'sales'|'profit')=>chart.reduce((n,b)=>n+(b[field]??0),0);
  return{refund:returned.amount,profitDelta:after.map((d,i)=>Math.round((sum(d.chart,'profit')-sum(before[i].chart,'profit'))*100)/100),salesDelta:after.map((d,i)=>Math.round((sum(d.chart,'sales')-sum(before[i].chart,'sales'))*100)/100)};
 });
 expect(result.refund).toBe(2200);expect(result.salesDelta).toEqual([550,550]);expect(result.profitDelta).toEqual([-500,-500]);
});

