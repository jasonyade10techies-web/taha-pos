import { chromium, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const base = process.env.PREVIEW_URL ?? "http://127.0.0.1:4173";
const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const browser = await chromium.launch();
const errors = [];
// Exercise the built app's unauthenticated state without a deployed API.
// Auth is rejected; the public display gets only its isolated pairing capability.
async function configureContext(context) {
  await context.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/v1/auth/refresh")
      return route.fulfill({ status: 401, json: { message: "No active session." } });
    if (pathname === "/api/v1/displays" && route.request().method() === "POST")
      return route.fulfill({ json: { displaySessionId: "smoke-display", pairingCode: "A1B2C3D4", displayToken: "public-smoke-capability", expiresAt: new Date(Date.now() + 60_000).toISOString() } });
    if (pathname === "/api/v1/displays/smoke-display")
      return route.fulfill({ json: { status: "Waiting", online: false } });
    errors.push(`Unauthenticated app requested an internal API: ${pathname}`);
    return route.fulfill({ status: 403, json: { message: "Access denied." } });
  });
  await context.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.fallback();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), "content-security-policy": config.app.security.csp } });
  });
}
function inspectPage(page) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // The intercepted rejection above is expected; all other console errors fail.
    if (m.location().url.endsWith("/api/v1/auth/refresh") && /401/.test(m.text())) return;
    errors.push(m.text());
  });
}
try {
  const context = await browser.newContext();
  await configureContext(context);
  const page = await context.newPage();
  inspectPage(page);
  await page.goto(base + "/pos");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome to your workspace" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enter mock owner workspace" }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => indexedDB.databases())).toEqual([]);
  await page.evaluate(() =>
    localStorage.setItem(
      "taha-pos-ui",
      JSON.stringify({ state: { theme: "dark" }, version: 1 }),
    ),
  );
  await page.reload();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.goto(base + "/customer-display");
  await expect(
    page.getByRole("heading", { name: "Everything your phone needs." }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /purchase cost|minimum selling|gross profit|Ahmed Khan/,
  );
  const desktop = await browser.newContext();
  await configureContext(desktop);
  await desktop.addInitScript("globalThis.isTauri = true");
  const native = await desktop.newPage();
  inspectPage(native);
  await native.goto(base + "/#/pos");
  await expect(native).toHaveURL(/#\/login$/);
  await native.reload();
  await expect(
    native.getByRole("heading", { name: "Welcome to your workspace" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "API production smoke passed: fail-closed routes, no mock owner/local DB, public safe display, dark persistence, CSP and simulated hash routing. API responses are intercepted fixtures; not a native launch or deployed connection.",
  );
} finally {
  await browser.close();
}
