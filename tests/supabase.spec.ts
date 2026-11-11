import { test, expect } from "@playwright/test";
import { testDatabase } from "../scripts/check-migrations.mjs";
import {
  attachBackend,
  login,
  owner,
  employee,
  branch,
  calls,
} from "./supabase-fixture";
import type { PGlite } from "@electric-sql/pglite";
import { posModel, productModel } from "../src/lib/supabase/mappers";
import type { PosProductRow, ProductRow } from "../src/types/database";
let db: PGlite;
test.beforeEach(async () => {
  db = await testDatabase();
  calls.length = 0;
  await db.exec(`insert into auth.users(id,email) values('${owner}','owner@example.invalid'),('${employee}','employee@example.invalid');
    insert into public.profiles(id,full_name,email,role,status) values('${owner}','Actual Test Owner','owner@example.invalid','owner','active'),('${employee}','Employee Hamza','employee@example.invalid','employee','active');
    insert into public.store_memberships(profile_id,store_id) values('${owner}','${branch}'),('${employee}','${branch}');
    insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select '${employee}','${branch}',id,true from public.permissions where key in ('sales.create','inventory.view');`);
});
test.afterEach(async ({ browser }) => {
  for (const context of browser.contexts()) await context.close();
  await db.close();
});
test("owner provisions an existing Auth account, saves explicit grants, assigns a secure PIN and disables access", async ({
  page,
  browser,
}) => {
  test.setTimeout(100_000);
  const newId = "40000000-0000-4000-8000-000000000003";
  await db.query("insert into auth.users(id,email) values($1,$2)", [
    newId,
    "new-staff@example.invalid",
  ]);
  await attachBackend(page, db);
  await login(page);
  await page.goto("/employees");
  await page.getByRole("button", { name: "Add Employee", exact: true }).click();
  await page
    .getByLabel("Existing Supabase Auth user UUID", { exact: true })
    .fill(newId);
  await page.getByLabel("Full name", { exact: true }).fill("New Staff");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.getByText("New Staff", { exact: true })).toBeVisible();
  await page.goto("/employees/" + newId);
  await page.getByRole("tab", { name: "Permissions", exact: true }).click();
  await page
    .getByRole("switch", { name: "sales · create", exact: true })
    .check();
  await page
    .getByRole("switch", { name: "inventory · view", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Save Permissions", exact: true })
    .click();
  await expect(
    page.getByText("Permissions updated", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page
    .getByLabel("Assign six-digit counter PIN", { exact: true })
    .fill("739182");
  await page.getByRole("button", { name: "Assign PIN", exact: true }).click();
  await expect(page.getByText(/PIN assigned securely/)).toBeVisible();
  await expect(
    page.getByLabel("Assign six-digit counter PIN", { exact: true }),
  ).toHaveValue("");
  const context = await browser.newContext();
  const staff = await context.newPage();
  await attachBackend(staff, db, newId);
  await login(staff);
  await expect(staff.locator(".sidebar")).toContainText("New Staff");
  await staff.goto("/pos");
  await expect(
    staff.getByRole("heading", { name: "New Sale", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Status", { exact: true }).selectOption("inactive");
  await page
    .locator(".form-section")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page.getByText("Employee updated", { exact: true }),
  ).toBeVisible();
  await staff.reload();
  await expect(staff.getByRole("alert")).toContainText(
    /active employee|inactive|access/i,
  );
  await db.exec("RESET ROLE");
  const hash = (
    await db.query<{ pin_hash: string }>(
      "select pin_hash from private.employee_pin_credentials where profile_id=$1",
      [newId],
    )
  ).rows[0].pin_hash;
  expect(hash).toMatch(/^\$2[abxy]\$12\$/);
  expect(hash).not.toContain("739182");
});
test("real repositories: owner catalog/location/receive10/transfer5, employee shared safe stock, no local writes", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await attachBackend(page, db);
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".workspace-footer")).toContainText("LEGACY BACKEND");
  await expect(page.locator(".sidebar")).toContainText("Actual Test Owner");
  await expect(page.locator(".kpi-sales .kpi-value")).toContainText("0");
  await page.goto("/locations");
  for (const [kind, name] of [
    ["rack", "Rack 12"],
    ["shelf", "Shelf B"],
    ["box", "Box 04"],
  ]) {
    const section = page
      .locator(".location-columns > section")
      .nth(kind === "rack" ? 0 : kind === "shelf" ? 1 : 2);
    await section.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByLabel("Location name", { exact: true }).fill(name);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect(
      section.getByRole("button").filter({ hasText: name }),
    ).toBeVisible();
  }
  await page
    .locator(".location-columns > section")
    .nth(2)
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await page.getByLabel("Location name", { exact: true }).fill("Box 05");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.goto("/products/new");
  await page
    .getByLabel("Product name", { exact: true })
    .fill("Samsung Galaxy A15 Charging Board");
  await page.getByLabel("Brand", { exact: true }).fill("Samsung");
  await page.getByLabel("Compatible model", { exact: true }).fill("Galaxy A15");
  await page.getByLabel("Selling price (PKR)", { exact: true }).fill("1450");
  await page
    .getByLabel("Minimum selling price (PKR)", { exact: true })
    .fill("1300");
  const box = await page
    .getByLabel("Default box", { exact: true })
    .locator("option")
    .filter({ hasText: "Box 04" })
    .getAttribute("value");
  await page.getByLabel("Default box", { exact: true }).selectOption(box!);
  await page
    .getByLabel("Aliases / local names (comma separated)")
    .fill("a15 charging patti");
  await page.getByRole("button", { name: "Save Product", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Samsung Galaxy A15 Charging Board",
      exact: true,
    }),
  ).toBeVisible();
  const pid = page.url().split("/").pop()!;
  const employeeContext = await browser.newContext();
  const second = await employeeContext.newPage();
  await attachBackend(second, db, employee);
  await login(second);
  await second.goto("/pos");
  await second
    .getByRole("textbox", { name: "Search products" })
    .fill("a15 charging patti");
  await expect(second.locator(".product-stock")).toContainText("Stock 0");
  await page.goto("/suppliers");
  await page.getByRole("button", { name: "Add Supplier", exact: true }).click();
  await page
    .getByLabel("Supplier name", { exact: true })
    .fill("Phase 3A Supplier");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page.getByText("Phase 3A Supplier", { exact: true }),
  ).toBeVisible();
  await page.goto("/stock-receiving?product=" + pid);
  await page
    .getByLabel("Supplier", { exact: true })
    .selectOption({ label: "Phase 3A Supplier" });
  await page.getByLabel("Quantity 1", { exact: true }).fill("10");
  await page.getByLabel("Purchase cost 1", { exact: true }).fill("900");
  await page.getByLabel("Destination 1", { exact: true }).selectOption(box!);
  await page
    .getByRole("button", { name: "Receive Stock", exact: true })
    .click();
  await expect(page.getByText("Stock received", { exact: true })).toBeVisible();
  await page.goto("/products/" + pid);
  await expect(
    page.getByText("Available Stock", { exact: true }).locator(".."),
  ).toContainText("10");
  await page.goto("/locations/" + box);
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Samsung Galaxy A15 Charging Board" }),
  ).toContainText("10");
  await expect(second.locator(".product-stock")).toContainText("Stock 10", {
    timeout: 25_000,
  });
  await expect(second.locator(".product-card")).toContainText("1,450");
  await expect(second.locator(".product-card")).toContainText("1,300");
  await second
    .getByRole("button", {
      name: "Add Samsung Galaxy A15 Charging Board",
      exact: true,
    })
    .click();
  await expect(second.getByRole("button", { name: /CHECKOUT/ })).toBeEnabled();
  await second.keyboard.press("F4");
  await expect(second.getByRole("dialog")).toBeVisible();
  await second.getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(second.locator("body")).not.toContainText(
    /purchase cost|profit|900/,
  );
  await page.goto("/transfers");
  await page.getByLabel("Product", { exact: true }).selectOption(pid);
  await page.getByLabel("Source box", { exact: true }).selectOption(box!);
  const dest = await page
    .getByLabel("Destination box", { exact: true })
    .locator("option")
    .filter({ hasText: "Box 05" })
    .getAttribute("value");
  await page.getByLabel("Destination box", { exact: true }).selectOption(dest!);
  await page.getByLabel("Quantity", { exact: true }).fill("5");
  await page
    .getByRole("button", { name: "Transfer Stock", exact: true })
    .click();
  await expect(
    page.getByText("Stock transferred", { exact: true }),
  ).toBeVisible();
  const transferRows = page
    .getByRole("table")
    .first()
    .getByRole("row")
    .filter({ hasText: "Samsung Galaxy A15 Charging Board" });
  await expect(transferRows).toHaveCount(2);
  await expect(transferRows.first()).toContainText("5");
  await expect(transferRows.last()).toContainText("5");
  await second.goto("/products/" + pid);
  await expect(
    second.getByText("Available Stock", { exact: true }).locator(".."),
  ).toContainText("10");
  await second.getByRole("tab", { name: "Locations", exact: true }).click();
  await expect(second.getByRole("row").filter({ hasText: "5" })).toHaveCount(2);
  await page.goto("/stock");
  await page.getByRole("button", { name: "Adjust Stock", exact: true }).click();
  const adjustment = page.getByRole("dialog");
  await adjustment.getByLabel("Product", { exact: true }).selectOption(pid);
  await adjustment.getByLabel("Box", { exact: true }).selectOption(box!);
  await expect(
    adjustment.getByLabel("Current quantity", { exact: true }),
  ).toHaveValue("5");
  await adjustment.getByLabel("New quantity", { exact: true }).fill("4");
  await adjustment
    .getByRole("button", { name: "Record Adjustment", exact: true })
    .click();
  await expect(page.getByText("Stock adjusted", { exact: true })).toBeVisible();
  await page.goto("/low-stock");
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Samsung Galaxy A15 Charging Board" }),
  ).toHaveCount(0); // threshold5, total10
  await second.goto("/products/" + pid + "/edit");
  await expect(
    second.getByRole("heading", { name: "Access Denied", exact: true }),
  ).toBeVisible();
  const forbidden = calls.filter(
    (c) =>
      c.identity === employee &&
      /product_financials|stock_receipt_costs|get_product_financials|get_profit_summary/.test(
        c.path,
      ),
  );
  expect(forbidden).toEqual([]);
  expect(
    await second.evaluate(async () => await indexedDB.databases()),
  ).toEqual([]);
  await page.goto("/transactions");
  await expect(
    page.getByRole("heading", { name: "Transactions",exact:true }),
  ).toBeVisible();
  await employeeContext.close();
});
test("repository product edit/duplicate/archive and master options keep server identities", async ({
  page,
}) => {
  test.setTimeout(100_000);
  await attachBackend(page, db);
  await login(page);
  await page.goto("/products/new");
  await page.getByLabel("Product name", { exact: true }).fill("Custom product");
  await page.getByLabel("Brand", { exact: true }).fill("Custom Brand");
  await page.getByLabel("Selling price (PKR)", { exact: true }).fill("2500");
  await page
    .getByLabel("Minimum selling price (PKR)", { exact: true })
    .fill("2200");
  // Product metadata can be created with zero stock before arranging any locations.
  await page.getByRole("button", { name: "Save Product", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Custom product", exact: true }),
  ).toBeVisible();
  const original = page.url();
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByLabel("Selling price (PKR)", { exact: true }).fill("2600");
  await page.getByRole("button", { name: "Save Product", exact: true }).click();
  await expect(page).toHaveURL(original);
  await expect(page.locator(".detail-grid")).toContainText("2,600");
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Custom product · Copy", exact: true }),
  ).toBeVisible();
  expect(page.url()).not.toBe(original);
  await expect(
    page.getByText("Available Stock", { exact: true }).locator(".."),
  ).toContainText("0");
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.locator(".detail-grid")).toContainText("archived");
});
test("private product images upload, replace, remove and safe repository DTO mapping", async ({
  page,
}) => {
  test.setTimeout(100_000);
  await attachBackend(page, db);
  await login(page);
  await page.goto("/products/new");
  await page.getByLabel("Product name", { exact: true }).fill("Image product");
  await page.getByLabel("Brand", { exact: true }).fill("Samsung");
  await page.getByLabel("Selling price (PKR)", { exact: true }).fill("2500");
  await page
    .getByLabel("Minimum selling price (PKR)", { exact: true })
    .fill("2200");
  const png = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      canvas.getContext("2d")!.fillRect(0, 0, 1, 1);
      return canvas.toDataURL("image/png").split(",")[1];
    }),
    "base64",
  );
  await page
    .getByLabel("Upload product photos", { exact: true })
    .setInputFiles({ name: "catalog.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("button", {name:"Preview image 1"})).toBeVisible();
  await page.getByRole("button", { name: "Save Product", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Image product", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".detail-photo")).toBeVisible();
  await expect(page.locator(".detail-photo")).toHaveJSProperty(
    "naturalWidth",
    1,
  );
  const pid = page.url().split("/").pop()!;
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Remove image 1", exact: true }).click();
  await page.getByLabel("Upload product photos", { exact: true }).setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.getByRole("button", {name:"Preview image 1"})).toBeVisible();
  await page.getByRole("button", { name: "Save Product", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Image product", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Remove image 1", exact: true }).click();
  await page.getByRole("button", { name: "Save Product", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Image product", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".detail-photo")).toHaveCount(0);
  expect(
    calls.filter((c) => c.path.startsWith("/storage/v1/object/product-images/")).length,
  ).toBeGreaterThanOrEqual(2);
  await db.exec("RESET ROLE");
  const raw = (
    await db.query("select * from public.products where id=$1", [pid])
  ).rows[0] as unknown as ProductRow;
  const unsafe = {
    ...raw,
    purchase_cost: 900,
    profit: 1600,
    quantity: 0,
    location: null,
  };
  expect(JSON.stringify(productModel(unsafe))).not.toMatch(
    /purchase_cost|profit/,
  );
  expect(
    JSON.stringify(posModel(unsafe as unknown as PosProductRow)),
  ).not.toMatch(/purchase_cost|profit|900/);
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from storage.objects",
      )
    ).rows[0].count,
  ).toBe(0);
});
