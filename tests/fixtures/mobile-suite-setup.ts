import {chromium,expect,type FullConfig} from '@playwright/test';
export default async function setup(config:FullConfig){
 const browser=await chromium.launch();try{const page=await browser.newPage();await page.goto(String(config.projects[0].use.baseURL)+'/#/shop-connection');await expect(page.getByLabel('Shop Address',{exact:true})).toBeVisible({timeout:60000});}finally{await browser.close();}
}
