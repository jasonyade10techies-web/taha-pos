import {test,expect} from "@playwright/test";
import {staffUi} from './fixtures/staff-ui';
test("mobile drawer is independent of sidebar collapse, searchable and dismissible",async({page})=>{
  await staffUi(page);await page.setViewportSize({width:390,height:844});await page.goto("/profile");
  await page.getByRole("button",{name:"Open navigation",exact:true}).click();
  const menu=page.getByRole("dialog",{name:"Staff navigation"});await expect(menu).toBeVisible();
  await menu.getByRole("textbox",{name:"Find a module"}).fill("product");await expect(menu.getByRole("link",{name:"Products",exact:true})).toBeVisible();await expect(menu.getByRole("link",{name:"Inventory",exact:true})).toHaveCount(0);
  await expect(menu.getByRole('link',{name:'New Sale',exact:true})).toHaveCount(0);await menu.getByRole("link",{name:"Products",exact:true}).click();await expect(menu).not.toBeVisible();await expect(page).toHaveURL(/mobile\/products/);
  await page.getByRole("button",{name:"Open navigation"}).click();await expect(menu).toBeVisible();await page.keyboard.press("Escape");await expect(menu).not.toBeVisible();
});
test("phone camera screen has a compact request queue and app navigation",async({page})=>{
  await staffUi(page);await page.setViewportSize({width:390,height:844});await page.goto("/mobile-camera");await expect(page.getByRole("heading",{name:"Activity",exact:true})).toBeVisible();
  await expect(page.getByRole("navigation",{name:"Mobile navigation",exact:true})).toBeVisible();await expect(page.getByRole("heading",{name:"You're all caught up"})).toBeVisible();
  await page.getByRole("tab",{name:'Completed',exact:true}).click();await expect(page.getByRole("heading",{name:"You're all caught up"})).toBeVisible();
  await page.getByRole("button",{name:"Open navigation",exact:true}).click();await page.getByRole("dialog").screenshot({path:"docs/screenshots/phase4b/mobile-navigation-390.png"});await page.getByRole("button",{name:"Close navigation"}).click();
  await page.getByRole("tab",{name:/Requests/}).click();await page.screenshot({path:"docs/screenshots/phase4b/mobile-camera-390-polished.png"});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
test("custom service uses only its name and employee charge with no minimum price",async({page})=>{
  await page.goto("/pos");await page.getByRole("button",{name:"Custom Service",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Add Custom Service"});await expect(dialog.getByLabel(/Minimum/)).toHaveCount(0);await expect(dialog.locator('input:not([type="checkbox"])')).toHaveCount(2);
  await dialog.getByLabel("Service name",{exact:true}).fill("Changed charging connector");await dialog.getByLabel("Charge (PKR)",{exact:true}).fill("500");await dialog.getByRole("button",{name:"Add to Sale"}).click();
  await page.getByRole("button",{name:"Edit Changed charging connector price"}).click();const price=page.getByRole("dialog",{name:"Service price"});await expect(price).not.toContainText(/Minimum|Manager/);await price.getByLabel("Price (PKR)",{exact:true}).fill("750");await price.getByRole("button",{name:"Apply price"}).click();await expect(page.locator(".cart-panel")).toContainText("PKR 750");
  await page.getByRole("button",{name:"Edit Changed charging connector price"}).click();await page.getByRole("dialog").getByLabel("Price (PKR)",{exact:true}).fill("100");await page.getByRole("button",{name:"Apply price"}).click();await expect(page.locator(".cart-row").filter({hasText:"Changed charging connector"})).toContainText("PKR 100");
});
test("customer and custom service share one row without duplicate avatars",async({page})=>{
  await page.goto("/pos");const customer=page.locator(".cart-customer").getByRole("button",{name:"Select sale customer"}),service=page.locator(".cart-customer").getByRole("button",{name:"Custom Service",exact:true});const a=await customer.boundingBox(),b=await service.boundingBox();expect(a&&b&&Math.abs(a.y-b.y)<2).toBeTruthy();await expect(page.locator(".cart-customer .customer-icon")).toHaveCount(0);
});
test("phone pages retain safe scrolling and touch controls",async({page})=>{
  await staffUi(page);for(const width of [360,390,600,767]){await page.setViewportSize({width,height:844});for(const route of ["/profile","/mobile-camera","/mobile/products"]){await page.goto(route);await expect(page.getByRole("navigation",{name:"Mobile navigation"})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();const nav=await page.locator(".mobile-nav").boundingBox();expect(nav?.height).toBeGreaterThanOrEqual(64);}}
});

