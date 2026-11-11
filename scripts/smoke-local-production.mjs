import { chromium, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";

const baseURL = process.env.PREVIEW_URL ?? "http://127.0.0.1:4174";
const config = JSON.parse(
  readFileSync(
    new URL("../src-tauri/tauri.conf.json", import.meta.url),
    "utf8",
  ),
);
const browser = await chromium.launch();
const errors = [];
const watch = (page) => {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
};
async function securityPolicy(context) {
  await context.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        "content-security-policy": config.app.security.csp,
      },
    });
  });
}
try {
  mkdirSync("docs/screenshots/phase2", { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await securityPolicy(context);
  const page = await context.newPage();
  watch(page);
  await page.goto(`${baseURL}/dashboard`);
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("LOCAL DEMO · Data saved on this device", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(async () =>
      (await indexedDB.databases()).map((db) => db.name),
    ),
  ).toContain("taha-pos-local-prototype");
  await page
    .getByRole("link", { name: "New Sale", exact: true })
    .first()
    .click();
  await expect(page.getByTestId("cart-total")).toContainText("20,300");
  await expect(page.locator("body")).not.toContainText(
    /purchase cost|gross profit/i,
  );
  const display = await context.newPage();
  watch(display);
  await display.goto(`${baseURL}/customer-display`);
  await expect(
    display.getByRole("heading", { name: "Your Order", exact: true }),
  ).toBeVisible();
  await expect(display.locator(".display-total")).toContainText("20,300");
  await expect(display.locator("body")).not.toContainText(
    /purchase cost|minimum|inventory quantity|profit/i,
  );
  await page.getByRole("button", { name: /CHECKOUT/ }).click();
  await page
    .getByRole("button", { name: "Complete Sale", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sale Complete", exact: true }),
  ).toBeVisible();
  await expect(
    display.getByRole("heading", { name: "Thank you", exact: true }),
  ).toBeVisible();
  await expect(
    display.getByRole("heading", {
      name: "Everything your phone needs.",
      exact: true,
    }),
  ).toBeVisible({ timeout: 15_000 });
  await page.goto(`${baseURL}/products/p2`);
  await expect(
    page.getByText("Available Stock", { exact: true }).locator(".."),
  ).toContainText("24");
  await page.reload();
  await expect(
    page.getByText("Available Stock", { exact: true }).locator(".."),
  ).toContainText("24");
  await page.getByRole("button", { name: "Choose theme" }).click();
  await page.getByRole("menuitem", { name: "Dark", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.screenshot({
    path: "docs/screenshots/phase2/production-dark.png",
  });
  // Simulate packaged routing only; this is not a native Tauri launch.
  const desktop = await browser.newContext();
  await securityPolicy(desktop);
  await desktop.addInitScript("globalThis.isTauri = true;");
  const desktopPage = await desktop.newPage();
  watch(desktopPage);
  await desktopPage.goto(`${baseURL}/#/customer-display`);
  await expect(
    desktopPage.getByRole("heading", {
      name: "Everything your phone needs.",
      exact: true,
    }),
  ).toBeVisible();
  await desktopPage.goto(`${baseURL}/#/pos`);
  await expect(
    desktopPage.getByRole("heading", { name: "New Sale", exact: true }),
  ).toBeVisible();
  await desktopPage.reload();
  await expect(
    desktopPage.getByRole("heading", { name: "New Sale", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "Production local prototype passed: IndexedDB, checkout, persistent stock, sanitized live/idle customer display, dark persistence, desktop CSP and simulated hash routing.",
  );
  console.log(
    "No browser runtime or console errors. Native Tauri compilation and launch were not attempted.",
  );
} finally {
  await browser.close();
}

