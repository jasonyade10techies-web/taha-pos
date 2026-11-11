import {test,expect} from '@playwright/test';
test('approved desktop shell remains responsive and range tooltips match their actual points',async({page})=>{
 test.setTimeout(150_000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/dashboard');await expect(page.locator('.app-shell')).toBeVisible();
 const navigate=async(route:string)=>{
  if(route==='products/new')await page.getByRole('link',{name:'Add Product',exact:true}).click();
  else await page.getByRole('complementary',{name:'Main navigation'}).locator(`a[href="/${route}"]`).click();
 };
 for(const size of [{width:1366,height:768},{width:1440,height:900},{width:1920,height:1080},{width:1024,height:768}]){
  await page.setViewportSize(size);
  for(const route of ['dashboard','products','products/new','pos']){
   // This checks the installed application's navigation/layout, rather than
   // cold-reloading hundreds of Vite modules for each viewport/route pair.
   await navigate(route);await expect(page.locator('.app-shell')).toBeVisible();await expect(page.getByRole('heading',{level:1,name:route==='dashboard'?'Dashboard':route==='products'?'Products':route==='products/new'?'Add Product':'New Sale',exact:true})).toBeVisible();await expect(page.locator('.loading-skeleton')).toHaveCount(0);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
   await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});await page.screenshot({path:`docs/screenshots/phase4d/desktop-${route.replace('/','-')}-${size.width}.png`});
  }
 }
 await page.setViewportSize({width:1366,height:768});await navigate('dashboard');
 await page.getByRole('button',{name:'Today',exact:true}).click();await page.getByRole('menuitem',{name:'Last 30 days',exact:true}).click();
 await expect(page.getByRole('button',{name:'Last 30 days',exact:true})).toBeVisible();
 const point=page.locator('.chart-hit-areas button').first();await point.focus();const expected=(await point.getAttribute('aria-label'))!;const tooltip=page.getByRole('tooltip');await expect(tooltip).toBeVisible();expect(expected).toContain(await tooltip.locator('b').first().innerText());
 const box=await tooltip.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(1366);
 await page.getByRole('button',{name:'Last 30 days',exact:true}).click();await page.getByRole('menuitem',{name:'Custom Range…',exact:true}).click();
 const calendar=page.getByRole('dialog',{name:'Reporting Period',exact:true});await expect(calendar).toBeVisible();await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});await page.screenshot({path:'docs/screenshots/phase4d/dashboard-calendar-1366.png'});await calendar.getByRole('button',{name:'Apply',exact:true}).click();await expect(calendar).toHaveCount(0);
 await page.goto('/customer-display');await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});await page.screenshot({path:'docs/screenshots/phase4d/customer-display-1366.png'});
 expect(errors).toEqual([]);
});
