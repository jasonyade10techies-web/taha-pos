import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
mkdirSync('docs/screenshots/phase5c',{recursive:true});
test('light and dark semantic text meet AA contrast with a bundled consistent font',async({page})=>{
  await page.goto('/pos');await expect(page.getByRole('button',{name:'Custom Service',exact:true})).toBeVisible();
  for(const theme of ['light','dark']){
    const result=await page.evaluate(async theme=>{const path='/src/stores/ui-store.ts',appearancePath='/src/lib/appearance.ts';const {useUiStore}=await import(path),{contrast}=await import(appearancePath);useUiStore.getState().setTheme(theme);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const css=getComputedStyle(document.documentElement),pairs=[['--text','--surface'],['--secondary','--surface'],['--muted','--surface'],['--muted','--raised'],['--secondary','--soft'],['--danger','--danger-soft'],['--green','--green-soft'],['--amber','--amber-soft'],['--credit','--credit-soft']];return {font:getComputedStyle(document.body).fontFamily,ratios:pairs.map(([fg,bg])=>({fg,bg,ratio:contrast(css.getPropertyValue(fg).trim(),css.getPropertyValue(bg).trim())}))};},theme);
    expect(result.font).toContain('Manrope');for(const pair of result.ratios)expect(pair.ratio,theme+' '+pair.fg+' on '+pair.bg).toBeGreaterThanOrEqual(4.5);
    const focus=await page.evaluate(async()=>{const path='/src/lib/appearance.ts';const {contrast}=await import(path),css=getComputedStyle(document.documentElement),color=css.getPropertyValue('--focus-ring').trim();return {color,ratio:contrast(color,css.getPropertyValue('--surface').trim())};});
    expect(focus.color).toMatch(/^#[0-9a-f]{6}$/i);expect(focus.ratio).toBeGreaterThanOrEqual(3);
  }
});
for(const size of [{width:1920,height:1080},{width:1440,height:900},{width:1366,height:768},{width:1024,height:768},{width:390,height:844},{width:412,height:915}])test('Phase5C new workflows fit '+size.width+'×'+size.height,async({page})=>{
  test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.setViewportSize(size);
  await page.goto('/pos');await expect(page.getByRole('button',{name:'Custom Service',exact:true})).toBeVisible();
  const f=await page.evaluate(async()=>{const path='/src/lib/repositories/index.ts';const r=(await import(path)).repositories,customer=(await r.customers.list())[0],sale=(await r.sales.list())[0];await r.customers.addNote(customer.id,{idempotencyKey:crypto.randomUUID(),text:'Customer account follow-up with exact recorded timestamp.'});return {customerId:customer.id,customerName:customer.name,saleId:sale.id};});
  for(const theme of ['light','dark']){
    await page.evaluate(async theme=>{const path='/src/stores/ui-store.ts';(await import(path)).useUiStore.getState().setTheme(theme);},theme);
    for(const route of ['/products','/stock','/returns','/credit/new','/customers/'+f.customerId]){
      await page.goto(route);const expected=route==='/products'?'Products':route==='/stock'?'Stock':route==='/returns'?'Returns':route==='/credit/new'?'Add Credit Account':f.customerName;await expect(page.getByRole('heading',{level:1,name:expected,exact:true})).toBeVisible();await expect(page.locator('.loading-skeleton')).toHaveCount(0);await expect(page.locator('html')).toHaveClass(theme==='dark'?/dark/:/^(?!.*\bdark\b)/);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' rootoverflow').toBe(true);
      await expect(page.getByRole('heading',{name:'Unable to load this page',exact:true})).toHaveCount(0);
      if(route==='/customers/'+f.customerId){await expect(page.getByText('Customer account follow-up with exact recorded timestamp.',{exact:true})).toBeVisible();await page.screenshot({path:'docs/screenshots/phase5c/timeline-'+theme+'-'+size.width+'.png',fullPage:true});}
    }
    await page.goto('/pos');await page.getByRole('button',{name:'Custom Service',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Add Custom Service',exact:true});
    await dialog.getByLabel('Service name',{exact:true}).fill('iphone 13 battri change');await expect(dialog).toBeVisible();const rect=await dialog.boundingBox();expect(rect!.x).toBeGreaterThanOrEqual(0);expect(rect!.x+rect!.width).toBeLessThanOrEqual(size.width+1);expect(rect!.y+rect!.height).toBeLessThanOrEqual(size.height+1);
    await page.screenshot({path:'docs/screenshots/phase5c/service-'+theme+'-'+size.width+'.png'});await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
    await page.goto('/transactions/'+f.saleId);const paper=page.locator('.receipt-preview');await expect(paper).toBeVisible();expect(await paper.evaluate(element=>getComputedStyle(element).backgroundColor)).toBe('rgb(255, 255, 255)');
  }
  expect(errors).toEqual([]);
});
