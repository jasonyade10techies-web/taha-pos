import {test,expect,type Page,type Browser} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {networkInterfaces} from 'node:os';
import sharp from '../server/node_modules/sharp/dist/index.mjs';
import jsQR from 'jsqr';

test.use({baseURL:'http://127.0.0.1:1423'});
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAO0lEQVR4nO3WuQkAMBADQWfqvyRVJldhcDBwueDQs2fN0zsE6kXhoglaVMW0aQ3OTGZRRYBXoWO+pusLMwAcavKGiNYAAAAASUVORK5CYII=','base64');
const password='Secure test password 2026!'; // Existing isolated physical-test account; never shipped in app assets.
const lanAddress=Object.values(networkInterfaces()).flat().find(address=>address?.family==='IPv4'&&!address.internal&&address.address.startsWith('192.168.'))?.address;
const shopUrl=process.env.TAHA_TEST_SHOP_URL||(lanAddress?`http://${lanAddress}:3001`:'http://127.0.0.1:3001');
async function phone(browser:Browser){
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 await page.exposeFunction('nativeHttp',async (r:{id:string;url:string;method:string;headers:Record<string,string>;body:string})=>{
  try{if(r.url.endsWith('/captures')&&await page.evaluate(()=>(window as unknown as {__offlineUploads?:boolean}).__offlineUploads))return {id:r.id,error:'SHOP_NOT_REACHABLE'};const response=await context.request.fetch(r.url,{method:r.method,headers:{...r.headers,Origin:'http://localhost'},data:r.body?Buffer.from(r.body,'base64'):undefined});return {id:r.id,status:response.status(),contentType:response.headers()['content-type'],body:(await response.body()).toString('base64')};}catch{return {id:r.id,error:'SHOP_NOT_REACHABLE'};}
 });
 await page.addInitScript(({deviceId})=>{
  const w=window as unknown as {TahaNative:unknown;nativeHttp:(r:unknown)=>Promise<unknown>;__tahaNativeResponse:(r:unknown)=>void};
  w.TahaNative={configure:()=>true,info:()=>JSON.stringify({deviceId,deviceName:'Physical Bridge Test Phone',version:'0.4C.3-test',network:'Wi-Fi'}),scanQr:()=>{},request:(raw:string)=>void w.nativeHttp(JSON.parse(raw)).then(response=>w.__tahaNativeResponse(response)),saveCapture:()=>true,readCaptures:()=> '[]',removeCapture:()=>{},clearSession:()=>{}};
 },{deviceId:randomUUID()});
 await page.goto('http://127.0.0.1:4175/#/mobile-camera');
 await page.getByLabel('Shop Address',{exact:true}).fill(shopUrl);
 await page.getByRole('button',{name:'Test Connection',exact:true}).click();
 await page.getByRole('button',{name:'Connect',exact:true}).click();
 await page.getByLabel('Email',{exact:true}).fill('owner@taha.test');await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign In',exact:true}).click();
 await expect(page.getByText('No Counter Paired',{exact:true})).toBeVisible();
 return {page,context};
}
async function signBridge(page:Page){
 await page.goto('/settings?section=Devices');
 await page.getByRole('button',{name:'Pair Staff Phone',exact:true}).click();
 const sign=page.getByRole('dialog',{name:'Sign In to Your Shop',exact:true});
 await expect(sign).toBeVisible();await sign.getByLabel('Email',{exact:true}).fill('owner@taha.test');await sign.getByLabel('Password',{exact:true}).fill(password);await sign.getByRole('button',{name:'Sign In',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Pair Staff Phone',exact:true});await expect(dialog.locator('.staff-pairing-code')).toContainText(/\d{3} \d{3}/);
 return dialog;
}
test('local business counter pairs a real API phone, delivers requests across pages and receives private photos',async({page,browser})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const pairing=await signBridge(page);
 await expect(page.locator('.workspace-footer')).toContainText('Demo Data');
 const terminal=await page.evaluate(()=>JSON.parse(localStorage.getItem('taha-device-bridge')!).state.terminalId);
 const code=(await pairing.locator('.staff-pairing-code').innerText()).replace(/\s/g,'');
 const mobile=await phone(browser);mobile.page.on('pageerror',e=>errors.push(e.message));
 await mobile.page.goto('http://127.0.0.1:4175/#/mobile/devices');
 await mobile.page.getByRole('button',{name:'Enter Pairing Code',exact:true}).click();
 await mobile.page.getByLabel('6-digit code',{exact:true}).fill(code);
 await expect(page.locator('.staff-phone-card')).toContainText('Physical Bridge Test Phone');
 await expect(page.locator('.staff-phone-card')).toContainText('Online');await expect(pairing).toHaveCount(0);
 await mobile.page.goto('http://127.0.0.1:4175/#/profile');
 await page.getByRole('button',{name:'Send Test Request',exact:true}).click();
 const testSheet=mobile.page.getByRole('dialog',{name:'Connection Test',exact:true});await expect(testSheet).toBeVisible();await testSheet.getByRole('button',{name:'Confirm',exact:true}).click();await expect(testSheet).toHaveCount(0);
 await page.goto('/pos');await page.getByRole('textbox',{name:'Search products'}).fill('890001');await page.getByRole('button',{name:'Add Samsung Galaxy A15 Charging Board',exact:true}).click();await mobile.page.goto('http://127.0.0.1:4175/#/mobile/display');await expect(mobile.page.locator('.staff-display-preview')).toContainText('Samsung Galaxy A15 Charging Board');await expect(mobile.page.locator('.staff-display-preview')).not.toContainText(/Minimum|Purchase Cost|Profit/);await mobile.page.screenshot({path:'docs/screenshots/phase4d/mobile-display-live-390.png'});
 await page.goto('/products');await page.getByRole('link',{name:'Add Product',exact:true}).click();
 await page.getByRole('button',{name:'Use Mobile',exact:true}).first().click();
 const photo=mobile.page.getByRole('dialog',{name:'Photo Request',exact:true});await expect(photo).toBeVisible();
 await photo.getByLabel('Choose requested photo').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:image});
 await expect(photo.getByText('Photos sent: 1',{exact:true})).toBeVisible();await photo.getByRole('button',{name:'Done',exact:true}).click();
 await expect(page.locator('.product-media-open img').first()).toHaveAttribute('src',/\/api\/v1\/media\//);
 await page.getByRole('button',{name:'Discard',exact:true}).first().click();await page.getByRole('button',{name:'Discard Changes',exact:true}).click();
 await page.reload();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('taha-device-bridge')!).state.terminalId)).toBe(terminal);
 await page.goto('/settings?section=Devices');await expect(page.locator('.staff-phone-card')).toContainText('Physical Bridge Test Phone');
 await mobile.page.reload();await expect(mobile.page.getByText('No Counter Paired',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Reset Pairing',exact:true}).click();await page.getByRole('dialog',{name:'Reset Staff Phone Pairing?',exact:true}).getByRole('button',{name:'Reset Pairing',exact:true}).click();await expect(page.getByText('No staff phone paired',{exact:true})).toBeVisible();
 expect(errors).toEqual([]);expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain(password);await mobile.context.close();
});

test('real pairing QR and Use Another Phone retain the request and insert a gallery photo from an unpaired authorized phone',async({page,browser})=>{
 const dialog=await signBridge(page),first=await phone(browser);
 const decode=async(element:ReturnType<Page['locator']>)=>{const {data,info}=await sharp(await element.screenshot()).ensureAlpha().raw().toBuffer({resolveWithObject:true});const result=jsQR(new Uint8ClampedArray(data),info.width,info.height);expect(result).toBeTruthy();return result!.data;};
 const pairingQr=await decode(dialog.getByRole('img',{name:'Staff phone pairing QR code',exact:true}));
 const parsed=new URL(pairingQr);expect(parsed.protocol).toBe('taha-mobile:');expect(parsed.hostname).toBe('pair');expect(parsed.searchParams.get('code')).toMatch(/^\d{6}$/);expect(parsed.searchParams.has('expires')).toBeTruthy();expect(pairingQr).not.toContain('eyJ');
 await first.page.evaluate(value=>window.dispatchEvent(new CustomEvent('taha-scan-result',{detail:{value,mode:'qr',format:'QR_CODE'}})),pairingQr);
 await expect(first.page.getByRole('heading',{name:'Connected Counter',exact:true})).toBeVisible();await expect(dialog).toHaveCount(0);
 const second=await phone(browser);
 await page.goto('/products/new');await page.getByRole('button',{name:'Use Mobile',exact:true}).first().click();
 await expect(first.page.getByRole('dialog',{name:'Photo Request',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Use Another Phone',exact:true}).click();
 const handoff=page.getByRole('dialog',{name:'Use Another Phone',exact:true});const requestQr=await decode(handoff.locator('.camera-request-qr svg'));
 expect(new URL(requestQr).hostname).toBe('camera');
 await second.page.evaluate(value=>window.dispatchEvent(new CustomEvent('taha-scan-result',{detail:{value,mode:'qr',format:'QR_CODE'}})),requestQr);
 const photo=second.page.getByRole('dialog',{name:'Photo Request',exact:true});await expect(photo).toBeVisible();await expect(second.page).not.toHaveURL(/claim=/);
 await photo.getByLabel('Choose requested photo').setInputFiles({name:'existing.png',mimeType:'image/png',buffer:image});
 await expect(photo.getByText('Photos sent: 1',{exact:true})).toBeVisible();await photo.getByRole('button',{name:'Done',exact:true}).click();await expect(page.locator('.product-media-open img')).toHaveAttribute('src',/\/api\/v1\/media\//);
 await expect(first.page.getByRole('dialog',{name:'Photo Request',exact:true})).toHaveCount(0);
 await page.goto('/settings?section=Devices');await page.getByRole('button',{name:'Reset Pairing',exact:true}).click();await page.getByRole('dialog',{name:'Reset Staff Phone Pairing?',exact:true}).getByRole('button',{name:'Reset Pairing',exact:true}).click();
 await first.context.close();await second.context.close();
});

test('the desktop LAN address starts without secure-context UUID errors',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));const lanCounter=new URL(shopUrl);lanCounter.port='1423';lanCounter.pathname='/dashboard';await page.goto(lanCounter.toString());await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>crypto.randomUUID())).toMatch(/^[a-f0-9-]{36}$/);expect(errors).toEqual([]);
});

test('4D multiple gallery photos, cancelled retake and private offline upload retry',async({page,browser})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const dialog=await signBridge(page),mobile=await phone(browser);
 const code=(await dialog.locator('.staff-pairing-code').innerText()).replace(/\s/g,'');await mobile.page.goto('http://127.0.0.1:4175/#/mobile/devices');await mobile.page.getByRole('button',{name:'Enter Pairing Code',exact:true}).click();await mobile.page.getByLabel('6-digit code',{exact:true}).fill(code);await expect(dialog).toHaveCount(0);
 await page.goto('/products/new');await page.getByRole('button',{name:'Use Mobile',exact:true}).first().click();const request=mobile.page.getByRole('dialog',{name:'Photo Request',exact:true});await expect(request).toBeVisible();
 await request.getByLabel('Choose requested photo').setInputFiles([{name:'one.png',mimeType:'image/png',buffer:image},{name:'two.png',mimeType:'image/png',buffer:image},{name:'three.png',mimeType:'image/png',buffer:image}]);
 await expect(request.getByText('Photos sent: 3',{exact:true})).toBeVisible();await expect(page.locator('.product-media-open img')).toHaveCount(3);
 await mobile.page.evaluate(()=>window.dispatchEvent(new Event('taha-photo-cancelled')));await expect(request.getByText('Photos sent: 3',{exact:true})).toBeVisible();await expect(request.getByRole('button',{name:'Take Another',exact:true})).toBeVisible();
 await request.getByRole('button',{name:'Done',exact:true}).click();await expect(request).toHaveCount(0);
 await page.getByRole('button',{name:'Use Mobile',exact:true}).first().click();await expect(request).toBeVisible();
 await mobile.page.evaluate(()=>Object.assign(window,{__offlineUploads:true}));
 await request.getByLabel('Choose requested photo').setInputFiles({name:'offline.png',mimeType:'image/png',buffer:image});await expect(request.getByRole('button',{name:'Send Now',exact:true})).toBeVisible();
 await mobile.page.evaluate(()=>Object.assign(window,{__offlineUploads:false}));await mobile.page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(request.getByText('Photos sent: 1',{exact:true})).toBeVisible();await expect(page.locator('.product-media-open img')).toHaveCount(4);
 await request.getByRole('button',{name:'Done',exact:true}).click();await page.goto('/settings?section=Devices');await page.getByRole('button',{name:'Reset Pairing',exact:true}).click();await page.getByRole('dialog',{name:'Reset Staff Phone Pairing?',exact:true}).getByRole('button',{name:'Reset Pairing',exact:true}).click();await mobile.context.close();expect(errors).toEqual([]);
});
