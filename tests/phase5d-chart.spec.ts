import {test,expect} from '@playwright/test';

test('zero activity is explicit and small-range chart axes have distinct readable values',async({page})=>{
 await page.goto('/dashboard');
 await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();
 await page.evaluate(async()=>{
  const fixture='/tests/fixtures/chart-render.ts';
  await (await import(fixture)).renderZeroChart();
 });
 await expect(page.locator('#axis-regression')).toContainText('No sales in this period');
 await expect(page.locator('#axis-regression svg[role=img]')).toHaveCount(0);
 await page.evaluate(async()=>{document.getElementById('axis-regression')?.remove();const path='/tests/fixtures/chart-render.ts';await(await import(path)).renderZeroChart(1);});
 const axis=page.locator('#axis-regression svg > g text');
 await expect(axis).toHaveCount(4);
 const labels=await axis.allTextContents();
 expect(new Set(labels).size,'zero-activity axis must not repeat 0k and 1k').toBe(4);
 await expect(axis.first()).toHaveText('0');
 await expect(axis.last()).toHaveText('1k');
});
