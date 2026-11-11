import { test, expect } from "@playwright/test";
import {staffUi} from './fixtures/staff-ui';

test.describe("Phase 4B counter experience", () => {
  test("customer display starts idle and follows the first cart item", async ({ page, context }) => {
    await page.goto("/customer-display");
    await expect(page.getByText("Everything your phone needs.")).toBeVisible();
    const pos = await context.newPage();
    await pos.goto("/pos");
    await pos.getByRole("textbox", { name: "Search products" }).fill("890001");
    await pos.getByRole("button", { name: "Add Samsung Galaxy A15 Charging Board", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your Order" })).toBeVisible();
    await expect(page.getByText("Samsung Galaxy A15 Charging Board")).toBeVisible();
  });

  test("customer selector supports search and quick add without leaving sale", async ({ page }) => {
    await page.goto("/pos");
    await page.getByRole("button", { name: "Select sale customer" }).click();
    await page.getByRole("textbox", { name: "Search customers" }).fill("Ali");
    await expect(page.getByText("Danish Ali")).toBeVisible();
    await page.getByRole("button", { name: /Add New Customer/ }).click();
    await expect(page.getByRole("heading", { name: "Add New Customer" })).toBeVisible();
  });

  test("mobile camera queue and profile menu are available", async ({ page }) => {
    await staffUi(page);
    await page.goto("/mobile-camera");
    await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
    await page.goto("/profile");
    await expect(page.getByText("Connected devices")).toBeVisible();
    await page.goto("/pos");
    await page.getByRole("button", { name: "Open profile menu" }).click();
    await expect(page.getByText("Change password")).toBeVisible();
  });

  test("settings exposes customer display, mobile camera and keyboard controls", async ({ page }) => {
    await page.goto("/settings");
    for (const section of ["Customer Display", "Mobile Camera", "Touchscreen Keyboard", "Customer Selection"]) {
      await page.getByRole("button", { name: section, exact: true }).click();
      await expect(page.getByRole("heading", { name: section, exact: true })).toBeVisible();
    }
  });
});
