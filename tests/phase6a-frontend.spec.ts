import {test,expect,type Page,type BrowserContext} from '@playwright/test';
const context={profile:{id:'50000000-0000-4000-8000-000000000001',full_name:'Staging Owner',email:'fixture@taha.test',phone:null,avatar_url:null,role:'owner',status:'active'},permissions:[],store:{id:'10000000-0000-4000-8000-000000000001',name:'Taha Mobiles',branch_name:'Isolated frontend contract'},terminal:false,counter_expires_at:null};
const product={id:'60000000-0000-4000-8000-000000000001',name:'Shared revision panel',internal_code:'STAGE-1',selling_price:2000,minimum_selling_price:1500,quantity:4,primary_image_url:null,compatible_model:'Y20',quality_grade:'Original',aliases:[],category:'Parts',brand:'Vivo',variant:'',unit:'piece',state:'active',low_stock_level:2,created_at:'2026-10-29',updated_at:'2026-10-29'};
// An HTTP contract fixture isolates frontend polling/routing from separately verified DB/financial tests.
async function api(target:Page|BrowserContext,state:{quantity:number;revision:number;failed?:boolean;anonymous?:boolean;after?:string[]}) {
 await target.route('**/api/v1/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(path.endsWith('/auth/refresh')||path.endsWith('/auth/login'))return route.fulfill({status:state.anonymous?401:200,json:state.anonymous?{message:'Sign in required'}:{accessToken:'isolated-frontend-contract',context}});
  if(path.endsWith('/auth/session'))return route.fulfill({json:context});
  if(path.endsWith('/sync/changes')){
   const after=url.searchParams.get('after')||'0';state.after?.push(after);
   if(state.failed)return route.fulfill({status:503,json:{message:'Temporarily unavailable'}});
   return route.fulfill({json:{cursor:String(state.revision),hasMore:false,changes:Number(after)<state.revision?[{id:product.id,resource:'stock',revision:String(state.revision)}]:[]}});
  }
  let json:unknown=[];
  if(path.endsWith('/products/pos')||path.endsWith('/products'))json=[{...product,quantity:state.quantity}];
  else if(path.endsWith('/dashboard'))json={summary:{sales:0,cash:0,creditGiven:0,digital:0,returns:0},profit:0,chart:[],activity:[],credit:[]};
  else if(path.endsWith('/settings'))json={storeName:'Taha Mobiles',branch:'Isolated',shopConfiguration:{operatingMode:'owner-only',setupCompleted:true,enabledFeatures:{mobileSales:true}}};
  else if(path.endsWith('/health'))json={status:'ok',database:'connected'};
  await route.fulfill({json});
 });
}
test('same domain mobile landing opens dedicated browser workspace without LAN setup',async({page})=>{
 await page.setViewportSize({width:390,height:844});await api(page,{quantity:4,revision:1});await page.goto('/');
 await expect(page.locator('.staff-app')).toBeVisible({timeout:60000});await expect(page.getByRole('heading',{name:'Hello, Staging'})).toBeVisible();
 await expect(page.getByLabel('Shop Address',{exact:true})).toHaveCount(0);
 await expect(page.getByLabel('Connection status')).toContainText('Connected');
 await expect(page.getByRole('status',{name:'Deployment environment'})).toContainText('STAGING');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:'.test-postgres/phase6a-20261029/frontend-mobile-home.png'});
});
test('mobile login still requires authenticated API session',async({page})=>{
 await page.setViewportSize({width:390,height:844});await api(page,{quantity:4,revision:1,anonymous:true});await page.goto('/');
 await expect(page.getByRole('heading',{name:'Welcome to Taha Staff'})).toBeVisible();await expect(page.locator('.staff-app')).toHaveCount(0);
});
test('cloud mobile settings omit native-only gallery, LAN setup and unavailable offline access',async({page})=>{
 await page.setViewportSize({width:390,height:844});await api(page,{quantity:4,revision:1});await page.goto('/mobile/settings');
 await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();
 await expect(page.getByText('Save Captured Photos to Device Gallery',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Save Read-only Shop Information',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Shop Connection',exact:true})).toHaveCount(0);
 await page.goto('/mobile/shop-connection');await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();await expect(page.getByLabel('Shop Address',{exact:true})).toHaveCount(0);
});
test('cloud browser bridge uses HTTP polling without a WebSocket dependency',async({page})=>{
 const sockets:string[]=[],state={quantity:4,revision:1,after:[] as string[]};page.on('websocket',socket=>{if(new URL(socket.url()).pathname.startsWith('/socket.io'))sockets.push(socket.url());});
 await page.setViewportSize({width:390,height:844});await api(page,state);await page.goto('/mobile/products');await expect(page.getByRole('button',{name:/Shared revision panel/})).toBeVisible();await expect.poll(()=>state.after.length).toBeGreaterThan(0);
 expect(sockets).toEqual([]);
});
test('mobile product view catches durable revisions, retries outages and restores after refresh',async({page})=>{
 await page.setViewportSize({width:390,height:844});const state={quantity:4,revision:1,after:[] as string[],failed:false};await api(page,state);await page.goto('/mobile/products');
 const row=page.getByRole('button',{name:/Shared revision panel/});await expect(row).toContainText('4');
 await expect.poll(()=>state.after.length).toBeGreaterThan(0);
 state.quantity=3;state.revision=2;await expect(row.locator('.staff-stock-count')).toContainText('3',{timeout:12000});
 state.failed=true;state.quantity=2;state.revision=3;await page.evaluate(()=>window.dispatchEvent(new Event('taha-app-resume')));await expect(row.locator('.staff-stock-count')).toContainText('3');
 state.failed=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(row.locator('.staff-stock-count')).toContainText('2');
 await page.reload();await expect(page.getByRole('button',{name:/Shared revision panel/}).locator('.staff-stock-count')).toContainText('2');
 expect(state.after).toContain('2');
});
test('isolated desktop and mobile contexts obtain shared stock revisions without reload',async({browser})=>{
 const desktop=await browser.newContext({viewport:{width:1366,height:768}}),mobile=await browser.newContext({viewport:{width:390,height:844}}),state={quantity:4,revision:1};
 try{await api(desktop,state);await api(mobile,state);const a=await desktop.newPage(),b=await mobile.newPage();await a.goto('/products');await b.goto('/mobile/products');
 await expect(a.getByRole('heading',{name:'Products',exact:true})).toBeVisible();await expect(b.getByRole('button',{name:/Shared revision panel/})).toBeVisible();
 state.quantity=1;state.revision=2;
 await expect(b.getByRole('button',{name:/Shared revision panel/}).locator('.staff-stock-count')).toContainText('1',{timeout:12000});
 await expect(a.getByRole('row').filter({hasText:'Shared revision panel'}).locator('.stock-availability strong')).toHaveText('1 available');
 }finally{await desktop.close();await mobile.close();}
});
test('staging routes refresh to the authenticated desktop application and carry robots metadata',async({page})=>{
 await api(page,{quantity:4,revision:1,anonymous:true});
 for(const path of ['/dashboard','/pos','/products','/customers','/transactions','/returns','/settings','/products/60000000-0000-4000-8000-000000000001','/customers/customer-id','/transactions/invoice-id']){
  await page.goto(path);await expect(page.getByRole('heading',{name:'Welcome to your workspace',exact:true})).toBeVisible();
 }
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex, noarchive, nofollow');
});
