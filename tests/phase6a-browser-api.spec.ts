import {test,expect,type Page} from '@playwright/test';
async function login(page:Page,mobile=false){
 await page.goto('/login');await expect(page.getByLabel('Email',{exact:true})).toBeVisible({timeout:60000});
 // The isolated serve-test fixture owns these credentials; they have no cloud/live account.
 await page.getByLabel('Email',{exact:true}).fill('owner@taha.test');await page.getByLabel('Password',{exact:true}).fill('Secure test password 2026!');await page.getByRole('button',{name:'Sign In',exact:true}).click();
 await expect(page.getByRole('heading',{name:mobile?'Hello, Ahmed':'Dashboard',exact:true})).toBeVisible();
}
test('real isolated API shares created/received stock, accepts phone cash sale and survives both browser refreshes',async({browser})=>{
 const desktop=await browser.newContext({viewport:{width:1366,height:768}}),mobile=await browser.newContext({viewport:{width:390,height:844},permissions:['clipboard-read','clipboard-write']});
 try {
 const a=await desktop.newPage(),b=await mobile.newPage();await login(a);await login(b,true);
 const product=await a.evaluate(async()=>{
  const path='/src/lib/repositories/index.ts',r=(await import(path)).repositories;
  const settings=await r.settings.get();await r.settings.save({...settings,shopConfiguration:{...settings.shopConfiguration,operatingMode:'owner-only',setupCompleted:true,enabledFeatures:{...settings.shopConfiguration?.enabledFeatures,mobileSales:true}}});
  const base=(await r.products.list())[0],location=(await r.locations.list()).find((l:{kind:string;stockCondition?:string})=>l.kind==='box'&&l.stockCondition!=='Damaged');
  const saved=await r.products.save({...base,id:undefined,name:'Phase6A shared panel '+crypto.randomUUID().slice(0,8),sellingPrice:2000,minimumSellingPrice:1700,purchaseCost:900,initialQuantity:3,locationId:location.id,image:'',gallery:[]});
  return{id:saved.id,name:saved.name,location:location.id};
 });
 await b.goto('/mobile/products');const row=b.getByRole('button',{name:new RegExp(product.name)});await expect(row.locator('.staff-stock-count')).toHaveText('3in stock');
 await a.evaluate(async({id,location})=>{const path='/src/lib/repositories/index.ts',r=(await import(path)).repositories;await r.inventory.receive({id:crypto.randomUUID(),supplierId:'50000000-0000-4000-8000-000000000040',reference:'Phase6A isolated receive',date:'2026-10-29',status:'Draft',createdAt:new Date().toISOString(),lines:[{productId:id,quantity:2,locationId:location,condition:'Available',cost:900}]});},product);
 await expect(row.locator('.staff-stock-count')).toHaveText('5in stock',{timeout:12000});
 await a.goto('/products');const desktopRow=a.getByRole('row').filter({hasText:product.name});await expect(desktopRow.locator('.stock-availability strong')).toHaveText('5 available');
 await b.goto('/mobile/sales');await b.getByRole('textbox',{name:'Search sale products',exact:true}).fill(product.name);await b.getByRole('button',{name:'Add '+product.name,exact:true}).click();await b.getByRole('button',{name:/View Cart/}).click();
 await b.getByRole('button',{name:'Select sale customer',exact:true}).click();await b.getByRole('textbox',{name:'Search customers',exact:true}).fill('Ali Mobiles');await b.locator('.customer-option').filter({hasText:'Ali Mobiles'}).click();
 await b.getByRole('button',{name:'Choose Payment',exact:true}).click();await expect(b.getByLabel('Cash amount (PKR)',{exact:true})).toHaveValue('2000');await b.getByRole('button',{name:'Complete Sale',exact:true}).click();await expect(b.getByRole('heading',{name:'Sale Complete',exact:true})).toBeVisible();
 await b.getByRole('button',{name:'View Receipt',exact:true}).click();await expect(b.getByRole('region',{name:'Receipt'})).toContainText(product.name);
 await b.getByRole('button',{name:'Copy Receipt Link',exact:true}).click();const receiptLink=await b.evaluate(()=>navigator.clipboard.readText());expect(receiptLink).toMatch(/^https?:\/\//);
 const downloaded=b.waitForEvent('download');await b.getByRole('button',{name:'Share PDF',exact:true}).click();expect((await downloaded).suggestedFilename()).toMatch(/\.pdf$/);
 await expect(desktopRow.locator('.stock-availability strong')).toHaveText('4 available',{timeout:12000});
 await a.reload();await expect(a.getByRole('row').filter({hasText:product.name}).locator('.stock-availability strong')).toHaveText('4 available');
 await b.goto('/mobile/products');await b.reload();await expect(b.getByRole('button',{name:new RegExp(product.name)}).locator('.staff-stock-count')).toHaveText('4in stock');
 await b.screenshot({path:'.test-postgres/phase6a-20261029/frontend-real-api-mobile-stock.png'});
 await b.goto('/profile');await expect(b.getByRole('heading',{name:'Ahmed Khan',exact:true})).toBeVisible();
 await b.evaluate(()=>window.dispatchEvent(new Event('taha-mobile-logout')));await b.getByRole('button',{name:'Sign Out',exact:true}).click();await expect(b.getByRole('heading',{name:'Welcome to Taha Staff',exact:true})).toBeVisible();
 await a.reload();await expect(a.getByRole('heading',{name:'Products',exact:true})).toBeVisible();
 }finally{await desktop.close();await mobile.close();}
});
