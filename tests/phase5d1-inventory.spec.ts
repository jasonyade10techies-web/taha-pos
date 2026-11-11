import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
const screenshots = "docs/screenshots/phase5d1-inventory";
mkdirSync(screenshots, { recursive: true });

async function ready(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("main")).toBeVisible();
  if (path === "/stock-receiving")
    await expect(
      page.getByRole("textbox", { name: "Reference", exact: true }),
    ).toBeVisible();
}

test("product master selectors use searchable keyboard selection and explicit creation", async ({
  page,
}) => {
  await ready(page, "/products/new");
  const brand = page.getByRole("combobox", { name: "Brand", exact: true });
  await brand.fill("samsung");
  await expect(
    page.getByRole("option", { name: "Samsung", exact: true }),
  ).toBeVisible();
  await brand.press("ArrowDown");
  await brand.press("Enter");
  await expect(brand).toHaveValue("Samsung");
  await brand.fill("  Workshop Brand  ");
  await page
    .getByRole("button", { name: "Create “Workshop Brand”", exact: true })
    .click();
  await expect(brand).toHaveValue("Workshop Brand");
  expect(await page.locator("datalist").count()).toBe(0);
});

test("receiving calendar is custom and clears by keyboard without a browser date popup", async ({
  page,
}) => {
  await ready(page, "/stock-receiving");
  await page
    .getByRole("button", { name: /Received date.*Open calendar/ })
    .click();
  const calendar = page.getByRole("dialog", { name: "Choose Received date" });
  await expect(calendar).toBeVisible();
  await calendar.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(calendar).not.toBeVisible();
  await expect(page.locator("input[type=date]")).toHaveCount(0);
});

test("receiving excludes services and keeps unknown purchase cost blank", async ({
  page,
}) => {
  await ready(page, "/stock-receiving");
  const selector = page.getByRole("combobox", {
    name: "Product 1",
    exact: true,
  });
  await selector.fill("service");
  await expect(
    page.getByRole("option").filter({ hasText: /service/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("spinbutton", { name: "Purchase cost 1", exact: true }),
  ).toHaveValue("");
});

test("quick supplier creation preserves receiving draft and selects saved supplier", async ({
  page,
}) => {
  await ready(page, "/stock-receiving");
  await page
    .getByRole("textbox", { name: "Reference", exact: true })
    .fill("KEEP-THIS-DRAFT");
  await page.getByRole("combobox", { name: "Supplier", exact: true }).click();
  await page.getByRole("button", { name: "Add Supplier", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Add Supplier", exact: true });
  await modal
    .getByRole("textbox", { name: "Supplier name", exact: true })
    .fill("Receiving Quick Supplier");
  await modal
    .getByRole("button", { name: "Save Supplier", exact: true })
    .click();
  await expect(modal).not.toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Supplier", exact: true }),
  ).toHaveValue("Receiving Quick Supplier");
  await expect(
    page.getByRole("textbox", { name: "Reference", exact: true }),
  ).toHaveValue("KEEP-THIS-DRAFT");
});

test("product overview is image first and stock/status share one control", async ({
  page,
}) => {
  await ready(page, "/products");
  const link = page
    .getByRole("link", { name: /Samsung Galaxy A15 Charging Board/ })
    .first();
  await link.click();
  await expect(page.locator(".product-detail-workspace")).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Stock & Locations", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".stock-availability").first()).toContainText(
    /available.*stock/i,
  );
});

test("transfers review shows full paths and before after balances", async ({
  page,
}) => {
  await ready(page, "/transfers");
  await expect(
    page.getByText(
      "Move items between storage locations. The total quantity does not change.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "From", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Source before/after", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Total unchanged", { exact: true }),
  ).toBeVisible();
});

test("quick product creation keeps draft and adds stock once at reviewed receiving", async ({
  page,
}) => {
  await ready(page, "/stock-receiving");
  const fixture = await page.evaluate(async () => {
    const module = "/src/lib/repositories/index.ts";
    const r = (await import(module)).repositories;
    return {
      supplier: (await r.suppliers.list())[0].name,
      location: (await r.locations.list()).find(
        (l: { kind: string; stockCondition?: string; archived: boolean }) =>
          l.kind === "box" && !l.archived && l.stockCondition !== "Damaged",
      ).name,
    };
  });
  await page
    .getByRole("textbox", { name: "Reference", exact: true })
    .fill("QUICK-CREATE-ONE-POST");
  await page
    .getByRole("combobox", { name: "Supplier", exact: true })
    .fill(fixture.supplier);
  await page
    .getByRole("option")
    .filter({ hasText: fixture.supplier })
    .first()
    .click();
  await page
    .getByRole("combobox", { name: "Product 1", exact: true })
    .fill("Receiving Quick Panel");
  await page.getByRole("button", { name: "Add Product", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Add Product for Receiving",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("textbox", { name: "Product Name", exact: true })
    .fill("Receiving Quick Panel");
  const brand = dialog.getByRole("combobox", { name: "Brand", exact: true });
  await brand.fill("samsung");
  await brand.press("ArrowDown");
  await brand.press("Enter");
  await expect(brand).toHaveValue("Samsung");
  const grade = dialog.getByRole("combobox", {
    name: "Quality grade",
    exact: true,
  });
  await grade.click();
  await page.getByRole("option", { name: "Original", exact: true }).click();
  await expect(grade).toHaveValue("Original");
  await page.screenshot({ path: `${screenshots}/quick-product.png` });
  await dialog.getByLabel("Selling price (PKR)", { exact: true }).fill("1500");
  await dialog
    .getByLabel("Minimum selling price (PKR)", { exact: true })
    .fill("1200");
  await expect(dialog.getByLabel("Initial stock", { exact: true })).toHaveCount(
    0,
  );
  await dialog
    .getByRole("button", { name: "Save Product", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Product 1", exact: true }),
  ).toHaveValue("Receiving Quick Panel");
  await expect(
    page.getByRole("textbox", { name: "Reference", exact: true }),
  ).toHaveValue("QUICK-CREATE-ONE-POST");
  const productId = await page.evaluate(async () => {
    const module = "/src/lib/repositories/index.ts";
    const r = (await import(module)).repositories;
    const product = (await r.products.list()).find(
      (p: { name: string }) => p.name === "Receiving Quick Panel",
    );
    return product.id;
  });
  const quantity = () =>
    page.evaluate(async (id) => {
      const module = "/src/lib/repositories/index.ts";
      const r = (await import(module)).repositories;
      return (
        (await r.products.pos()).find((p: { id: string }) => p.id === id)
          ?.quantity ?? 0
      );
    }, productId);
  expect(await quantity()).toBe(0);
  await page
    .getByRole("combobox", { name: "Destination 1", exact: true })
    .fill(fixture.location);
  await page
    .getByRole("option")
    .filter({ hasText: fixture.location })
    .first()
    .click();
  await page
    .getByRole("spinbutton", { name: "Quantity 1", exact: true })
    .fill("3");
  await page
    .getByRole("button", { name: "Receive Stock", exact: true })
    .click();
  const review = page.getByRole("dialog", { name: "Review Stock Receiving" });
  await expect(review).toContainText("Purchase cost unknown");
  await review
    .getByRole("button", { name: "Confirm Receive Stock", exact: true })
    .click();
  await expect(review).not.toBeVisible();
  expect(await quantity()).toBe(3);
});

test("calendar keyboard changes a date and restores its trigger focus", async ({
  page,
}) => {
  await ready(page, "/stock-receiving");
  const trigger = page.getByRole("button", {
    name: /Received date.*Open calendar/,
  });
  await trigger.click();
  const calendar = page.getByRole("dialog", { name: "Choose Received date" });
  const focused = calendar.locator("[data-day]:focus");
  await expect(focused).toBeVisible();
  const before = await focused.getAttribute("data-day");
  await focused.press("ArrowRight");
  const next = calendar.locator("[data-day]:focus");
  expect(await next.getAttribute("data-day")).not.toBe(before);
  await next.press("Enter");
  await expect(calendar).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("inventory detail and receiving fit required viewport sizes in both themes", async ({
  page,
}) => {
  test.setTimeout(180000);
  await ready(page, "/products");
  const product = page
    .getByRole("link", { name: /Samsung Galaxy A15 Charging Board/ })
    .first();
  await product.click();
  await expect(page.locator(".product-detail-workspace")).toBeVisible();
  const url = page.url();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
  ]) {
    await page.setViewportSize(size);
    for (const theme of ["light", "dark"]) {
      await page.evaluate(async (theme) => {
        const path = "/src/stores/ui-store.ts";
        (await import(path)).useUiStore.getState().setTheme(theme);
      }, theme);
      await page.goto(url);
      await expect(page.locator(".product-detail-workspace")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `Product Detail ${size.width} ${theme}`,
      ).toBe(true);
      await page.screenshot({
        path: `${screenshots}/product-detail-${size.width}-${theme}.png`,
      });
      await ready(page, "/stock-receiving");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `Receiving ${size.width} ${theme}`,
      ).toBe(true);
      await page.screenshot({
        path: `${screenshots}/receiving-${size.width}-${theme}.png`,
      });
    }
  }
  expect(errors).toEqual([]);
});

test('opening damaged units stay quarantined and never become POS availability',async({page})=>{
 await ready(page,'/stock-receiving');
 await page.evaluate(async()=>{const path='/src/lib/repositories/index.ts',r=(await import(path)).repositories;const shelf=(await r.locations.list()).find((l:{kind:string})=>l.kind==='shelf');await r.locations.save({id:crypto.randomUUID(),name:'Phase5D1 Quarantine',kind:'box',parentId:shelf.id,code:'',stockCondition:'Damaged',archived:false});});
 await ready(page,'/products/new');await page.getByRole('textbox',{name:'Product Name',exact:true}).fill('Phase5D1 Damaged Opening Panel');const brand=page.getByRole('combobox',{name:'Brand',exact:true});await brand.fill('Samsung');await brand.press('ArrowDown');await brand.press('Enter');await page.getByLabel('Selling price (PKR)',{exact:true}).fill('1000');await page.getByLabel('Minimum selling price (PKR)',{exact:true}).fill('800');await page.getByLabel('Initial stock',{exact:true}).fill('2');await page.getByRole('button',{name:'Initial stock condition',exact:true}).click();await page.getByRole('menuitem',{name:'Damaged / Quarantine',exact:true}).click();await page.getByRole('combobox',{name:'Default box',exact:true}).fill('Phase5D1 Quarantine');await page.getByRole('option').filter({hasText:'Phase5D1 Quarantine'}).click();await page.getByRole('button',{name:'Save Product',exact:true}).click();await expect(page.getByRole('heading',{name:'Phase5D1 Damaged Opening Panel',exact:true})).toBeVisible();await expect(page.locator('.stock-availability').first()).toContainText('0 available');
 const result=await page.evaluate(async()=>{const path='/src/lib/repositories/index.ts',r=(await import(path)).repositories;const p=(await r.products.list()).find((p:{name:string})=>p.name==='Phase5D1 Damaged Opening Panel');return(await r.inventory.conditions(p.id))[0];});expect(result.available).toBe(0);expect(result.damaged).toBe(2);await page.screenshot({path:`${screenshots}/damaged-opening-stock.png`});
});

test('a reviewed transfer preserves the total and validates source quantity',async({page})=>{
 await ready(page,'/stock-receiving');
 const fixture=await page.evaluate(async()=>{const path='/src/lib/repositories/index.ts',r=(await import(path)).repositories;const all=await r.locations.list(),source=all.find((l:{kind:string;stockCondition?:string;archived:boolean})=>l.kind==='box'&&l.stockCondition!=='Damaged'&&!l.archived),destination=await r.locations.save({id:crypto.randomUUID(),name:'Phase5D1 Transfer Destination',code:'',kind:'box',parentId:source.parentId,stockCondition:'Available',archived:false}),base=(await r.products.list())[0],product=await r.products.save({...base,id:undefined,name:'Phase5D1 Transfer Panel',initialQuantity:3,locationId:source.id,initialCondition:'Available',purchaseCost:undefined});return {productId:product.id,productName:product.name,sourceId:source.id,sourceName:source.name,destinationId:destination.id};});
 await ready(page,'/transfers');await page.getByRole('combobox',{name:'Product',exact:true}).fill(fixture.productName);await page.getByRole('option').filter({hasText:fixture.productName}).click();await page.getByRole('combobox',{name:'From',exact:true}).fill(fixture.sourceName);await page.getByRole('option').filter({hasText:fixture.sourceName}).click();await page.getByRole('combobox',{name:'To',exact:true}).fill('Phase5D1 Transfer Destination');await page.getByRole('option').filter({hasText:'Phase5D1 Transfer Destination'}).click();const quantity=page.getByRole('spinbutton',{name:'Quantity',exact:true}),submit=page.getByRole('button',{name:'Transfer Stock',exact:true});await quantity.fill('4');await expect(submit).toBeDisabled();await expect(page.getByRole('alert')).toContainText('Insufficient source stock');await quantity.fill('2');await expect(page.locator('.transfer-review')).toContainText('3 → 1');await expect(page.locator('.transfer-review')).toContainText('0 → 2');await page.screenshot({path:`${screenshots}/transfer-review.png`});await submit.click();
 await expect.poll(()=>page.evaluate(async f=>{const path='/src/lib/repositories/index.ts',r=(await import(path)).repositories,b=(await r.inventory.balances()).filter((b:{productId:string})=>b.productId===f.productId);return {source:b.find((b:{locationId:string})=>b.locationId===f.sourceId)?.quantity??0,destination:b.find((b:{locationId:string})=>b.locationId===f.destinationId)?.quantity??0,total:b.reduce((sum:number,b:{quantity:number})=>sum+b.quantity,0)};},fixture)).toEqual({source:1,destination:2,total:3});
});

