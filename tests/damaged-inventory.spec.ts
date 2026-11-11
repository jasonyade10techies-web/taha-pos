import {test,expect,type Page} from '@playwright/test';
async function fixture(page:Page) {
  await page.goto('/pos');await expect(page.getByRole('button',{name:'Custom Service',exact:true})).toBeVisible();
  return page.evaluate(async()=>{
    const path='/src/lib/repositories/index.ts';const r=(await import(path)).repositories;
    const original=(await r.products.list())[0],box=(await r.locations.list()).find((l:{kind:string;archived:boolean})=>l.kind==='box'&&!l.archived);
    const product=await r.products.save({...original,id:undefined,internalCode:undefined,createdAt:undefined,name:'Vivo Y20 Panel',brand:'Vivo',compatibleModel:'Y20',category:'Parts',initialQuantity:36,purchaseCost:1200,locationId:box.id});
    const damage=await r.locations.save({id:crypto.randomUUID(),name:'Damaged 01',code:'',kind:'box',parentId:box.parentId,archived:false,stockCondition:'Damaged'});
    const second=await r.locations.save({id:crypto.randomUUID(),name:'Damaged 02',code:'',kind:'box',parentId:box.parentId,archived:false,stockCondition:'Damaged'});
    const cash=(await r.payments.list()).find((m:{kind:string;enabled:boolean})=>m.kind==='Cash'&&m.enabled);
    const settings=await r.settings.get();await r.settings.save({...settings,returnApproval:false});
    const sale=await r.sales.complete({cartId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),customerId:'',coupon:'',cashReceived:1750,payments:[{methodId:cash.id,amount:1750,reference:''}],lines:[{productId:'custom:'+crypto.randomUUID(),quantity:1,unitPrice:1750,customService:{name:'Y20 panel replacement',description:'',sellingPrice:1750,minimumSellingPrice:0,material:{productId:product.id,quantity:1,allocations:[{locationId:box.id,quantity:1}]}}}]});
    return {productId:product.id,available:box.id,damage:damage.id,second:second.id,saleId:sale.id,lineId:sale.lines[0].productId};
  });
}
test('damaged material return, transfer and recovery preserve physical stock with retry safety',async({page})=>{
  const f=await fixture(page);
  const result=await page.evaluate(async f=>{
    const path='/src/lib/repositories/index.ts';const r=(await import(path)).repositories;
    const key=crypto.randomUUID(),options={locationId:f.damage,idempotencyKey:key,manualRefundConfirmed:true,receiptConfirmed:true};
    const one=await r.sales.returnItem(f.saleId,f.lineId,1,'Panel damaged','Damaged',undefined,options);
    const two=await r.sales.returnItem(f.saleId,f.lineId,1,'Panel damaged','Damaged',undefined,options);
    const afterReturn=(await r.inventory.conditions(f.productId))[0],lot=(await r.inventory.damaged(f.productId)).find((l:{quantity:number;locationId:string})=>l.quantity===1&&l.locationId===f.damage);
    const transfer={idempotencyKey:crypto.randomUUID(),lotId:lot.id,sourceLocationId:f.damage,destinationId:f.second,quantity:1,expectedQuantity:1,action:'transfer',notes:'Move to inspection box'};
    await r.inventory.damageAction(transfer);await r.inventory.damageAction(transfer);
    const afterTransfer=(await r.inventory.conditions(f.productId))[0];
    await r.inventory.damageAction({idempotencyKey:crypto.randomUUID(),lotId:lot.id,sourceLocationId:f.second,destinationId:f.available,quantity:1,expectedQuantity:1,action:'recover',notes:'Inspected and repaired'});
    await r.inventory.damageAction({idempotencyKey:crypto.randomUUID(),lotId:lot.id,sourceLocationId:f.second,quantity:0,expectedQuantity:0,action:'note',notes:'Inspection evidence retained'});
    return {one:one.id,two:two.id,afterReturn,afterTransfer,afterRecovery:(await r.inventory.conditions(f.productId))[0],disposition:(await r.inventory.damaged(f.productId)).find((l:{locationId:string})=>l.locationId===f.second).disposition};
  },f);
  expect(result.one).toBe(result.two);
  expect(result.afterReturn).toMatchObject({available:35,damaged:1,outForTest:0,totalPhysical:36});
  expect(result.afterTransfer).toMatchObject({available:35,damaged:1,totalPhysical:36});
  expect(result.afterRecovery).toMatchObject({available:36,damaged:0,totalPhysical:36});
  expect(result.disposition).toBe('Recovered');
});
test('damaged write-off cannot be performed without adjustment permission or applied twice',async({page})=>{
  const f=await fixture(page);
  const result=await page.evaluate(async f=>{
    const path='/src/lib/repositories/index.ts',sessionPath='/src/stores/session-store.ts';const r=(await import(path)).repositories;
    await r.sales.returnItem(f.saleId,f.lineId,1,'Damaged','Damaged',undefined,{locationId:f.damage,idempotencyKey:crypto.randomUUID()});
    const lot=(await r.inventory.damaged(f.productId)).find((l:{quantity:number})=>l.quantity===1);
    const action={idempotencyKey:crypto.randomUUID(),lotId:lot.id,sourceLocationId:f.damage,quantity:1,expectedQuantity:1,action:'write-off',notes:'Inspection failed'};
    const {useSessionStore}=await import(sessionPath),old=useSessionStore.getState();
    useSessionStore.setState({profile:{...old.profile,role:'employee'},permissions:['inventory.view','inventory.transfer']});
    let denied=false;try{await r.inventory.damageAction(action);}catch{denied=true;}
    useSessionStore.setState({profile:old.profile,permissions:old.permissions});
    await r.inventory.damageAction(action);await r.inventory.damageAction(action);
    return {denied,after:(await r.inventory.conditions(f.productId))[0]};
  },f);
  expect(result.denied).toBe(true);expect(result.after).toMatchObject({available:35,damaged:0,totalPhysical:35});
});
test('sellable material return restores available units and quarantine rejects ordinary stock receiving',async({page})=>{
  const f=await fixture(page);
  const result=await page.evaluate(async f=>{
    const path='/src/lib/repositories/index.ts';const r=(await import(path)).repositories;
    await r.sales.returnItem(f.saleId,f.lineId,1,'Unused','Sellable Stock',undefined,{locationId:f.available,idempotencyKey:crypto.randomUUID()});
    let blocked=false;try{await r.inventory.adjust(f.productId,f.damage,0,1,'Unexpected incoming stock');}catch{blocked=true;}
    return {blocked,after:(await r.inventory.conditions(f.productId))[0]};
  },f);
  expect(result.blocked).toBe(true);expect(result.after).toMatchObject({available:36,damaged:0,totalPhysical:36});
});
test('product stock overview and actionable damaged history render without changing approved POS',async({page})=>{
  const f=await fixture(page);
  await page.evaluate(async f=>{const path='/src/lib/repositories/index.ts';const r=(await import(path)).repositories;await r.sales.returnItem(f.saleId,f.lineId,1,'Panel cracked','Damaged',undefined,{locationId:f.damage,idempotencyKey:crypto.randomUUID()});},f);
  await page.goto('/products/'+f.productId);
  await expect(page.locator('.stock-availability').first()).toBeVisible();
  await page.getByRole('button',{name:'1 damaged · View history',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Damaged Inventory',exact:true})).toContainText('Panel cracked');
  await page.getByRole('dialog',{name:'Damaged Inventory',exact:true}).getByRole('button',{name:'Damaged',exact:true}).click();
  await expect(page.getByRole('button',{name:'Action',exact:true})).toBeVisible();
});
