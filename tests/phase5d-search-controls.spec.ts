import { expect, test, type Page } from "@playwright/test";
import { staffUi } from "./fixtures/staff-ui";

async function openSearch(page: Page, query: string) {
  await page.keyboard.press("Control+k");
  const search = page.getByRole("combobox", { name: "Search modules" });
  await expect(search).toBeFocused();
  await search.fill(query);
  return page.getByRole("dialog", { name: "Search your workspace" });
}

test("global search opens the selected product, customer, receipt, service and location", async ({ page }, info) => {
  test.skip(info.config.metadata.api === true, "Local seeded business records");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  const records = await page.evaluate(async () => {
    const path = "/src/lib/repositories/index.ts";
    const r = (await import(path)).repositories;
    const product = (await r.products.pos())[0];
    const customer = (await r.customers.list())[0];
    const sale = (await r.sales.list())[0];
    const service = (await r.services.list())[0];
    const location = (await r.locations.list()).find((row: { kind: string }) => row.kind === "box");
    return [
      { group: "Products", query: product.name, label: product.name, path: "/products/" + product.id },
      { group: "Customers", query: customer.phone, label: customer.name, path: "/customers/" + customer.id },
      { group: "Receipts", query: sale.invoice.slice(-6), label: sale.invoice, path: "/transactions/" + sale.id },
      { group: "Services", query: service.name, label: service.name, path: "/services/" + service.id + "/edit" },
      { group: "Locations", query: location.code, label: location.name, path: "/locations/" + location.id },
    ];
  });
  for (const record of records) {
    const dialog = await openSearch(page, record.query);
    const group = dialog.getByRole("group", { name: record.group, exact: true });
    await expect(group).toBeVisible();
    await group.getByRole("option").filter({ hasText: record.label }).first().click();
    await expect(page).toHaveURL(new RegExp(record.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"));
    await expect(dialog).toHaveCount(0);
  }
});

test("staff navigation and page search omit modules outside current permissions", async ({ page }, info) => {
  test.skip(info.config.metadata.api === true, "Local permission fixture");
  await page.goto("/pos");
  await expect(page.getByRole("heading", { name: "New Sale", exact: true })).toBeVisible();
  const ownerSearch = await openSearch(page, "screen");
  await expect(ownerSearch.getByRole("group", { name: "Products", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.evaluate(async () => {
    const path = "/src/stores/session-store.ts";
    const { useSessionStore } = await import(path);
    const state = useSessionStore.getState();
    useSessionStore.getState().applyContext({ ...state.context, profile: { ...state.profile, role: "employee" }, permissions: ["sales.create"] });
  });
  const sidebar = page.locator(".sidebar-navigation");
  await expect(sidebar.getByRole("link", { name: "New Sale", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Reports", exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "Employees", exact: true })).toHaveCount(0);
  const dialog = await openSearch(page, "Reports");
  await expect(dialog.getByRole("option", { name: /Reports/ })).toHaveCount(0);
  await expect(dialog).toContainText("No matching results");
  await dialog.getByRole("combobox", { name: "Search modules" }).fill("screen");
  await expect(dialog).toContainText("No matching results");
  for (const group of ["Products", "Services", "Receipts", "Locations"]) await expect(dialog.getByRole("group", { name: group, exact: true })).toHaveCount(0);
});

test("profile Connected Devices can reopen after closing its header deep link", async ({ page }, info) => {
  test.skip(info.config.metadata.api === true, "Local profile fixture");
  await page.goto("/profile");
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole("button", { name: "Open profile menu" }).click();
    await page.getByRole("menuitem", { name: "Connected devices", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Connected Devices", exact: true });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});

test("notification navigation works with keyboard and closes the menu", async ({ page }, info) => {
  test.skip(info.config.metadata.api === true, "Local notifications fixture");
  await page.goto("/dashboard");
  const trigger = page.getByRole("button", { name: "Notifications", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const lowStock = page.getByRole("menuitem", { name: /products are running low/ });
  await expect(lowStock).toBeVisible();
  await page.keyboard.press("Home");
  for (let attempt = 0; attempt < 12 && !(await lowStock.evaluate(element => element === document.activeElement)); attempt++) await page.keyboard.press("ArrowDown");
  await expect(lowStock).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/low-stock$/);
  await expect(page.getByRole("menu", { name: "Notifications" })).toHaveCount(0);
});

test("global search keeps working after one source fails and retries that source", async ({ page }, info) => {
  test.skip(info.config.metadata.api === true, "Local repository failure fixture");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const path = "/src/lib/repositories/index.ts";
    const { repositories } = await import(path);
    const original = repositories.products.pos.bind(repositories.products);
    let failed = false;
    repositories.products.pos = async () => {
      if (!failed) { failed = true; throw new Error("Isolated search failure"); }
      return original();
    };
  });
  const dialog = await openSearch(page, "screen");
  await expect(dialog.getByRole("group", { name: "Services", exact: true })).toBeVisible();
  await expect(dialog).toContainText("Could not search Products");
  await dialog.getByRole("button", { name: "Retry search" }).click();
  await expect(dialog.getByRole("group", { name: "Products", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Retry search" })).toHaveCount(0);
});

test("global search explains empty results and restores focus after Escape", async ({ page }, info) => {
  test.skip(info.config.metadata.api === true, "Local search fixture");
  await page.goto("/dashboard");
  const trigger = page.getByRole("button", { name: "Open global search" });
  await trigger.focus();
  const dialog = await openSearch(page, "zzzzzzzz-no-match");
  await expect(dialog).toContainText("No matching results");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("global search stays inside desktop viewports in both themes with keyboard selection", async ({ page }, info) => {
  test.skip(info.config.metadata.api === true, "Local visual fixture");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  for (const size of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(size);
    for (const theme of ["light", "dark"]) {
      await page.evaluate(async theme => { const path = "/src/stores/ui-store.ts"; (await import(path)).useUiStore.getState().setTheme(theme); }, theme);
      const dialog = await openSearch(page, "screen");
      await expect(dialog.getByRole("group", { name: "Products", exact: true })).toBeVisible();
      await page.keyboard.press("ArrowUp");
      const selected = dialog.getByRole("option", { selected: true });
      await expect(selected).toBeInViewport();
      const rect = await dialog.boundingBox();
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.y).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(size.width);
      expect(rect!.y + rect!.height).toBeLessThanOrEqual(size.height);
      await page.screenshot({ path: `.test-postgres/phase5d-controls/search-${size.width}-${theme}.png` });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    }
  }
});

test("API profile Change Password can reopen after closing its header deep link", async ({ page }, info) => {
  test.skip(info.config.metadata.api !== true, "API authentication fixture");
  await staffUi(page);
  await page.goto("/profile");
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole("button", { name: "Open profile menu" }).click();
    await page.getByRole("menuitem", { name: "Change password", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Change Password", exact: true });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});
