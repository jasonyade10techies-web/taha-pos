import {mkdirSync} from 'node:fs';
import {chromium,expect,type FullConfig} from '@playwright/test';

/** Compile the cold Vite module graph once, outside individual workflow tests.
 * A fresh context is then discarded so no demo/employee state reaches tests. */
export default async function setup(config:FullConfig){
 const browser=await chromium.launch();
 try{
  const context=await browser.newContext();const page=await context.newPage();
  const api=config.metadata.authFixture==='api';
  if(api)await page.route('**/api/v1/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{"message":"Isolated preflight"}'}));
  await page.goto(String(config.projects[0].use.baseURL)+(api?'/login':'/dashboard'),{waitUntil:'domcontentloaded'});
  try{await expect(page.getByRole('heading',{name:api?'Welcome to your workspace':'Dashboard',exact:true})).toBeVisible({timeout:60_000});}catch(error){mkdirSync('.test-postgres/phase5d1-20261021',{recursive:true});await page.screenshot({path:'.test-postgres/phase5d1-20261021/global-setup-failed.png'});console.error('Isolated fixture page:',await page.locator('body').innerText());throw error;}
  await context.close();
 }finally{await browser.close();}
}
