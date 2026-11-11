import {completeSale} from "./fixtures/checkout";
import { test, expect } from "@playwright/test";
import {staffUi} from './fixtures/staff-ui';
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAO0lEQVR4nO3WuQkAMBADQWfqvyRVJldhcDBwueDQs2fN0zsE6kXhoglaVMW0aQ3OTGZRRYBXoWO+pusLMwAcavKGiNYAAAAASUVORK5CYII=", "base64");
test("quick customer saves and selects without losing cart", async ({ page }) => {
  await page.goto("/pos"); await page.getByRole("button", { name: "Select sale customer" }).click();
  await page.getByRole("button", { name: /Add New Customer/ }).click();
  const dialog = page.getByRole("dialog", { name: "Add New Customer" });
  await dialog.getByLabel("Name", { exact: true }).fill("Faisal Counter Test"); await dialog.getByLabel("Phone", { exact: true }).fill("03001234567");
  await dialog.getByRole("button", { name: "Save Customer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Select sale customer" })).toContainText("Faisal Counter Test");
  await expect(page.locator(".cart-row")).toHaveCount(4);
});
test("custom service completes on the same invoice without inventory movement", async ({ page }) => {
  await page.goto("/pos"); await page.getByRole("button", { name: "Custom Service", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add Custom Service" });
  await dialog.getByLabel("Service name", { exact: true }).fill("Board inspection test"); await dialog.getByLabel("Charge (PKR)", { exact: true }).fill("2500");
  await dialog.getByRole("button", { name: "Add to Sale" }).click();
  await expect(page.locator(".cart-row").filter({ hasText: "Board inspection test" })).toBeVisible();
  await page.getByRole("button", { name: "CHECKOUT" }).click(); await completeSale(page);
  await expect(page.getByRole("heading", { name: "Sale Complete", exact: true })).toBeVisible();
  await expect(page.locator(".receipt-preview")).toContainText("Board inspection test");
  await expect(page.locator(".receipt-preview")).toContainText("Thank you for choosing Taha Mobiles.");
  await page.goto("/stock"); await expect(page.locator("body")).not.toContainText("Board inspection test");
});
test("customer display follows cash, digital, bank, credit and checkout cancel", async ({ page, context }) => {
  test.setTimeout(90_000);
  await page.goto("/pos"); await expect(page.getByTestId("cart-total")).toBeVisible({timeout:30_000}); const display = await context.newPage(); await display.goto("/customer-display");
  await expect(display.getByRole("heading", { name: "Your Order" })).toBeVisible();
  await page.getByRole("button", { name: "CHECKOUT" }).click(); const dialog = page.getByRole("dialog", { name: "Checkout", exact: true });
  await dialog.getByLabel("Cash received (PKR)").fill("25000");
  await expect(display.getByText("CASH RECEIVED", { exact: true })).toBeVisible(); await expect(display.locator(".display-change")).toContainText("PKR 4,700");
  await dialog.locator(".payment-options button").filter({hasText:"JazzCash"}).first().click(); await expect(display.getByRole("heading", { name: "JazzCash" })).toBeVisible();
  await expect(display.locator("body")).not.toContainText("Upload payment proof");
  await dialog.locator(".payment-options button").filter({hasText:"Bank Transfer"}).first().click(); await expect(display.getByRole("heading", { name: "Bank Transfer" })).toBeVisible();
  await expect(display.locator("body")).not.toContainText("JazzCash ·");
  await dialog.locator(".payment-options button").filter({hasText:"Credit"}).first().click(); await expect(display.getByText("BALANCE", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click(); await expect(display.getByRole("heading", { name: "Your Order" })).toBeVisible(); await expect(display.getByText("BALANCE", { exact: true })).toHaveCount(0);
});
test("cleared cart returns customer display to idle and other terminals stay isolated", async ({ page, context }) => {
  await page.goto("/pos");await expect(page.getByTestId("cart-total")).toBeVisible({timeout:30000}); const display = await context.newPage(), isolated = await context.newPage();
  await display.goto("/customer-display"); await isolated.goto("/customer-display?terminal=other-counter");
  await expect(isolated.getByText("Everything your phone needs.")).toBeVisible();
  while (await page.locator(".cart-remove").count()) await page.locator(".cart-remove").first().click();
  await expect(display.getByText("Everything your phone needs.")).toBeVisible();
  await page.getByRole("textbox", { name: "Search products" }).fill("890001"); await page.getByRole("button", { name: "Add Samsung Galaxy A15 Charging Board", exact: true }).click();
  await expect(display.getByRole("heading", { name: "Your Order" })).toBeVisible(); await expect(isolated.getByText("Everything your phone needs.")).toBeVisible();
});
test("profile image is validated, previewed, persisted and removable", async ({ page }) => {
  await page.goto("/profile"); await page.locator('input[type=file]').first().setInputFiles({ name: "profile.png", mimeType: "image/png", buffer: image });
  await expect(page.getByRole("button", { name: "Preview image 1" })).toBeVisible(); await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile updated.")).toBeVisible(); await page.reload(); await expect(page.getByAltText("Profile photo")).toBeVisible();
  await page.getByRole("button", { name: "Remove image", exact: true }).click(); await page.getByRole("button", { name: "Save profile" }).click(); await expect(page.getByText("Profile updated.")).toBeVisible(); await page.reload(); await expect(page.getByAltText("Profile photo")).toHaveCount(0);
});
test("payment proof stays attached to its exact payment form and uses secure staff sign-in", async ({ page }) => {
  await page.goto("/pos"); await page.getByRole("button", { name: "CHECKOUT" }).click(); await page.locator(".payment-options button").filter({hasText:"JazzCash"}).first().click();
  await page.getByRole("button", { name: "Take Photo with Phone",exact:true }).click();
  const sign=page.getByRole("dialog", {name:"Sign In to Your Shop",exact:true});await expect(sign).toBeVisible();await sign.getByRole("button",{name:"Close dialog",exact:true}).click();
  const checkout=page.getByRole("dialog",{name:"Checkout",exact:true});await expect(checkout.locator(".payment-options button").filter({hasText:"JazzCash"}).first()).toBeVisible();await checkout.locator('input[type=file]').first().setInputFiles({name:"proof.png",mimeType:"image/png",buffer:image});await expect(checkout.getByRole("button",{name:"Preview image 1",exact:true})).toBeVisible();
});

test("appearance customizer validates contrast and persists font", async ({ page }) => {
  await page.goto("/settings"); await page.getByRole("button", { name: "Appearance", exact: true }).click(); await page.getByRole("button", { name: "Inter", exact: true }).click();
  await page.getByLabel("danger hex color").fill("#FFFFFF"); await expect(page.getByRole("button", { name: "Save Appearance" })).toBeDisabled();
  await page.getByLabel("danger hex color").fill("#DC2626"); await page.getByRole("button", { name: "Save Appearance" }).click(); await expect(page.getByText("Appearance saved", { exact: true })).toBeVisible(); await page.reload();
  await expect.poll(() => page.locator("html").evaluate(el => getComputedStyle(el).fontFamily)).toContain("Inter");
});
test("virtual full keyboard targets search and closes with Escape", async ({ page }) => {
  await page.goto("/pos"); await page.getByRole("button", { name: "Keyboard", exact: true }).click(); const input = page.getByRole("textbox", { name: "Search products" }); await input.fill(""); await input.focus();
  await page.locator(".virtual-keyboard").getByRole("button", { name: "b", exact: true }).click(); await expect(input).toHaveValue("b"); await page.keyboard.press("Escape"); await expect(page.locator(".virtual-keyboard")).toHaveCount(0);
});
test("virtual numpad edits checkout cash without dismissing checkout", async ({ page }) => {
  await page.goto("/pos"); await page.getByRole("button", { name: "Keyboard", exact: true }).click(); await page.getByRole("button", { name: "CHECKOUT" }).click();
  const input = page.getByLabel("Cash received (PKR)"); await input.focus(); const keyboard = page.locator(".virtual-keyboard"); await keyboard.getByRole("button", { name: "Clear", exact: true }).click(); await keyboard.getByRole("button", { name: "7", exact: true }).click(); await expect(input).toHaveValue("7"); await expect(page.getByRole("dialog", { name: "Checkout", exact: true })).toBeVisible();
});
for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) test(`counter additions do not overflow at ${viewport.width}`, async ({ page }) => {
  await page.setViewportSize(viewport);
  await staffUi(page);for (const route of ["/pos", "/profile", "/customers", "/mobile-camera", "/customer-display"]) { await page.goto(route); await expect(page.locator("main").first()).toBeVisible(); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); }
});
test("checkout searches customers and quick-adds without leaving payment",async({page})=>{
  await page.goto("/pos");await page.getByRole("button",{name:"CHECKOUT"}).click();const checkout=page.getByRole("dialog",{name:"Checkout",exact:true});await checkout.getByRole("button",{name:"Select sale customer"}).click();await checkout.getByRole("textbox",{name:"Search customers",exact:true}).fill("ABC");await expect(checkout.locator(".customer-option").filter({hasText:"ABC Mobiles"})).toBeVisible();await checkout.getByRole("button",{name:/Add New Customer/}).click();const add=page.getByRole("dialog",{name:"Add New Customer",exact:true});await add.getByLabel("Name",{exact:true}).fill("Checkout Quick Customer");await add.getByRole("button",{name:"Save Customer",exact:true}).click();await expect(checkout.getByRole("button",{name:"Select sale customer"})).toContainText("Checkout Quick Customer");await expect(checkout.getByRole("button",{name:"Review Sale",exact:true})).toBeEnabled();
});
test("product gallery preserves three-image ordering and deletion",async({page})=>{
  await page.goto("/products");await page.getByRole("link",{name:"View / Manage"}).first().click();await page.getByRole("link",{name:"Edit",exact:true}).click();const input=page.getByLabel('Upload product images',{exact:true});await input.setInputFiles([1,2,3].map(n=>({name:`image${n}.png`,mimeType:"image/png",buffer:image})));await expect(page.getByRole("button",{name:"Preview image 3"})).toBeVisible();await page.getByRole("button",{name:"Move image 3 left"}).click();await page.getByLabel("Select image 1",{exact:true}).check();await page.locator(".media-selection-toolbar").getByRole("button",{name:"Delete",exact:true}).click();await page.getByRole("button",{name:"Save Product",exact:true}).click();await page.getByRole("link",{name:"Edit",exact:true}).click();await expect(page.getByRole("button",{name:/Preview image/})).toHaveCount(2);
});
test("repair links a customer and persists categorized before and after photos",async({page})=>{
  await page.goto("/repair-jobs/new");await page.getByRole("button",{name:"Select sale customer"}).click();await page.locator(".customer-option").filter({hasText:"ABC Mobiles"}).click();await page.getByLabel("Device / model",{exact:true}).fill("iPhone 13");await page.getByLabel("Reported problem",{exact:true}).fill("Battery check");await page.locator('input[type=file]').first().setInputFiles({name:"before.png",mimeType:"image/png",buffer:image});await page.getByRole("button",{name:"After (0)",exact:true}).click();await page.locator('input[type=file]').first().setInputFiles({name:"after.png",mimeType:"image/png",buffer:image});await page.getByRole("button",{name:"Save",exact:true}).click();await expect(page).toHaveURL(/\/repair-jobs\/[0-9a-f-]{36}$/);await page.reload();await expect(page.getByRole("button",{name:"Before (1)",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"After (1)",exact:true})).toBeVisible();
});
