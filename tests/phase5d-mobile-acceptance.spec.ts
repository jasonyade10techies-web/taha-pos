import {test,expect} from '@playwright/test';
import {staffUi} from './fixtures/staff-ui';
import {mkdirSync} from 'node:fs';
mkdirSync('docs/screenshots/phase5d',{recursive:true});
for(const size of [{width:390,height:844},{width:412,height:915}])test('dedicated staff screens fit '+size.width+' in both themes',async({page})=>{
 test.setTimeout(180000);await page.setViewportSize(size);await staffUi(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#/mobile');const address=page.getByLabel('Shop Address',{exact:true});await expect(address).toBeVisible();await address.fill('http://192.168.50.25:3001');await page.getByRole('button',{name:'Test Connection',exact:true}).click();await expect(page.getByRole('button',{name:'Connect',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Connect',exact:true}).click();await expect(page.getByRole('heading',{name:/Hello,/})).toBeVisible();
 expect(await page.locator('.staff-page').evaluate(element=>Array.from(element.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE&&n.textContent?.trim()==='0').map(n=>n.textContent))).toEqual([]);
 for(const theme of ['light','dark']){
  await page.evaluate(async theme=>{const p='/src/stores/ui-store.ts';(await import(p)).useUiStore.getState().setTheme(theme);},theme);
  for(const route of ['/mobile','/mobile/activity','/mobile/devices','/profile']){await page.goto('/#'+route);await expect(page.locator('.staff-app')).toBeVisible();await expect(page.locator('.staff-empty').filter({hasText:'Opening'})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route).toBe(true);await page.screenshot({path:`docs/screenshots/phase5d/staff-${route.split('/').at(-1)}-${theme}-${size.width}.png`});}
 }
 await page.goto('/#/mobile');await page.getByRole('button',{name:'Scan',exact:true}).click();const scanner=page.getByRole('dialog',{name:'Scan',exact:true});await expect(scanner).toBeVisible();await scanner.getByRole('button',{name:'QR',exact:true}).click();await expect(scanner.locator('.qr-target.qr')).toBeVisible();await page.screenshot({path:`docs/screenshots/phase5d/staff-scanner-${size.width}.png`});await page.keyboard.press('Escape');
 expect(errors).toEqual([]);
});

