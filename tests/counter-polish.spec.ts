import { test, expect } from "@playwright/test";
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAO0lEQVR4nO3WuQkAMBADQWfqvyRVJldhcDBwueDQs2fN0zsE6kXhoglaVMW0aQ3OTGZRRYBXoWO+pusLMwAcavKGiNYAAAAASUVORK5CYII=", "base64");

test("repair category stays fixed while a photo is being prepared",async({page})=>{
  test.setTimeout(90_000);
  await page.goto("/repair-jobs/new", {waitUntil:"domcontentloaded"});
  await expect(page.getByRole("button", {name:"After (0)", exact:true})).toBeVisible({timeout:30_000});
  await page.evaluate(()=>{const decode=window.createImageBitmap.bind(window);const gate=new Promise<void>(resolve=>{Object.assign(window,{releasePhoto:resolve});});window.createImageBitmap=(async(...args:Parameters<typeof decode>)=>{await gate;return decode(...args);}) as typeof window.createImageBitmap;});
  await page.getByLabel("Upload before photos",{exact:true}).setInputFiles({name:"before.png",mimeType:"image/png",buffer:image});
  await expect(page.getByRole("button",{name:"After (0)",exact:true})).toBeDisabled();
  await page.evaluate(()=>{(window as unknown as {releasePhoto:()=>void}).releasePhoto();});
  await expect(page.getByRole("button",{name:"Before (1)",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"After (0)",exact:true})).toBeEnabled();
});

test("product save waits for image preparation", async ({page}) => {
  test.setTimeout(90_000);
  await page.goto("/products/new");
  await page.getByLabel("Product Name",{exact:true}).fill("Preview-safe product");
  await page.evaluate(() => {
    const decode = window.createImageBitmap.bind(window);
    window.createImageBitmap = (async (...args: Parameters<typeof decode>) => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      return decode(...args);
    }) as typeof window.createImageBitmap;
  });
  await page.getByLabel("Upload product images",{exact:true}).setInputFiles({name:"photo.png",mimeType:"image/png",buffer:image});
  await expect(page.getByRole("button",{name:"Save Product",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Preview image 1"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Save Product",exact:true})).toBeEnabled();
});

test("a custom service can be saved for the next sale without leaving POS", async ({page}) => {
  await page.goto("/pos");
  await expect(page.locator(".cart-customer .customer-icon")).toHaveCount(0);
  if(await page.locator('.cart-items .cart-row').count()===0)await page.getByRole('button',{name:'Add Samsung Galaxy A15 Charging Board',exact:true}).click();
  await expect(page.locator(".cart-items").getByRole("button",{name:/Increase.*quantity/}).first()).toBeInViewport({ratio:1});
  await page.getByRole("complementary",{name:"Current sale cart"}).getByRole("button",{name:"Custom Service",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Add Custom Service"});
  await dialog.getByLabel("Service name",{exact:true}).fill("Reusable counter diagnosis");
  await dialog.getByLabel("Charge (PKR)",{exact:true}).fill("1000");
  await dialog.getByLabel(/Save.*reusable service/).check();
  await dialog.getByRole("button",{name:"Add to Sale"}).click();
  await expect(page.locator(".cart-panel")).toContainText("Reusable counter diagnosis");
  await page.getByRole("textbox",{name:"Search products"}).fill("Reusable counter diagnosis");
  const card=page.locator(".product-card").filter({hasText:"Reusable counter diagnosis"});
  await expect(card.locator(".badge")).toHaveText("SERVICE");
  await expect(card).not.toContainText("OUT OF STOCK");
  await page.goto("/services");
  await expect(page.getByRole("row").filter({hasText:"Reusable counter diagnosis"})).toBeVisible();
});

test("nested customer dialog shows only one touchscreen keyboard",async({page})=>{
  await page.goto("/pos");
  await page.getByRole("button",{name:"Add Samsung Galaxy A15 Charging Board",exact:true}).click();
  await page.getByRole("button",{name:"Keyboard",exact:true}).click();
  await page.getByRole("button",{name:/CHECKOUT/}).click();
  await page.getByRole("dialog",{name:"Checkout",exact:true}).getByRole("button",{name:"Select sale customer"}).click();
  await page.getByRole("button",{name:/Add New Customer/}).click();
  const dialog=page.getByRole("dialog",{name:"Add New Customer"});
  await dialog.getByLabel("Name",{exact:true}).focus();
  await expect(page.locator(".virtual-keyboard:visible")).toHaveCount(1);
  await dialog.getByRole("button",{name:"q",exact:true}).click();
  await expect(dialog.getByLabel("Name",{exact:true})).toHaveValue("q");
});
