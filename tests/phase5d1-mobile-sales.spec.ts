import { test, expect } from "@playwright/test";
import { staffUi } from "./fixtures/staff-ui";
import { mkdirSync } from "node:fs";
const store = "10000000-0000-4000-8000-000000000001";
async function openSales(page: import("@playwright/test").Page, digital = false) {
  page.on("pageerror", (error) =>
    console.log("Mobile browser error:", error.message),
  );
  page.on("console", (message) => {
    if (message.type() === "error")
      console.log("Mobile console:", message.text());
  });
  await staffUi(page);
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: {
        profile: {
          id: "50000000-0000-4000-8000-000000000001",
          full_name: "Ahmed Khan",
          email: "owner@taha.test",
          role: "owner",
          status: "active",
        },
        permissions: [],
        store: { id: store, name: "Taha Mobiles", branch_name: "Main Branch" },
        terminal: false,
      },
    }),
  );
  await page.route("**/api/v1/stores/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/dashboard")) {
      await route.fallback();
      return;
    }
    let json: unknown = [];
    if (path.endsWith("/shop-configuration"))
      json = {
        version: 1,
        operatingMode: "owner-only",
        enabledFeatures: { mobileSales: true },
        setupCompleted: true,
      };
    else if (path.endsWith("/settings"))
      json = {
        id: "main",
        storeName: "Taha",
        branch: "Main",
        taxProfiles: [],
        requireProof: digital,
        requirePaymentReference: digital,
        creditEnabled: true,
        shopConfiguration: {
          operatingMode: "owner-only",
          enabledFeatures: { mobileSales: true },
        },
      };
    else if (path.endsWith("/products/pos"))
      json = [
        {
          id: "20000000-0000-4000-8000-000000000001",
          internal_code: "TM-P-1",
          name: "Mobile sale cable",
          category: "Accessories",
          brand: "Taha",
          compatible_model: "",
          quality_grade: "Original",
          color_variant: "Black",
          selling_price: 500,
          minimum_selling_price: 450,
          aliases: [],
          quantity: 1,
          low_stock_level: 1,
          location: null,
        },
      ];
    else if (path.endsWith("/payment-methods"))
      json = digital ? [{id:'40000000-0000-4000-8000-000000000001',name:'JazzCash',kind:'Digital',enabled:true,requiresProof:true,title:'Shop account',number:'03000000000'}] : [
        { id: "cash", name: "Cash", kind: "Cash", enabled: true },
        { id: "credit", name: "Credit", kind: "Credit", enabled: true },
      ];
    else if (path.endsWith("/sales") && route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      json = {
        id: "30000000-0000-4000-8000-000000000001",
        invoice: "TM-INV-MOBILE-1",
        customerId: "",
        customerName: "Walk-in Customer",
        employeeName: "Ahmed Khan",
        createdAt: new Date().toISOString(),
        lines: [
          {
            productId: body.lines[0].productId,
            name: "Mobile sale cable",
            quantity: 1,
            unitPrice: 500,
            total: 500,
            discount: 0,
          },
        ],
        subtotal: 500,
        discount: 0,
        total: 500,
        paid: 500,
        outstanding: 0,
        payments: body.payments,
        returned: {},
        status: "Paid",
        receiptUrl: "https://example.test/receipt/mobile-1",
      };
    }
    await route.fulfill({ json });
  });
  await page.goto("/#/mobile/sales");
  const address = page.getByLabel("Shop Address", { exact: true });
  await expect(address).toBeVisible();
  await address.fill("http://192.168.50.25:3001");
  await page
    .getByRole("button", { name: "Test Connection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Connect", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.locator(".staff-app")).toBeVisible();
  await page.goto("/#/mobile/sales");
}
test("phone has a dedicated sale and keeps the desktop draft untouched", async ({
  page,
}) => {
  await openSales(page);
  await expect(
    page.getByRole("heading", { name: "New Sale", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Sales", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Scan", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    const path = "/src/stores/cart-store.ts";
    const { useCartStore } = await import(path);
    useCartStore.setState({
      cartId: "desktop-preserved",
      customerId: "desktop-customer",
      checkoutId: "desktop-checkout",
    });
    window.addEventListener("taha-customer-display", () =>
      localStorage.setItem("unexpected-mobile-display", "published"),
    );
  });
  await page.getByRole("button", { name: /Add Mobile sale cable/ }).click();
  await page.getByRole("button", { name: /View Cart/ }).click();
  await expect(
    page.getByRole("heading", { name: "Review Cart" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Choose Payment" }).click();
  const post = page.waitForRequest(
    (r) =>
      r.method() === "POST" &&
      new URL(r.url()).pathname === `/api/v1/stores/${store}/sales`,
  );
  await page
    .getByRole("button", { name: "Complete Sale", exact: true })
    .click();
  const body = (await post).postDataJSON();
  expect(body.clientChannel).toBe("mobile");
  expect(body.cartId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(body.idempotencyKey).toBeTruthy();
  await expect(
    page.getByRole("heading", { name: "Sale Complete" }),
  ).toBeVisible();
  await expect(
    page.getByText("TM-INV-MOBILE-1", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Share PDF", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(async () => {
      const path = "/src/stores/cart-store.ts";
      const { useCartStore } = await import(path);
      const cart = useCartStore.getState();
      return [cart.cartId, cart.customerId, cart.checkoutId];
    }),
  ).toEqual(["desktop-preserved", "desktop-customer", "desktop-checkout"]);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("unexpected-mobile-display"),
    ),
  ).toBeNull();
  mkdirSync("docs/screenshots/phase5d1", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/phase5d1/mobile-sale-complete.png",
    fullPage: true,
  });
  await page.evaluate(()=>Object.assign(window,{TahaNative:{shareReceiptPdf:(body:string)=>{localStorage.setItem('test-native-receipt',body);return true;}}}));
  await page.getByRole('button',{name:'Share PDF',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>!!localStorage.getItem('test-native-receipt'))).toBe(true);
  const native=await page.evaluate(()=>JSON.parse(localStorage.getItem('test-native-receipt')!));
  expect(native.filename).toBe('TM-INV-MOBILE-1.pdf');expect(Buffer.from(native.base64,'base64').subarray(0,5).toString()).toBe('%PDF-');
});
test('digital proof and the submitted payload survive an uncertain response and phone reload',async({page})=>{
 await openSales(page,true);let uploads=0;const submissions:unknown[]=[];
 await page.route('**/api/v1/stores/*/media',async route=>{uploads++;await route.fulfill({json:{path:'private/proof/mobile-test.png'}});});
 await page.route('**/api/v1/stores/*/sales',async route=>{if(route.request().method()!=='POST'){await route.fallback();return;}submissions.push(route.request().postDataJSON());if(submissions.length===1)await route.fulfill({status:503,json:{message:'Response uncertain; retry the same sale.'}});else await route.fallback();});
 await page.getByRole('button',{name:/Add Mobile sale cable/}).click();await page.getByRole('button',{name:/View Cart/}).click();await page.getByRole('button',{name:'Choose Payment'}).click();
 await page.getByLabel('JazzCash amount (PKR)',{exact:true}).fill('500');await page.getByLabel('Transfer reference',{exact:true}).fill('proof-test-reference');
 await page.getByRole('checkbox',{name:'Payment received and verified'}).check();await expect(page.getByRole('button',{name:'Complete Sale',exact:true})).toBeDisabled();
 await page.getByLabel('Choose from gallery',{exact:true}).setInputFiles({name:'proof.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=','base64')});
 await page.getByRole('checkbox',{name:'Payment received and verified'}).check();await page.getByRole('button',{name:'Complete Sale',exact:true}).click();await expect(page.getByRole('button',{name:'Retry Same Sale'})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Retry Same Sale'}).click();await expect(page.getByRole('heading',{name:'Sale Complete'})).toBeVisible();
 expect(uploads).toBe(1);expect(submissions).toHaveLength(2);expect(submissions[1]).toEqual(submissions[0]);
});
for(const size of [{width:390,height:844},{width:412,height:915}])test('mobile search cart and payment fit light/dark '+size.width,async({page})=>{
 await page.setViewportSize(size);await openSales(page);mkdirSync('docs/screenshots/phase5d1',{recursive:true});
 for(const theme of ['light','dark']){
  await page.evaluate(async value=>{const path='/src/stores/ui-store.ts';(await import(path)).useUiStore.getState().setTheme(value);},theme);
  await page.goto('/#/mobile/sales');await expect(page.getByRole('heading',{name:'New Sale',exact:true})).toBeVisible();
  if(theme==='light')await page.getByRole('button',{name:/Add Mobile sale cable/}).click();
  for(const stage of ['search','cart','payment']){if(stage==='cart')await page.getByRole('button',{name:/View Cart/}).click();if(stage==='payment')await page.getByRole('button',{name:'Choose Payment'}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:`docs/screenshots/phase5d1/mobile-${stage}-${theme}-${size.width}.png`,fullPage:true});}
  await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:'Back',exact:true}).click();
 }
});
test("unknown products remain distinct from custom services and draft survives navigation", async ({
  page,
}) => {
  await openSales(page);
  await page
    .getByRole("textbox", { name: "Search sale products" })
    .fill("unknown physical part");
  await expect(
    page.getByText("Product not found", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add Product", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add Custom Service", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Add Custom Service" });
  await dialog.getByLabel("Service name", { exact: true }).fill("Labour only");
  await dialog.getByLabel("Charge (PKR)", { exact: true }).fill("300");
  await dialog.getByRole("button", { name: "Add to Sale" }).click();
  await page.reload();
  await page.getByRole("button", { name: /View Cart/ }).click();
  await expect(page.getByText("Labour only", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
