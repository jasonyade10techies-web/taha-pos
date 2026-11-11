import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

test('Products toolbar keeps every filter and action compact across desktop and mobile',async({page})=>{
  test.setTimeout(180000);mkdirSync('docs/screenshots/phase5d2-theme',{recursive:true});
  for(const size of [{width:1920,height:1080},{width:1440,height:900},{width:1366,height:768},{width:1024,height:768},{width:390,height:844},{width:412,height:915}]){
    await page.setViewportSize(size);await page.goto('/products');await expect(page.getByRole('heading',{name:'Products',exact:true})).toBeVisible();
    const toolbar=page.locator('.filter-bar');await expect(toolbar).toBeVisible();
    for(const label of ['Category','Brand','Model','Grade'])await expect(toolbar.getByRole('combobox',{name:label,exact:true})).toBeVisible();
    await expect(toolbar.getByRole('button',{name:'Stock status',exact:true})).toBeVisible();await expect(toolbar.getByRole('button',{name:'Export',exact:true})).toBeVisible();await expect(toolbar.getByRole('link',{name:'Import',exact:true})).toBeVisible();
    const box=(await toolbar.boundingBox())!;expect(box.height,'toolbar height at '+size.width).toBeLessThanOrEqual(size.width>=1366?100:size.width>=1024?150:285);
    const controlBoxes=await toolbar.locator(':scope > *').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};}));
    for(const control of controlBoxes){expect(control.left).toBeGreaterThanOrEqual(0);expect(control.right).toBeLessThanOrEqual(size.width+1);expect(control.width).toBeGreaterThan(55);}
    if(size.width===1920)expect(box.height,'one row when full desktop space fits').toBeLessThanOrEqual(48);
    const search=toolbar.getByPlaceholder('Name, model, local name or code…');await search.fill('Samsung');await expect(page.locator('.management-table tbody tr').first()).toContainText('Samsung');
    if(size.width===1920){const brand=toolbar.getByRole('combobox',{name:'Brand',exact:true});await brand.fill('Samsung');await page.getByRole('option',{name:'Samsung',exact:true}).click();await expect(brand).toHaveValue('Samsung');await expect(page.locator('.management-table tbody tr').first()).toContainText('Samsung');await toolbar.getByRole('button',{name:'Clear Brand',exact:true}).click();await expect(brand).toHaveValue('');}
    for(const value of ['light','dark']){await page.evaluate(async value=>{const p='/src/stores/ui-store.ts';(await import(p)).useUiStore.getState().setTheme(value);},value);await expect(page.locator('html')).toHaveClass(value==='dark'?/dark/:/^(?!.*\bdark\b)/);await page.screenshot({path:`docs/screenshots/phase5d2-theme/products-toolbar-${value}-${size.width}.png`});}
  }
});
