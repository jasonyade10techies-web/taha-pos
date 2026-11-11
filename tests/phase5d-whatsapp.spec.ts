import {test,expect} from '@playwright/test';
test('virtual receipt uses normalized international WhatsApp number and encoded message',async({page})=>{
 await page.goto('/transactions');await expect(page.getByRole('heading',{name:'Transactions',exact:true})).toBeVisible();
 const id=await page.evaluate(async()=>{const p='/src/lib/local/database.ts';const {demoDb}=await import(p);const sale=(await demoDb.sales.toArray())[0];await demoDb.sales.update(sale.id,{receiptUrl:'https://receipt.test/invoice'});return sale.id;});await page.goto('/transactions/'+id);
 await page.getByRole('button',{name:'Virtual Receipt',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Send Virtual Receipt',exact:true});
 await dialog.getByRole('textbox',{name:/Customer phone/}).fill('0092 300 1234567');
 // Reserve/open an actual browser popup; intercept its final destination so no
 // request reaches WhatsApp. A null popup now correctly represents blocking.
 await page.context().route('https://wa.me/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<title>WhatsApp destination captured</title>'}));
 const opened=page.waitForEvent('popup');
 await dialog.getByRole('button',{name:'Open WhatsApp',exact:true}).click();
 const popup=await opened;await expect.poll(()=>popup.url()).toContain('https://wa.me/');const target=new URL(popup.url());expect(target.protocol).toBe('https:');expect(target.hostname).toBe('wa.me');expect(target.pathname).toBe('/923001234567');expect(target.searchParams.get('text')).toContain('Thank you for shopping at Taha Mobiles.');expect(target.searchParams.get('text')).toContain('https://receipt.test/invoice');await popup.close();
});
