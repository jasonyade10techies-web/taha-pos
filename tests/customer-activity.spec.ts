import {test,expect} from '@playwright/test';
test('customer timeline joins credit sale, partial collection, damaged return and immutable notes with exact balances',async({page})=>{
  await page.goto('/pos');await expect(page.getByRole('button',{name:'Custom Service',exact:true})).toBeVisible();
  const result=await page.evaluate(async()=>{
    const path='/src/lib/repositories/index.ts';const r=(await import(path)).repositories;
    const settings=await r.settings.get();await r.settings.save({...settings,returnApproval:false});
    const box=(await r.locations.list()).find((l:{kind:string;stockCondition?:string})=>l.kind==='box'&&l.stockCondition!=='Damaged');
    const damage=await r.locations.save({id:crypto.randomUUID(),code:'',kind:'box',parentId:box.parentId,name:'Timeline quarantine',archived:false,stockCondition:'Damaged'});
    const original=(await r.products.list())[0],product=await r.products.save({...original,id:undefined,name:'Timeline Y20 Panel',sellingPrice:1000,minimumSellingPrice:800,initialQuantity:4,locationId:box.id,purchaseCost:400});
    const customer=await r.customers.save({id:crypto.randomUUID(),name:'Timeline Ali Mobiles',type:'Shop / Business',shopName:'Ali Mobiles',ownerName:'Ali',phone:'03001234567',collectingPerson:'',address:'',notes:'',photo:'',creditEnabled:true,creditLimit:10000,createdAt:new Date().toISOString()});
    const methods=await r.payments.list(),credit=methods.find((m:{kind:string})=>m.kind==='Credit'),cash=methods.find((m:{kind:string})=>m.kind==='Cash');
    const sale=await r.sales.complete({idempotencyKey:crypto.randomUUID(),customerId:customer.id,coupon:'',cashReceived:0,payments:[{methodId:credit.id,amount:2000,reference:''}],lines:[{productId:product.id,quantity:2,unitPrice:1000}]});
    await r.credit.receive(customer.id,500,cash.id,'','Partial payment');
    await r.sales.returnItem(sale.id,product.id,1,'Cracked panel','Damaged',undefined,{locationId:damage.id,idempotencyKey:crypto.randomUUID()});
    const input={idempotencyKey:crypto.randomUUID(),text:'Customer will pay the remaining balance on Friday.'};
    const first=await r.customers.addNote(customer.id,input),second=await r.customers.addNote(customer.id,input);
    const all=await r.customers.timeline(customer.id,{order:'oldest',limit:100}),filtered=await r.customers.timeline(customer.id,{category:'Payments',limit:1});
    return {customerId:customer.id,invoice:sale.invoice,all,filtered,noteIds:[first.id,second.id]};
  });
  expect(result.all.outstanding).toBe(500);expect(result.all.rows.find((e:{type:string})=>e.type==='sale')).toMatchObject({amount:2000,reference:result.invoice});
  expect(result.all.rows.find((e:{type:string})=>e.type==='payment')).toMatchObject({amount:500});
  expect(result.all.rows.find((e:{type:string})=>e.type==='return')).toMatchObject({quantity:1,condition:'Damaged',amount:1000});
  expect(result.noteIds[0]).toBe(result.noteIds[1]);expect(result.all.rows.filter((e:{type:string})=>e.type==='note')).toHaveLength(1);
  expect(result.filtered.rows).toHaveLength(1);expect(result.filtered.rows[0].category).toBe('Payments');
  for(const event of result.all.rows)expect(Number.isFinite(Date.parse(event.createdAt))).toBe(true);
  await page.goto('/customers/'+result.customerId);await expect(page.getByRole('tab',{name:'Timeline',exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Customer contact summary'})).toContainText('WhatsApp');
  await expect(page.getByRole('region',{name:'Customer contact summary'})).toContainText('03001234567');
  await page.getByRole('tab',{name:'Timeline',exact:true}).click();
  await expect(page.getByText('Customer will pay the remaining balance on Friday.',{exact:true})).toBeVisible();
  await expect(page.getByText('Purchase',{exact:true})).toBeVisible();
  const permissions=await page.evaluate(async id=>{
    const path='/src/lib/repositories/index.ts',sessionPath='/src/stores/session-store.ts';const r=(await import(path)).repositories,{useSessionStore}=await import(sessionPath),old=useSessionStore.getState();
    useSessionStore.setState({profile:{...old.profile,role:'employee'},permissions:['customers.view']});
    const limited=await r.customers.timeline(id);let denied=false;try{await r.customers.addNote(id,{idempotencyKey:crypto.randomUUID(),text:'Unauthorized note'});}catch{denied=true;}
    useSessionStore.setState({profile:old.profile,permissions:old.permissions});
    return {types:limited.rows.map((e:{type:string})=>e.type),hasOutstanding:'outstanding'in limited,denied};
  },result.customerId);
  expect(permissions).toEqual({types:['note'],hasOutstanding:false,denied:true});
});
