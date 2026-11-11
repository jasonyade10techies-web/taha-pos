import { test, expect, type Page } from "@playwright/test";

const storeId = "10000000-0000-4000-8000-000000000001";

test('passwordless phone QR requires a visible PC approval and displays the device identity',async({page})=>{
 await shop(page,true,false);let approved=false;
 const expiresAt=new Date(Date.now()+120000).toISOString();
 await page.route('**/api/v1/auth/enrollment**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/approve')){approved=true;await route.fulfill({status:201,json:{ok:true}});return;}
  if(route.request().method()==='POST'){await route.fulfill({status:201,json:{id:'enrollment-1',expiresAt,address:'https://192.168.1.3:3443',terminalName:'Main Counter',qrPayload:'taha-mobile://enroll?challenge=single-use-test&pin=public-pin'}});return;}
  await route.fulfill({json:{expiresAt,deviceName:'My Test Android',fingerprint:'0123456789abcdef0123456789abcdef',...(approved?{consumedAt:new Date().toISOString()}:{})}});
 });
 await page.getByRole('button',{name:'Connect Phone',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Connect Phone',exact:true});
 await expect(dialog.getByRole('heading',{name:'Authorize this phone?'})).toBeVisible();
 await expect(dialog).toContainText('My Test Android');await expect(dialog).toContainText('0123456789abcdef');
 expect(approved).toBe(false);expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain('single-use-test');
 await dialog.getByRole('button',{name:'Authorize this phone',exact:true}).click();
 await expect(dialog).toContainText('Phone connected.');expect(approved).toBe(true);
});

test('passwordless enrollment fails closed when the shop HTTPS listener is unavailable',async({page})=>{
 await shop(page,true,false);
 await page.route('**/api/v1/auth/enrollment',route=>route.fulfill({status:503,json:{message:'Secure phone enrollment is unavailable. Configure the shop HTTPS certificate, private key and reachable HTTPS address; cleartext pairing cannot sign in a new phone.'}}));
 await page.getByRole('button',{name:'Connect Phone',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Connect Phone',exact:true});await expect(dialog.getByRole('alert')).toContainText('cleartext pairing cannot sign in a new phone');await expect(dialog.getByRole('img',{name:'Secure phone enrollment QR code',exact:true})).toHaveCount(0);
});
type Phone = { id: string; deviceName: string; platform: string; terminalId: string; terminalName: string; online: boolean; lastSeen: string };
async function shop(page: Page, signedIn = true, paired = true) {
  test.setTimeout(90_000);
  if(signedIn)await page.addInitScript(()=>localStorage.setItem("taha-bridge-session:/api/v1","1"));
  let terminalId = "", authenticated = signedIn;
  let phones: Phone[] = paired ? [{ id: "phone-1", deviceName: "Samsung Staff Phone", platform: "Android", terminalId, terminalName: "Main Counter", online: true, lastSeen: new Date().toISOString() }] : [];
  const writes: string[] = [];
  const context = { profile: { id: "bridge-owner", full_name: "Shop Owner", email: "owner@shop.test", phone: null, avatar_url: null, role: "owner", status: "active" }, permissions: ["devices.pair", "camera.request"], store: { id: storeId, name: "Taha Mobiles", branch_name: "Main Branch" }, terminal: false, counter_expires_at: null };
  await page.route("**/api/v1/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const body = request.postDataJSON() as Record<string, string> | null;
    let status = 200, json: unknown = [];
    if (request.method() !== "GET") writes.push(`${request.method()} ${path}`);
    if (path.endsWith("/auth/refresh")) { status = authenticated ? 200 : 401; json = authenticated ? { accessToken: "bridge-test-secret", context } : { message: "Sign in" }; }
    else if (path.endsWith("/auth/login")) { authenticated = body?.password === "shop-test-password"; status = authenticated ? 200 : 401; json = authenticated ? { accessToken: "bridge-test-secret", context } : { message: "Invalid credentials" }; }
    else if (path.endsWith("/camera/terminals/register")) { terminalId = body?.terminalId ?? terminalId; json = { id: terminalId }; }
    else if (path.endsWith("/camera/devices") && request.method() === "GET") { terminalId = url.searchParams.get("terminalId") || terminalId; json = phones.map(phone => ({ ...phone, terminalId })); }
    else if (path.endsWith("/camera/pairing")) json = { id: "pair-1", code: "123456", expiresAt: new Date(Date.now() + 120000).toISOString(), terminalId, terminalName: "Main Counter", shopName: "Taha Mobiles", branchName: "Main Branch", shopAddress: "https://shop.test", qrPayload: "taha-mobile://pair?shop=https%3A%2F%2Fshop.test&terminal=counter&code=123456" };
    else if (path.endsWith("/camera/devices/phone-1") && request.method() === "PATCH") phones = phones.map(phone => ({ ...phone, deviceName: body?.deviceName ?? phone.deviceName }));
    else if (path.endsWith("/camera/devices/phone-1") && request.method() === "DELETE") phones = [];
    else if (path.endsWith("/camera/pairings") && request.method() === "DELETE") phones = [];
    else if (path.endsWith("/camera/devices/phone-1/test")) json = { id: "test-request-1", terminalId, type: "product-photo", title: "Staff phone connection test", status: "waiting", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() };
    await route.fulfill({ status, json });
  });
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "Devices", exact: true })).toBeVisible({timeout:30_000});
  await page.getByRole("button", { name: "Devices", exact: true }).click();
  return { writes, setPhones: (next: Phone[]) => { phones = next; } };
}

test("pairing signs into the actual shop independently and keeps credentials out of persisted storage", async ({ page }) => {
  await shop(page, false, false);
  await page.getByRole("button", { name: "Pair Staff Phone", exact: true }).click();
  const signIn = page.getByRole("dialog", { name: "Sign In to Your Shop", exact: true });
  await expect(signIn).toBeVisible();
  await signIn.getByLabel("Email", { exact: true }).fill("owner@shop.test");
  await signIn.getByLabel("Password", { exact: true }).fill("incorrect");
  await signIn.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(signIn.getByRole("alert")).toBeVisible();
  await signIn.getByLabel("Password", { exact: true }).fill("shop-test-password");
  await signIn.getByRole("button", { name: "Sign In", exact: true }).click();
  const pairing = page.getByRole("dialog", { name: "Pair Staff Phone", exact: true });
  await expect(pairing.getByText("123 456", { exact: true })).toBeVisible();
  await expect(pairing).toContainText("Main Counter");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toMatch(/bridge-test-secret|shop-test-password/);
  await pairing.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(pairing).toHaveCount(0);
});

test("paired devices support rename, test request and device-only reset with confirmation", async ({ page }) => {
  const harness = await shop(page);
  const card = page.locator(".staff-phone-card");
  await expect(card).toContainText("Samsung Staff Phone");
  await expect(card).toContainText("Online");
  await card.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByLabel("Phone name", { exact: true }).fill("Counter Camera");
  await page.getByRole("dialog", { name: "Rename Staff Phone", exact: true }).getByRole("button", { name: "Save Name", exact: true }).click();
  await expect(card).toContainText("Counter Camera");
  await card.getByRole("button", { name: "Send Test Request", exact: true }).click();
  await expect(page.getByText("Test request sent to Counter Camera.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset Pairing", exact: true }).click();
  const reset = page.getByRole("dialog", { name: "Reset Staff Phone Pairing?", exact: true });
  await expect(reset).toContainText("products, stock, customers and sales");
  expect(harness.writes.filter(write => write.includes("/camera/pairings"))).toHaveLength(0);
  await reset.getByRole("button", { name: "Reset Pairing", exact: true }).click();
  await expect(page.getByText("No staff phone paired", { exact: true })).toBeVisible();
  expect(harness.writes.filter(write => write.startsWith("DELETE "))).toEqual([`DELETE /api/v1/stores/${storeId}/camera/pairings`]);
});

test("opening a new pairing code keeps already-paired phones from completing the dialog", async ({ page }) => {
  await shop(page);
  await page.getByRole("button", { name: "Pair Staff Phone", exact: true }).click();
  const pairing = page.getByRole("dialog", { name: "Pair Staff Phone", exact: true });
  await expect(pairing.getByText("123 456", { exact: true })).toBeVisible();
  await expect(pairing.getByRole("img", { name: "Staff phone pairing QR code", exact: true })).toHaveAttribute("width", "280");
  await expect(pairing).toBeVisible();
  await pairing.getByRole("button", { name: "Refresh Code", exact: true }).click();
  await expect(pairing.getByText("123 456", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

for(const offline of [false,true])test(`photo capture explains ${offline?'offline phone':'no paired phone'} without creating a waiting request`,async({page})=>{
 const harness=await shop(page,true,offline);
 if(offline)harness.setPhones([{id:'phone-1',deviceName:'Counter Phone',platform:'Android',terminalId:'',terminalName:'Main Counter',online:false,lastSeen:new Date().toISOString()}]);
 await page.goto('/products/new');await page.locator('.product-media-heading').getByRole('button',{name:'Use Mobile',exact:true}).click();
 await expect(page.getByText(offline?'Your paired phone is offline.':'No Staff Phone Paired',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Use Another Phone',exact:true})).toBeVisible();
 expect(harness.writes.some(write=>write.includes('/camera/jobs'))).toBeFalsy();
});

test('two online phones require selection before sending a photo request',async({page})=>{
 const harness=await shop(page);harness.setPhones(['first','second'].map(id=>({id,deviceName:id+' phone',platform:'Android',terminalId:'',terminalName:'Main Counter',online:true,lastSeen:new Date().toISOString()})));
 await page.goto('/products/new');await page.locator('.product-media-heading').getByRole('button',{name:'Use Mobile',exact:true}).click();
 const chooser=page.getByRole('dialog',{name:'Choose Staff Phone',exact:true});await expect(chooser).toBeVisible();await expect(chooser.locator('.camera-device-option')).toHaveCount(2);
 expect(harness.writes.some(write=>write.includes('/camera/jobs'))).toBeFalsy();await chooser.getByRole('button',{name:'Close dialog',exact:true}).click();
});
