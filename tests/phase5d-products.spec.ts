import {test,expect} from '@playwright/test';

test('a name-only product edit preserves an unknown purchase cost; zero must be explicitly entered',async({page})=>{
 await page.goto('/dashboard');await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();
 const fixture=await page.evaluate(async()=>{
  const modulePath='/src/lib/repositories/index.ts';const {repositories:r}=await import(modulePath);
  const base=(await r.products.list())[0];
  const product=await r.products.save({...base,id:undefined,name:'Phase5D unknown-cost battery',initialQuantity:0,purchaseCost:undefined});
  return {id:product.id,cost:await r.products.cost(product.id)};
 });
 expect(fixture.cost).toBeNull();const id=fixture.id;
 await page.goto(`/products/${id}/edit`);
 const cost=page.getByLabel('Purchase cost (PKR)',{exact:true});await expect(cost).toHaveValue('');
 await page.getByLabel('Product Name',{exact:true}).fill('Phase5D renamed unknown-cost battery');
 await page.getByRole('button',{name:'Save Product',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Phase5D renamed unknown-cost battery',exact:true})).toBeVisible();
 expect(await page.evaluate(async id=>{const modulePath='/src/lib/repositories/index.ts';return(await import(modulePath)).repositories.products.cost(id);},id)).toBeNull();
 await page.goto(`/products/${id}/edit`);await expect(cost).toHaveValue('');await cost.fill('0');
 await page.getByRole('button',{name:'Save Product',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Phase5D renamed unknown-cost battery',exact:true})).toBeVisible();
 expect(await page.evaluate(async id=>{const modulePath='/src/lib/repositories/index.ts';return(await import(modulePath)).repositories.products.cost(id);},id)).toBe(0);
});

test('new products do not prefill a free purchase cost and clearing a typed amount stays unknown',async({page})=>{
 await page.goto('/products/new');const cost=page.getByLabel('Purchase cost (PKR)',{exact:true});
 await expect(cost).toHaveValue('');await cost.fill('125');await cost.clear();await expect(cost).toHaveValue('');
});

test('partial bulk selection has a real mixed checkbox and selecting all works by keyboard',async({page})=>{
 await page.goto('/products');await page.getByRole('checkbox',{name:/^Select Samsung Galaxy A15 Charging Board$/}).check();
 const all=page.getByRole('checkbox',{name:'Select all filtered products',exact:true});
 await expect(all).toHaveJSProperty('indeterminate',true);await expect(all).toHaveAttribute('aria-checked','mixed');
 await all.focus();await page.keyboard.press('Space');await expect(all).toBeChecked();await expect(all).toHaveJSProperty('indeterminate',false);
});

test('custom select labels focus the visible control and Escape restores focus',async({page})=>{
 await page.goto('/settings?section=Tax');await page.getByRole('button',{name:'Create Tax Profile',exact:true}).click();
 const select=page.getByRole('button',{name:'Mode',exact:true});await page.locator('label').filter({hasText:/^Mode$/}).last().click();await expect(select.last()).toBeFocused();
 await page.keyboard.press('ArrowDown');await expect(page.getByRole('menu')).toBeVisible();await page.keyboard.press('Escape');await expect(select.last()).toBeFocused();
});
