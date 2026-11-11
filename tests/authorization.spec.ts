import { test, expect, type Page } from "@playwright/test";
const uid = "20000000-0000-4000-8000-000000000003";
const branch = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Taha Mobiles",
  branch_name: "Main Branch",
};
type Fixture = {
  terminal?: boolean;
  permissions?: string[];
  inactive?: boolean;
  error?: boolean;
  token?: boolean;
};
async function backend(page: Page, fixture: Fixture = {}) {
  const requests: string[] = [];
  const user = {
    id: uid,
    email: "hamza@example.invalid",
    role: "authenticated",
    aud: "authenticated",
    app_metadata: { provider: "email" },
    user_metadata: { role: "owner" },
    created_at: new Date().toISOString(),
  };
  const jwt = [
    "eyJhbGciOiJIUzI1NiJ9",
    Buffer.from(
      JSON.stringify({
        sub: uid,
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "test-signature",
  ].join(".");
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    const json = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (path === "/auth/v1/token")
      return json({
        access_token: jwt,
        refresh_token: "test-only-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        user,
      });
    if (path === "/auth/v1/user") return json(user);
    if (path === "/auth/v1/logout") return json({});
    if (path === "/rest/v1/rpc/get_session_context") {
      if (fixture.error)
        return json({ code: "42501", message: "Access denied" }, 403);
      const active =
        !fixture.terminal ||
        (fixture.token &&
          route.request().headers()["x-counter-session"] === "a".repeat(64));
      return json({
        profile: active
          ? {
              id: uid,
              full_name: "Hamza",
              email: user.email,
              role: "employee",
              status: fixture.inactive ? "inactive" : "active",
              phone: null,
              avatar_url: null,
            }
          : null,
        permissions: fixture.permissions ?? ["sales.create"],
        store: active ? branch : null,
        terminal: fixture.terminal ?? false,
        counter_expires_at:
          fixture.terminal && active
            ? new Date(Date.now() + 3600000).toISOString()
            : null,
      });
    }
    if (path === "/rest/v1/rpc/get_pos_products")
      return json([
        {
          id: "safe-product",
          internal_code: "TM-P-000001",
          name: "Test battery",
          category: "Parts",
          brand: "Samsung",
          compatible_model: "Galaxy A15",
          quality_grade: "Grade A",
          color_variant: "Black",
          quantity: 12,
          selling_price: 2500,
          minimum_selling_price: 2200,
          aliases: [],
          low_stock_level: 5,
          location: { rack: "Rack 12", shelf: "Shelf B", box: "Box 04" },
        },
      ]);
    if (path === "/rest/v1/rpc/list_counter_employees")
      return json([
        { id: uid, full_name: "Hamza", role: "employee", avatar_url: null },
      ]);
    if (path === "/rest/v1/rpc/verify_counter_pin") {
      fixture.token = true;
      return json({
        ok: true,
        token: "a".repeat(64),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        session_id: "test-session",
      });
    }
    if (path === "/rest/v1/rpc/lock_counter_session") {
      fixture.token = false;
      return json(null);
    }
    if(path==="/rest/v1/rpc/get_dashboard_transactions") return json({summary:null,profit:null,chart:[],activity:[],credit:[]});
    if(path==="/rest/v1/rpc/get_business_settings") return json({negativeStock:false,creditEnabled:false,bargaining:true,belowMinimum:"Block"});
    if(path==="/rest/v1/rpc/transaction_data") return json([]);
    return json({ code: "42501", message: "Access denied" }, 403);
  });
  return requests;
}
async function login(page: Page) {
  await page.getByLabel("Email", { exact: true }).fill("hamza@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
}

test("live mode protects URLs, ignores owner metadata and enforces direct permission guards", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const requests = await backend(page);
  await page.goto("/employees");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeDisabled();
  await login(page);
  await expect(page).toHaveURL(/\/pos$/);
  await expect(page.getByText("Development · Mock owner")).toHaveCount(0);
  await expect(page.getByTestId("cart-total")).toHaveText("PKR 0");
  await page
    .getByRole("button", { name: "Add Test battery", exact: true })
    .click();
  await expect(page.getByTestId("cart-total")).toHaveText("PKR 2,500");
  await expect(
    page.getByRole("button", { name: "Edit Test battery price" }),
  ).toBeDisabled();
  await expect(page.locator("body")).not.toContainText(
    /purchase cost|profit margin/,
  );
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: "Access Denied" }),
  ).toBeVisible();
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Access Denied" }),
  ).toBeVisible();
  expect(requests.some((p) => /financial|profit/.test(p))).toBe(false);
  await page.goto("/pos");
  await page.getByRole("button", { name: "Open profile menu" }).click();
  await page.getByRole("menuitem", { name: "Sign Out", exact: true }).click();
  await page.getByRole("dialog", {name:"Sign out of account?"}).getByRole("button", {name:"Sign Out",exact:true}).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/pos");
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});
test("inactive profile cannot enter the application", async ({ page }) => {
  await backend(page, { inactive: true });
  await page.goto("/login");
  await login(page);
  await expect(page.getByRole("alert")).toContainText(
    "not assigned to an active employee profile",
  );
  await page.goto("/pos");
  await expect(page).toHaveURL(/\/login$/);
});
test("dashboard permission does not cause a profit request or demo financial disclosure", async ({
  page,
}) => {
  const requests = await backend(page, { permissions: ["sales.view"] });
  await page.goto("/login");
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".kpi-profit")).toContainText("Restricted");
  await expect(page.locator(".kpi-profit")).not.toContainText("68,400");
  expect(requests.some((p) => /financial|profit/.test(p))).toBe(false);
});
test("terminal unlock uses RPC token, switches identity and locks on reload", async ({
  page,
}) => {
  const requests = await backend(page, { terminal: true });
  await page.goto("/login");
  await login(page);
  await expect(page).toHaveURL(/\/counter$/);
  await page.getByRole("button", { name: "Hamza Employee" }).click();
  await page.getByLabel("6-digit PIN").fill("739182");
  await page.getByRole("button", { name: "Start working" }).click();
  await expect(page).toHaveURL(/\/pos$/);
  await expect(
    page.getByRole("button", { name: "Open profile menu" }),
  ).toHaveText("H");
  const storage = await page.evaluate(() => ({
    local: Object.values(localStorage).join(""),
    session: Object.values(sessionStorage).join(""),
  }));
  expect(JSON.stringify(storage)).not.toContain("a".repeat(64));
  expect(JSON.stringify(storage)).not.toContain("739182");
  await page
    .getByRole("button", { name: "Add Test battery", exact: true })
    .click();
  await expect(page.getByTestId("cart-total")).toHaveText("PKR 2,500");
  await page.reload();
  await expect(page).toHaveURL(/\/counter$/);
  await page.getByRole("button", { name: "Hamza Employee" }).click();
  await page.getByLabel("6-digit PIN").fill("739182");
  await page.getByRole("button", { name: "Start working" }).click();
  await expect(page).toHaveURL(/\/pos$/);
  await page.getByRole("button", { name: "Open profile menu" }).click();
  await page.getByRole("menuitem", { name: "Sign Out", exact: true }).click();
  await page.getByRole("dialog", {name:"Sign out of account?"}).getByRole("button", {name:"Sign Out",exact:true}).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect
    .poll(() => requests.includes("/rest/v1/rpc/lock_counter_session"))
    .toBe(true);
});
test("public customer display stays empty and safe without authentication", async ({
  page,
}) => {
  await backend(page);
  await page.goto("/customer-display");
  await expect(
    page.getByRole("heading", { name: "Everything your phone needs." }),
  ).toBeVisible();
  await expect(page.locator(".display-total")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    /purchase|minimum|inventory|profit|Hamza/,
  );
});
test("permission revocation and auth expiry clear cart and customer display", async ({
  page,
  context,
}) => {
  const fixture: Fixture = { permissions: ["sales.create"] };
  await backend(page, fixture);
  await page.goto("/login");
  await login(page);
  await expect(page).toHaveURL(/\/pos$/);
  const display = await context.newPage();
  await backend(display);
  await display.goto("/customer-display");
  await page
    .getByRole("button", { name: "Add Test battery", exact: true })
    .click();
  await expect(display.locator(".display-total")).toContainText("PKR 2,500");
  fixture.permissions = [];
  await page.evaluate(() =>
    window.dispatchEvent(new Event("taha-session-refresh")),
  );
  await expect(
    page.getByRole("heading", { name: "Access Denied" }),
  ).toBeVisible();
  await expect(
    display.getByRole("heading", { name: "Everything your phone needs." }),
  ).toBeVisible();
  await expect(display.locator(".display-total")).toHaveCount(0);
  // A session removal from another window is reported by the real SDK's storage listener.
  await page.evaluate(() => {
    localStorage.removeItem("taha-pos-auth");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "taha-pos-auth",
        newValue: null,
        storageArea: localStorage,
      }),
    );
    window.dispatchEvent(new Event("taha-session-refresh"));
  });
  await expect(page).toHaveURL(/\/login$/);
  await display.close();
});
