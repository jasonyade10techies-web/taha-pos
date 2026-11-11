import {test,expect} from '@playwright/test';
test('virtual receipt uses normalized international WhatsApp number and encoded message',async({page})=>{
 await page.goto('/transactions');await expect(page.getByRole('heading',{name:'Transactions',exact:true})).toBeVisible();
 const id=await page.evaluate(async()=>{const p='/src/lib/local/database.ts';const {demoDb}=await import(p);const sale=(await demoDb.sales.toArray())[0];await demoDb.sales.update(sale.id,{receiptUrl:'https://receipt.test/invoice'});return sale.id;});await page.goto('/transactions/'+id);
 await page.getByRole('button',{name:'Virtual Receipt',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Send Virtual Receipt',exact:true});
 await dialog.getByRole('textbox',{name:/Customer phone/}).fill('0092 300 1234567');
 await page.evaluate(()=>{window.open=(url?:string|URL)=>{document.documentElement.dataset.whatsappTarget=String(url);return null;};});
 await dialog.getByRole('button',{name:'Open WhatsApp',exact:true}).click();
 const target=await page.locator('html').getAttribute('data-whatsapp-target');expect(new URL(target!).pathname).toBe('/923001234567');expect(new URL(target!).searchParams.get('text')).toContain('Thank you for shopping at Taha Mobiles.');
});
