import { chromium, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
const browser = await chromium.launch();
const errors = [];
const output = "docs/screenshots/phase2";
mkdirSync(output, { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const path of [
    "/dashboard",
    "/products/new",
    "/products/p1",
    "/credit/c1",
    "/repair-jobs/job-1",
    "/buy-device",
    "/employees/employee-1",
    "/shifts",
  ]) {
    await page.goto("http://127.0.0.1:1420" + path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".loading-skeleton")).toHaveCount(0);
    await page.screenshot({
      path: `${output}/review-${path.slice(1).replaceAll("/", "-")}-light.png`,
    });
  }
  await page.getByRole("button", { name: "Choose theme" }).click();
  await page.getByRole("menuitem", { name: "Dark", exact: true }).click();
  for (const path of [
    "/pos",
    "/products/new",
    "/reports",
    "/stock-receiving",
  ]) {
    await page.goto("http://127.0.0.1:1420" + path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".loading-skeleton")).toHaveCount(0);
    await page.screenshot({
      path: `${output}/review-${path.slice(1).replaceAll("/", "-")}-dark.png`,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/pos", "/products/new", "/buy-device"]) {
    await page.goto("http://127.0.0.1:1420" + path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".loading-skeleton")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `${output}/review-${path.slice(1).replaceAll("/", "-")}-mobile-dark.png`,
    });
  }
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const theme of ["Light", "Dark"]) {
      await page.getByRole("button", { name: "Choose theme" }).click();
      await page.getByRole("menuitem", { name: theme, exact: true }).click();
      for (const path of ["/transactions", "/stock-receiving?product=p1"]) {
        await page.goto("http://127.0.0.1:1420" + path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator(".loading-skeleton")).toHaveCount(0);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
        await page.screenshot({
          path: `${output}/review-${path.split("?")[0].slice(1)}-${viewport.width}-${theme.toLowerCase()}.png`,
        });
      }
    }
  }
  expect(errors).toEqual([]);
  console.log(
    "Captured desktop forms/details, dark POS/forms/reports and mobile dark previews without console errors.",
  );
} finally {
  await browser.close();
}
