import type {Page} from '@playwright/test';

/** Deterministic authenticated staff UI fixture. Real bridge transfers have a separate API integration suite. */
export async function staffUi(page:Page){
  const context={profile:{id:'50000000-0000-4000-8000-000000000001',full_name:'Ahmed Khan',email:'owner@taha.test',phone:null,avatar_url:null,role:'owner',status:'active'},permissions:[],store:{id:'10000000-0000-4000-8000-000000000001',name:'Taha Mobiles',branch_name:'Main Branch'},terminal:false,counter_expires_at:null};
  await page.route('**/api/v1/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let json:unknown=[];
    if(path.endsWith('/auth/refresh')||path.endsWith('/auth/login'))json={accessToken:'staff-ui-test-token',context};
    else if(path.endsWith('/auth/context'))json=context;
    else if(path.endsWith('/health'))json={status:'ok',database:'connected'};
    else if(path.endsWith('/dashboard'))json={summary:{sales:0,cash:0,creditGiven:0,digital:0,returns:0},profit:0,chart:[],activity:[],credit:[]};
    else if(path.endsWith('/mobile/my-shift'))json=null;
    else if(path.endsWith('/displays/preview'))json={online:false,snapshot:null};
    await route.fulfill({json});
  });
}
