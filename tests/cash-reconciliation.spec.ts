import {test,expect,type Page} from '@playwright/test';
const id='20000000-0000-4000-8000-000000000001',invoice='TM-INV-O-'+id.toUpperCase();
async function fixture(page:Page,role='owner',permissions=['settings.manage','sync.reconcile_cash','sales.create'],denySettings=false,missingAmounts=false){
 let state='REVIEW';const decisions:unknown[]=[];
 const profile={id:'30000000-0000-4000-8000-000000000001',full_name:'Ahmed Khan',email:'owner@taha.test',phone:null,avatar_url:null,role,status:'active'};
 const context={profile,permissions,store:{id:'10000000-0000-4000-8000-000000000001',name:'Taha Mobiles',branch_name:'Main Branch'},terminal:false,counter_expires_at:null};
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(denySettings&&path.endsWith('/settings')){await route.fulfill({status:403,contentType:'application/json',body:'{"message":"Settings permission is separate"}'});return;}
  let data:unknown={};
  if(path.endsWith('/auth/refresh'))data={accessToken:'isolated-ui-token',context};
  else if(path.endsWith('/auth/context'))data=context;
  else if(path.endsWith('/settings'))data={id:'main',storeName:'Taha Mobiles',branch:'Main Branch',currency:'PKR',receiptFooter:'Thank you for choosing Taha Mobiles.'};
  else if(path.endsWith('/sync/exceptions'))data=[{id,invoice,seller_id:'original-seller',seller_name:'Hamza',terminal_id:'Main Counter',captured_at:'2026-10-15T08:00:00Z',tendered:missingAmounts?null:1200,change_given:missingAmounts?null:200,collected:missingAmounts?null:1000,state,reason:'Insufficient stock. Original cash receipt retained.',payload:{input:{lines:[]},receipt:{customerName:'Walk-in Customer',total:1000,lines:[{name:'Samsung Battery',quantity:1,unitPrice:1000}]}}}];
  else if(path.endsWith('/resolve')){decisions.push(route.request().postDataJSON());state='REFUNDED';data={id,state};}
  else if(path.endsWith('/health'))data={status:'ok'};
  else if(path.includes('/alerts'))data=[];
  else if(path.endsWith('/devices'))data=[];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('/settings?section=Synchronization');return decisions;
}
test('cash exception details retain original seller, PKR amounts and require a reason plus actual-refund confirmation',async({page})=>{
 const decisions=await fixture(page);await expect(page.getByRole('heading',{name:'Synchronization Exceptions',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Inspect',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Cash Reconciliation'});
 await expect(dialog.getByText('Hamza',{exact:true})).toBeVisible();await expect(dialog.getByText('PKR 1,200',{exact:true})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Retry Original Receipt'})).toBeDisabled();
 await dialog.getByLabel('Decision reason').fill('Customer received full cash back at the counter');await dialog.getByRole('button',{name:'Record Actual Refund'}).click();
 expect(decisions).toHaveLength(0);await expect(dialog.getByRole('alert')).toContainText('actually been returned');
 await dialog.getByRole('button',{name:'Confirm Cash Returned'}).click();await expect(dialog).not.toBeVisible();expect(decisions).toEqual([{action:'refund',reason:'Customer received full cash back at the counter',cashReturned:1000}]);
 await page.getByRole('button',{name:'Recent Resolutions'}).click();await expect(page.getByText('Resolved / Refunded',{exact:true})).toBeVisible();
});
test('authorized manager can reach synchronization without unrelated settings permissions',async({page})=>{
 await fixture(page,'manager',['sync.reconcile_cash','sales.create']);await expect(page.getByRole('heading',{name:'Synchronization Exceptions',exact:true})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'General',exact:true})).toHaveCount(0);
});
test('ordinary employee cannot open financial reconciliation even with an accidentally assigned reconciliation flag',async({page})=>{
 await fixture(page,'employee',['settings.manage','sync.reconcile_cash','sales.create']);await expect(page.getByText('Financial exceptions can be resolved by the owner or an authorized manager.')).toBeVisible();await expect(page.getByRole('button',{name:'Inspect',exact:true})).toHaveCount(0);
});
test('reconciliation permission alone does not require access to unrelated shop settings',async({page})=>{
 await fixture(page,'manager',['sync.reconcile_cash'],true);await expect(page.getByRole('heading',{name:'Synchronization Exceptions',exact:true})).toBeVisible();await page.getByRole('button',{name:'Inspect',exact:true}).click();await expect(page.getByRole('dialog',{name:'Cash Reconciliation'})).toBeVisible();
});

test('missing legacy cash facts remain unknown rather than appearing as zero or enabling a refund',async({page})=>{
 await fixture(page,'owner',undefined,false,true);
 await page.getByRole('button',{name:'Inspect',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Cash Reconciliation'});
 await expect(dialog.getByText('Amount needs review',{exact:true})).toHaveCount(3);
 await expect(dialog.getByText('PKR 0',{exact:true})).toHaveCount(0);
 await dialog.getByLabel('Decision reason').fill('Review original paper receipt and cash collection');
 await expect(dialog.getByRole('button',{name:'Record Actual Refund'})).toBeDisabled();
 await expect(page.getByText('1 receipt needs its cash amount reviewed.',{exact:true})).toBeVisible();
});
