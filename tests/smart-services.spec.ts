import { test, expect, type Page } from '@playwright/test';
import type { PosProduct } from '../src/types/product';

const panel = {id:'y20-panel',name:'Vivo Y20 Panel',brand:'Vivo',compatibleModel:'Y20',category:'Parts',qualityGrade:'Original',color:'Black',aliases:['y20 display','y20 lcd'],quantity:36,internalCode:'TM-P-000999',sellingPrice:2000,minimumSellingPrice:1600,location:null,lowStockLevel:5} satisfies PosProduct;
test('recognition is exact for unique model/part, confirmed for typos and ambiguous for variants', async () => {
  const path = '../src/lib/smart-services';
  const {recognizeServiceMaterial} = await import(path);
  expect(recognizeServiceMaterial([panel], 'Y20 panel replacement').kind).toBe('exact');
  for (const query of ['y20 pnl','vivo y20 panl']) expect(recognizeServiceMaterial([panel],query).kind).toBe('suggested');
  expect(recognizeServiceMaterial([panel], 'y20 display change').kind).toBe('exact');
  expect(recognizeServiceMaterial([panel,{...panel,id:'variant',qualityGrade:'Grade A'}],'Y20 panel replacement').kind).toBe('ambiguous');
  expect(recognizeServiceMaterial([panel],'Y21 panel replacement').kind).toBe('none');
  expect(recognizeServiceMaterial([panel],'Software Installation').kind).toBe('none');
});

async function fixture(page: Page) {
  await page.goto('/pos');
  await expect(page.getByRole('button',{name:'Custom Service',exact:true})).toBeVisible();
  return page.evaluate(async () => {
    const path='/src/lib/repositories/index.ts';
    const {repositories:r}=await import(path);
    const cartPath='/src/stores/cart-store.ts';
    (await import(cartPath)).useCartStore.getState().clear();
    const original=(await r.products.list())[0], box=(await r.locations.list()).find((l:{kind:string;archived:boolean})=>l.kind==='box'&&!l.archived);
    const product=await r.products.save({...original,id:undefined,internalCode:undefined,createdAt:undefined,name:'Vivo Y20 Panel',brand:'Vivo',compatibleModel:'Y20',category:'Parts',qualityGrade:'Original',color:'Black',aliases:['y20 display'],initialQuantity:36,purchaseCost:1200,locationId:box.id});
    return {id:product.id,locationId:box.id};
  });
}
test('natural service links a panel, adds without changing stock, then consumes once on completion',async({page})=>{
  const product=await fixture(page);
  await page.getByRole('button',{name:'Custom Service',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Add Custom Service'});
  await dialog.getByLabel('Service name',{exact:true}).fill('Y20 panel replacement');
  await dialog.locator('.service-match-options button').filter({hasText:'Vivo Y20 Panel'}).click();
  await expect(dialog.locator('[data-mention-id]')).toHaveCount(1);
  await dialog.getByLabel('Charge (PKR)',{exact:true}).fill('1750');
  await dialog.getByLabel(/Save.*reusable service/).check();
  await expect(dialog.getByLabel(/Minimum/i)).toHaveCount(0);
  await dialog.getByRole('button',{name:'Add to Sale'}).click();
  await expect(dialog).toHaveCount(0);
  const result=await page.evaluate(async({id,locationId})=>{
    const repoPath='/src/lib/repositories/index.ts',cartPath='/src/stores/cart-store.ts';
    const {repositories:r}=await import(repoPath),{useCartStore}=await import(cartPath);
    const cart=useCartStore.getState(),before=(await r.inventory.balances()).find((b:{productId:string;locationId:string})=>b.productId===id&&b.locationId===locationId).quantity;
    const cash=(await r.payments.list()).find((p:{kind:string;enabled:boolean})=>p.kind==='Cash'&&p.enabled);
    const input={cartId:cart.cartId,idempotencyKey:cart.checkoutId,lines:cart.items.map((i:{product:PosProduct;quantity:number;unitPrice:number})=>({productId:i.product.id,customService:i.product.customService,quantity:i.quantity,unitPrice:i.unitPrice})),customerId:'',coupon:'',payments:[{methodId:cash.id,amount:1750,reference:''}],cashReceived:1750};
    const sale=await r.sales.complete(input),again=await r.sales.complete(input);
    return {before,after:(await r.inventory.balances()).find((b:{productId:string;locationId:string})=>b.productId===id&&b.locationId===locationId).quantity,saleId:sale.id,again:again.id,line:sale.lines[0],movements:(await r.inventory.movements()).filter((m:{productId:string;type:string})=>m.productId===id&&m.type==='REPAIR_USE')};
  },product);
  expect(result.before).toBe(36);expect(result.after).toBe(35);
  expect(result.again).toBe(result.saleId);expect(result.line.name).toBe('Y20 panel replacement');
  expect(result.movements).toHaveLength(1);expect(result.movements[0].quantity).toBe(-1);
  await page.getByRole('button',{name:'Custom Service',exact:true}).click();
  await page.getByRole('dialog').getByLabel('Service name',{exact:true}).fill('y20 pan');
  await expect(page.getByRole('button',{name:/Saved service: Y20 panel replacement/i})).toBeVisible();
});
test('removing an exact material link keeps it service-only while typing continues',async({page})=>{
  await fixture(page);
  await page.getByRole('button',{name:'Custom Service',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Service name',{exact:true}).fill('Y20 panel replacement');
  await dialog.locator('.service-match-options button').filter({hasText:'Vivo Y20 Panel'}).click();
  await expect(dialog.locator('[data-mention-id]')).toHaveCount(1);
  await dialog.getByRole('button',{name:'Remove product mention'}).click();
  await dialog.getByLabel('Service name',{exact:true}).fill('Y20 panel replacement labour only');
  await expect(dialog.locator('[data-mention-id]')).toHaveCount(0);
  await expect(dialog.getByText(/Service only/)).toBeVisible();
});

async function materialSale(page:Page, product:{id:string;locationId:string}) {
  return page.evaluate(async product=>{
    const repoPath='/src/lib/repositories/index.ts';const {repositories:r}=await import(repoPath);
    const cash=(await r.payments.list()).find((p:{kind:string;enabled:boolean})=>p.kind==='Cash'&&p.enabled);
    const customId='custom:'+crypto.randomUUID();
    return r.sales.complete({cartId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),lines:[{productId:customId,quantity:1,unitPrice:1750,customService:{name:'Y20 panel replacement',description:'',sellingPrice:1750,minimumSellingPrice:0,material:{productId:product.id,quantity:1,allocations:[{locationId:product.locationId,quantity:1}]}}}],customerId:'',coupon:'',payments:[{methodId:cash.id,amount:1750,reference:''}],cashReceived:1750});
  },product);
}
test('unknown material cost stays unknown in profit totals and chart points',async({page})=>{
  const product=await fixture(page);
  await page.evaluate(async id=>{const path='/src/lib/local/database.ts';await (await import(path)).demoDb.financials.delete(id);},product.id);
  await materialSale(page,product);
  const result=await page.evaluate(async()=>{
    const repoPath='/src/lib/repositories/index.ts',dashPath='/src/lib/dashboard-source.ts';
    const snapshot=await (await import(repoPath)).repositories.reports.snapshot();
    const dashboard=await (await import(dashPath)).localDashboard();
    return {profit:snapshot.profit,chartProfit:dashboard.chart.at(-1)?.profit};
  });
  expect(result.profit).toBeNull();expect(result.chartProfit).toBeNull();
});
test('linked-material void restores its physical component once',async({page})=>{
  const product=await fixture(page),sale=await materialSale(page,product);
  const result=await page.evaluate(async id=>{
    const path='/src/lib/repositories/index.ts';const r=(await import(path)).repositories;
    try {await r.sales.void(id);return {blocked:false,status:(await r.sales.get(id)).status};}
    catch {return {blocked:true,status:(await r.sales.get(id)).status};}
  },sale.id);
  expect(result).toEqual({blocked:false,status:'Voided'});
});
