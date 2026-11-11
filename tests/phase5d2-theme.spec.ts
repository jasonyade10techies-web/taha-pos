import {mkdirSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';
import {staffUi} from './fixtures/staff-ui';

async function theme(page:Page,value:'light'|'dark'){
  await page.evaluate(async value=>{const p='/src/stores/ui-store.ts';(await import(p)).useUiStore.getState().setTheme(value);},value);
  await expect(page.locator('html')).toHaveClass(value==='dark'?/dark/:/^(?!.*\bdark\b)/);
}

test('approved neutral palette and semantic text are applied to real components',async({page})=>{
  await page.goto('/pos');await expect(page.getByRole('button',{name:'Custom Service',exact:true})).toBeVisible();
  for(const value of ['light','dark'] as const){
    await theme(page,value);
    await page.evaluate(async()=>{const c='/src/stores/cart-store.ts',p='/src/lib/repositories/index.ts';const cart=(await import(c)).useCartStore.getState();cart.clear();cart.add((await (await import(p)).repositories.products.list())[0]);});
    await expect(page.getByRole('button',{name:'CHECKOUT',exact:true})).toBeEnabled();
    await expect(page.getByRole('button',{name:'CHECKOUT',exact:true})).toHaveCSS('background-color','rgb(242, 188, 45)');
    const result=await page.evaluate(async()=>{
      const p='/src/lib/appearance.ts',css=getComputedStyle(document.documentElement),{contrast}=await import(p);
      const names=['background','surface','raised','border','text','secondary','sidebar','gold','hover','focus-ring','disabled','disabled-text','selected','selected-text','warning','warning-soft','error','error-soft','success','success-soft','overlay','tooltip','tooltip-text','chart-sales','chart-profit'];
      const tokens=Object.fromEntries(names.map(name=>[name,css.getPropertyValue('--'+name).trim().toLowerCase()]));
      const pairs=[['text','surface'],['secondary','surface'],['secondary','raised'],['muted','raised'],['red','background'],['on-primary','gold'],['warning','warning-soft'],['error','error-soft'],['success','success-soft'],['tooltip-text','tooltip'],['selected-text','selected'],['disabled-text','disabled']];
      return {tokens,font:getComputedStyle(document.body).fontFamily,ratios:pairs.map(([fg,bg])=>({fg,bg,ratio:contrast(css.getPropertyValue('--'+fg).trim(),css.getPropertyValue('--'+bg).trim())})),focus:contrast(tokens['focus-ring'],tokens.surface),charts:['chart-sales','chart-profit'].map(key=>contrast(tokens[key],tokens.surface)),button:getComputedStyle(document.querySelector('.button-primary')!).backgroundColor};
    });
    const expected=value==='light'?{background:'#f3f3f3',surface:'#ffffff',raised:'#f8f8f8',border:'#e2e2e2',text:'#202020',secondary:'#626262',sidebar:'#202020'}:{background:'#181818',surface:'#262626',raised:'#303030',border:'#414141',text:'#f2f2f2',secondary:'#c5c5c5',sidebar:'#141414'};
    expect(result.tokens).toMatchObject({...expected,gold:'#f2bc2d'});
    for(const [name,color] of Object.entries(result.tokens))expect(color,name).not.toBe('');
    for(const pair of result.ratios)expect(pair.ratio,value+' '+pair.fg+' on '+pair.bg).toBeGreaterThanOrEqual(4.5);
    for(const ratio of result.charts)expect(ratio,'chart line on card').toBeGreaterThanOrEqual(3);
    await test.info().attach('computed-theme-'+value,{body:JSON.stringify(result,null,2),contentType:'application/json'});
    expect(result.focus).toBeGreaterThanOrEqual(3);expect(result.font).toContain('Manrope');expect(result.button).toBe('rgb(242, 188, 45)');
    const action=page.getByRole('button',{name:'Custom Service',exact:true});await action.focus();expect(await action.evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('solid');
    await page.evaluate(async()=>{const c='/src/stores/cart-store.ts';(await import(c)).useCartStore.getState().clear();});await expect(page.getByRole('button',{name:'CHECKOUT',exact:true})).toBeDisabled();
    await expect(page.getByRole('button',{name:'CHECKOUT',exact:true})).toHaveCSS('background-color',value==='light'?'rgb(237, 237, 237)':'rgb(48, 48, 48)');
    const stateColors=await page.evaluate(()=>{const root=getComputedStyle(document.documentElement),selected=getComputedStyle(document.querySelector('.sidebar-link.active')!),disabled=getComputedStyle(document.querySelector('.checkout-button')!);return {selected:selected.backgroundColor,expected:root.getPropertyValue('--sidebar-selected').trim(),disabled:disabled.backgroundColor,disabledText:disabled.color};});
    expect(stateColors.selected).toBe('rgb(57, 51, 31)');expect(stateColors.disabled).toBe(value==='light'?'rgb(237, 237, 237)':'rgb(48, 48, 48)');expect(stateColors.disabledText).toBe(value==='light'?'rgb(98, 98, 98)':'rgb(168, 168, 168)');
    await action.hover();await expect(action).toHaveCSS('background-color',value==='light'?'rgb(237, 237, 237)':'rgb(56, 56, 56)');
    await action.click();await expect(page.locator('.dialog-overlay')).toHaveCSS('background-color',value==='light'?'rgba(0, 0, 0, 0.6)':'rgba(0, 0, 0, 0.7)');await page.keyboard.press('Escape');
  }
});

test('80mm and A4 paper stay white with readable text and QR quiet zone in both themes',async({page})=>{
  mkdirSync('docs/screenshots/phase5d2-theme',{recursive:true});
  await page.goto('/transactions');await expect(page.locator('.management-table tbody tr').first()).toBeVisible();
  const id=await page.evaluate(async()=>{const p='/src/lib/repositories/index.ts';return (await (await import(p)).repositories.sales.list())[0].id;});
  await page.goto('/transactions/'+id);
  for(const value of ['light','dark'] as const){
    await theme(page,value);
    for(const format of ['Receipt','Full Invoice']){
      await page.getByRole('button',{name:format,exact:true}).click();const paper=page.locator('.paper-document');await expect(paper).toBeVisible();
      await expect(paper).toHaveCSS('background-color','rgb(255, 255, 255)');await expect(paper).toHaveCSS('color','rgb(32, 32, 32)');
      await expect(paper.locator('.paper-qr')).toHaveCSS('background-color','rgb(255, 255, 255)');
      await page.emulateMedia({media:'print'});await expect(paper).toHaveCSS('background-color','rgb(255, 255, 255)');await page.emulateMedia({media:'screen'});
      await paper.screenshot({path:`docs/screenshots/phase5d2-theme/paper-${format==='Receipt'?'80mm':'a4'}-${value}.png`});
    }
  }
});

test('previous default branding upgrades while saved custom colors remain deliberate',async({page})=>{
  await page.goto('/dashboard');await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();
  const result=await page.evaluate(async()=>{const p='/src/lib/appearance.ts';const {defaultAppearance,migrateAppearance}=await import(p);return {old:migrateAppearance({...defaultAppearance,primary:'#FFC107'}),custom:migrateAppearance({...defaultAppearance,primary:'#CCAA44'}),font:migrateAppearance({...defaultAppearance,primary:'#FFC107',font:'Inter'})};});
  expect(result.old.primary).toBe('#F2BC2D');expect(result.custom.primary).toBe('#CCAA44');expect(result.font.font).toBe('Inter');expect(result.font.primary).toBe('#FFC107');
});

for(const size of [{width:390,height:844},{width:412,height:915}])test('dedicated staff shell shares neutral surfaces and bundled font at '+size.width,async({page})=>{
  await page.setViewportSize(size);await staffUi(page);mkdirSync('docs/screenshots/phase5d2-theme',{recursive:true});
  await page.goto('/mobile');const address=page.getByLabel('Shop Address',{exact:true});
  if(await address.isVisible()){await address.fill('http://192.168.50.25:3001');await page.getByRole('button',{name:'Test Connection',exact:true}).click();await page.getByRole('button',{name:'Connect',exact:true}).click();}
  await expect(page.locator('.staff-app')).toBeVisible();
  for(const value of ['light','dark'] as const){
    await theme(page,value);
    for(const route of ['/mobile','/mobile/products','/profile']){
      await page.goto(route);const shell=page.locator('.staff-app');await expect(shell).toBeVisible();await expect(page.locator('.staff-empty').filter({hasText:'Opening'})).toHaveCount(0);
      await expect(shell).toHaveCSS('background-color',value==='light'?'rgb(243, 243, 243)':'rgb(24, 24, 24)');expect(await shell.evaluate(e=>getComputedStyle(e).fontFamily)).toContain('Manrope');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route).toBe(true);
      await page.screenshot({path:`docs/screenshots/phase5d2-theme/staff-${route.split('/').at(-1)}-${value}-${size.width}.png`});
    }
  }
});

for(const size of [{width:1920,height:1080},{width:1440,height:900},{width:1366,height:768},{width:1024,height:768},{width:390,height:844},{width:412,height:915}])test('same neutral pages remain readable at '+size.width+'×'+size.height,async({page})=>{
  test.setTimeout(180000);mkdirSync('docs/screenshots/phase5d2-theme',{recursive:true});await page.setViewportSize(size);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/dashboard');await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();
  const customer=await page.evaluate(async()=>{const p='/src/lib/repositories/index.ts';return (await (await import(p)).repositories.customers.list())[0];});
  for(const value of ['light','dark'] as const){
    await theme(page,value);
    for(const [name,route,heading] of [['dashboard','/dashboard','Dashboard'],['pos','/pos','New Sale'],['products','/products','Products'],['customer','/customers/'+customer.id,customer.name],['settings','/settings','Settings']]){
      await page.goto(route);await expect(page.getByRole('heading',{name:heading,exact:true,level:1})).toBeVisible();await expect(page.locator('.loading-skeleton')).toHaveCount(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' root overflow').toBe(true);
      const wrong=await page.evaluate(()=>Array.from(document.querySelectorAll('.panel,.product-card,.cart-panel,.app-header,.mobile-drawer')).filter(e=>{const b=getComputedStyle(e).backgroundColor.match(/[\d.]+/g)?.map(Number);return b&&b.length>=3&&b[3]!==0&&Math.max(...b.slice(0,3))-Math.min(...b.slice(0,3))>2;}).map(e=>({class:e.className,color:getComputedStyle(e).backgroundColor})));
      expect(wrong,route+' main surfaces remain neutral').toEqual([]);
      await page.screenshot({path:`docs/screenshots/phase5d2-theme/${name}-${value}-${size.width}.png`});
    }
  }
  expect(errors).toEqual([]);
});
