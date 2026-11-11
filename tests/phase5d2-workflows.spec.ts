import {test,expect} from '@playwright/test';
test('Returns offers receipts/history and seven receipts per page without losing selected invoice',async({page})=>{
 await page.goto('/returns');await expect(page.getByRole('heading',{name:'Returns',exact:true})).toBeVisible();
 await page.evaluate(async()=>{const path='/src/lib/local/database.ts',db=(await import(path)).demoDb,base=await db.sales.toCollection().first();await db.sales.bulkPut(Array.from({length:11},(_,i)=>({...base,id:crypto.randomUUID(),invoice:'5D2-RECEIPT-'+i,createdAt:new Date(Date.now()+i*1000).toISOString()})));});
 await page.reload();await page.getByRole('tab',{name:'Receipts',exact:true}).click();await expect(page.locator('.receipt-candidates>button')).toHaveCount(7);await page.locator('.receipt-candidates>button').first().click();const invoice=await page.locator('.return-selected-receipt strong').innerText();await page.getByRole('tab',{name:'Return History',exact:true}).click();await expect(page.locator('.receipt-lookup')).toBeHidden();await page.getByRole('tab',{name:'Receipts',exact:true}).click();await expect(page.locator('.return-selected-receipt strong')).toHaveText(invoice);
});
test('ordinary settings expose grouped navigation and discard unsaved field changes',async({page})=>{
 await page.goto('/settings?section=Store');await expect(page.getByRole('heading',{name:'Store',exact:true})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Settings sections'})).toContainText('Customers & Credit');
 const field=page.getByLabel('Store name',{exact:true}),original=await field.inputValue();await field.fill('Unsaved test identity');await expect(page.getByRole('status').filter({hasText:'Unsaved changes'})).toBeVisible();await page.getByRole('button',{name:'Discard Changes',exact:true}).click();await expect(field).toHaveValue(original);await expect(page.getByRole('status').filter({hasText:'All changes saved'})).toBeVisible();
});
