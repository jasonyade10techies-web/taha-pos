import {test,expect} from '@playwright/test';
test('partial receipt lookup lists candidates and supports phone, cashier, product, explicit choice and returnable quantities',async({page})=>{
  await page.goto('/pos');await expect(page.getByRole('button',{name:'Custom Service',exact:true})).toBeVisible();
  const fixture=await page.evaluate(async()=>{
    const path='/src/lib/repositories/index.ts',dbPath='/src/lib/local/database.ts';const r=(await import(path)).repositories,{demoDb}=await import(dbPath);
    const customer=await r.customers.save({id:crypto.randomUUID(),name:'Receipt Search Ali',type:'Individual',shopName:'',ownerName:'',collectingPerson:'',phone:'03005554444',address:'',notes:'',photo:'',creditEnabled:false,creditLimit:null,createdAt:new Date().toISOString()});
    const original=(await r.sales.list())[0];
    for(const [invoice,name] of [['TM-INV-000123','Hamza Test'],['TM-INV-000223','Ali Test']])await demoDb.sales.add({...original,id:crypto.randomUUID(),invoice,customerId:customer.id,customerName:customer.name,employeeId:crypto.randomUUID(),employeeName:name,status:'Paid',returned:{},lines:[{...original.lines[0],name:'Lookup Y20 Panel',quantity:2}],createdAt:new Date().toISOString()});
    const partial=await r.sales.lookup({search:'23'}),phone=await r.sales.lookup({search:'+92 300 5554444'}),cashier=await r.sales.lookup({search:'Hamza Test'}),product=await r.sales.lookup({search:'Lookup Y20'});
    return {partial:partial.rows.map((s:{invoice:string})=>s.invoice),phone:phone.total,cashier:cashier.total,product:product.total};
  });
  expect(fixture.partial).toEqual(expect.arrayContaining(['TM-INV-000123','TM-INV-000223']));expect(fixture.phone).toBe(2);expect(fixture.cashier).toBe(1);expect(fixture.product).toBe(2);
  await page.goto('/returns');await page.getByPlaceholder('Search invoice, customer, phone or product...').fill('23');
  await expect(page.getByRole('button',{name:/TM-INV-000123/})).toBeVisible();await expect(page.getByRole('button',{name:/TM-INV-000223/})).toBeVisible();
  await expect(page.getByRole('button',{name:'Original invoice item',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:/TM-INV-000123/}).click();
  await expect(page.getByRole('button',{name:'Original invoice item',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Original invoice item',exact:true}).click();await expect(page.getByRole('menuitem',{name:/2 returnable/})).toBeVisible();
});
