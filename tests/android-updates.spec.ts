import {test,expect} from '@playwright/test';
test('native updater shows version, verified progress and defers installation during checkout',async({page})=>{
 await page.addInitScript(()=>{window.TahaNative={info:()=>'{"version":"0.5R.3a-test"}',configure:()=>true,request:()=>{},updateStatus:()=>'{"state":"downloaded","currentVersionName":"0.5R.3a-test","currentVersionCode":12}',checkUpdates:()=>{},installUpdate:()=>{document.documentElement.dataset.installer='opened';}};});
 await page.goto('/login');await page.evaluate(async()=>{const fixture=await import(String('/tests/fixtures/update-harness.tsx')) as typeof import('./fixtures/update-harness');fixture.mount('updates');fixture.checkout(true);});
 await expect(page.getByRole('heading',{name:'Update verified and ready to install'})).toBeVisible();await expect(page.getByRole('button',{name:'Install Update',exact:true})).toBeDisabled();
 await page.evaluate(async()=>{(await import(String('/tests/fixtures/update-harness.tsx')) as typeof import('./fixtures/update-harness')).checkout(false);});await page.getByRole('button',{name:'Install Update',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-installer','opened');
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('taha-app-update',{detail:{state:'downloading',bytesDownloaded:25,totalBytes:100}})));await expect(page.getByRole('progressbar')).toHaveAttribute('value','25');
});
test('unconfigured and invalid update origin have a visible recovery action',async({page})=>{
 await page.addInitScript(()=>{window.TahaNative={info:()=>'{}',configure:()=>true,request:()=>{},updateStatus:()=>'{"state":"not-configured"}',checkUpdates:()=>{},configureUpdates:()=>false};});
 await page.goto('/login');await page.evaluate(async()=>{(await import(String('/tests/fixtures/update-harness.tsx')) as typeof import('./fixtures/update-harness')).mount('updates');});
 await expect(page.getByRole('heading',{name:'Set the download website'})).toBeVisible();await page.getByLabel('Website address').fill('http://bad.example');await page.getByRole('button',{name:'Save Address'}).click();await expect(page.getByRole('alert')).toContainText('HTTPS');
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('taha-app-update',{detail:{state:'error'}})));await expect(page.getByRole('heading',{name:/Could not complete/})).toBeVisible();await expect(page.getByRole('button',{name:'Check for Updates'})).toBeEnabled();
});
test('desktop download panel distinguishes download QR from pairing and handles missing release',async({page})=>{
 await page.route('**/downloads/taha-staff/releases/test.json',route=>route.fulfill({status:404,json:{message:'Unavailable'}}));await page.goto('/login');await page.evaluate(async()=>{(await import(String('/tests/fixtures/update-harness.tsx')) as typeof import('./fixtures/update-harness')).mount('downloads');});
 await expect(page.getByText('Download site not configured here')).toBeVisible();await page.getByRole('button',{name:'Install QR'}).click();await expect(page.getByText('Phone pairing is a separate step.')).toBeVisible();await expect(page.getByRole('link',{name:'Download App'})).toHaveAttribute('href','/downloads/taha-staff');
});
