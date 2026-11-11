import {test,expect,type Page} from "@playwright/test";
import type {PGlite} from "@electric-sql/pglite";
import {testDatabase} from "../scripts/check-migrations.mjs";
import {seedTransactions,prepareCatalog,setActor,call,id,store} from "../scripts/test-transactions.mjs";
import {attachBackend,login,calls} from "./supabase-fixture";
let db:PGlite;
test.beforeEach(async()=>{db=await testDatabase();await seedTransactions(db);await prepareCatalog(db);calls.length=0;});
test.afterEach(async({browser})=>{for(const context of browser.contexts())await context.close();await db.close();});
async function start(page:Page,identity=id(1)){await attachBackend(page,db,identity);await login(page);await page.goto('/pos');await expect(page.getByRole('button',{name:'Add Samsung A15 Charging Board',exact:true})).toBeVisible();}
async function checkout(page:Page){await page.getByRole('button',{name:'Add Samsung A15 Charging Board',exact:true}).click();await page.getByRole('button',{name:/CHECKOUT/}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('button',{name:'Complete Sale',exact:true})).toBeEnabled();}
test('shared cash checkout, historical receipt QR, reprint safety, dashboard and server reports',async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);await checkout(page);
 await page.getByLabel('Cash received (PKR)',{exact:true}).fill('1200');await page.getByRole('button',{name:'Complete Sale',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Sale Complete',exact:true})).toBeVisible();await expect(page.locator('.receipt-preview')).toContainText('TM-INV-');await expect(page.locator('.receipt-preview')).toContainText('200');
 await expect(page.locator('.receipt-preview svg').filter({has:page.locator('title',{hasText:'Invoice reference QR'})})).toHaveCount(1);
 const before=calls.filter(c=>c.path.endsWith('/complete_sale')).length;await page.reload();await expect(page.locator('.receipt-preview')).toContainText('Samsung A15 Charging Board');expect(calls.filter(c=>c.path.endsWith('/complete_sale')).length).toBe(before);
 await page.goto('/dashboard');await expect(page.locator('.kpi-sales .kpi-value')).toContainText('1,000');await expect(page.locator('.kpi-profit')).toContainText('600');
 await page.goto('/reports');await expect(page.getByRole('heading',{name:'Reports',exact:true})).toBeVisible();await expect(page.locator('.stat-card').filter({hasText:'Net Sales'})).toContainText('1,000');
 await page.goto('/transactions');await expect(page.getByRole('row').filter({hasText:'TM-INV-'})).toHaveCount(1);expect(errors).toEqual([]);
 expect(await page.evaluate(()=>indexedDB.databases())).toEqual([]);
});
test('employee secure below-minimum approval and own receipt without protected financial queries',async({page})=>{
 test.setTimeout(90000);await db.exec('RESET ROLE');await db.query(`insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key in ('sales.create','pricing.discount_within_range')`,[id(2),store]);await setActor(db,id(1));await call(db,'set_employee_pin',id(1),store,'739182');
 await start(page,id(2));await page.getByRole('button',{name:'Add Samsung A15 Charging Board',exact:true}).click();await page.getByRole('button',{name:'Edit Samsung A15 Charging Board price',exact:true}).click();
 await page.getByLabel('New Price').fill('700');await expect(page.getByRole('dialog')).not.toContainText('123456');await page.getByLabel('Manager PIN',{exact:true}).fill('739182');await page.getByRole('button',{name:'Approve & Apply',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:/CHECKOUT/}).click();await page.getByRole('button',{name:'Complete Sale',exact:true}).click();await expect(page.getByRole('heading',{name:'Sale Complete',exact:true})).toBeVisible();await expect(page.locator('.receipt-preview')).toContainText('700');
 expect(calls.filter(c=>/financial|profit_summary/.test(c.path))).toEqual([]);await expect(page.locator('body')).not.toContainText(/purchase cost|profit margin/);
 await page.goto('/transactions');await expect(page.getByRole('heading',{name:'Access Denied',exact:true})).toBeVisible();
});
test('credit checkout, collection, safe account balance and sellable return through existing screens',async({page})=>{
 test.setTimeout(90000);await start(page);await checkout(page);await page.getByRole('button',{name:'Credit',exact:true}).click();await page.getByRole('dialog',{name:'Checkout',exact:true}).getByRole('button',{name:'Select sale customer'}).click();await page.locator('.customer-option').filter({hasText:'ABC Mobiles'}).click();await page.getByRole('button',{name:'Complete Sale',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Sale Complete',exact:true})).toBeVisible();await expect(page.locator('.receipt-preview')).toContainText('Outstanding');
 await page.goto('/credit/'+id(30));await expect(page.locator('.stat-card').filter({hasText:'Outstanding'})).toContainText('1,000');await page.getByRole('button',{name:'Receive Payment',exact:true}).click();await page.getByLabel('Amount (PKR)',{exact:true}).fill('200');await page.getByRole('dialog').getByRole('button',{name:'Receive Payment',exact:true}).click();await expect(page.getByRole('heading',{name:'Payment Receipt',exact:true})).toBeVisible();await page.keyboard.press('Escape');
 await expect(page.locator('.stat-card').filter({hasText:'Outstanding'})).toContainText('800');
 await page.goto('/transactions');await page.getByRole('link',{name:/TM-INV-/}).click();await page.getByRole('link',{name:'Return Items',exact:true}).click();
 await page.getByLabel('Original invoice item',{exact:true}).selectOption(id(20));await page.getByLabel('Return reason',{exact:true}).fill('Wrong model');await page.getByLabel('Original receipt checked',{exact:true}).check();await page.getByLabel('Manual refund paid (no automatic gateway refund)',{exact:true}).check();await page.getByRole('button',{name:'Process Return',exact:true}).click();
 await expect(page.getByText('Return recorded',{exact:true})).toBeVisible();await page.goto('/credit/'+id(30));await expect(page.locator('.stat-card').filter({hasText:'Outstanding'})).toContainText('0');
});
test('test out return and atomic conversion preserve stock and create only one invoice',async({page})=>{
 test.setTimeout(90000);await start(page);await page.goto('/out-for-test');await page.getByRole('button',{name:'Send for Test',exact:true}).click();await page.getByLabel('Customer / shop',{exact:true}).selectOption(id(30));await page.getByLabel('Product',{exact:true}).selectOption(id(20));await page.getByRole('button',{name:'Send Items',exact:true}).click();await expect(page.getByText('Items sent for testing',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Convert to Sale',exact:true}).click();await expect(page.locator('.cart-row')).toContainText('Samsung A15 Charging Board');await page.getByRole('button',{name:/CHECKOUT/}).click();await page.getByRole('button',{name:'Complete Sale',exact:true}).click();await expect(page.getByRole('heading',{name:'Sale Complete',exact:true})).toBeVisible();
 await page.goto('/out-for-test');await expect(page.getByRole('row').filter({hasText:'TM-TEST-'})).toContainText('CONVERTED TO SALE');
 await page.goto('/pos');await expect(page.locator('.product-card').filter({hasText:'Samsung A15 Charging Board'})).toContainText('Stock 9');
});
test('server rejects stale stock and leaves the existing cart available for correction',async({page})=>{
 await start(page);await checkout(page);await setActor(db,id(1));await call(db,'adjust_stock',store,id(20),id(12),10,0,'Physical Count',id(950));await page.getByRole('button',{name:'Complete Sale',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText(/not enough stock/);await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('.cart-row')).toHaveCount(1);
 await setActor(db,id(1));expect((await call<{total:number}>(db,'list_sales',store,{})).total).toBe(0);
});
