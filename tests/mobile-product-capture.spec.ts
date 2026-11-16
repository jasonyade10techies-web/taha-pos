import { test, expect, type Page } from "@playwright/test";
import { staffUi } from "./fixtures/staff-ui";
const store = "10000000-0000-4000-8000-000000000001";
async function catalog(
  page: Page,
  { denyCreate = false, uploadFailure = false, lostSave = false } = {},
) {
  await staffUi(page);
  const products: Record<string, unknown>[] = [];
  const posts: Record<string, unknown>[] = [];
  let uploads = 0,
    fail = uploadFailure;
  const context = {
    profile: {
      id: "50000000-0000-4000-8000-000000000001",
      full_name: "Mobile Owner",
      email: "owner@fixture.test",
      role: denyCreate ? "employee" : "owner",
      status: "active",
    },
    permissions: denyCreate ? ["inventory.view"] : [],
    store: { id: store, name: "Test Shop", branch_name: "Main" },
    terminal: false,
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    let json: unknown = [];
    if (path.endsWith("/auth/refresh") || path.endsWith("/auth/login"))
      json = { accessToken: "fixture-token", context };
    else if (path.endsWith("/auth/session")) json = context;
    else if (path.endsWith("/health"))
      json = { status: "ok", database: "connected" };
    else if (path.endsWith("/dashboard"))
      json = {summary:{sales:0,cash:0,creditGiven:0,digital:0,returns:0},profit:0,chart:[],activity:[],credit:[]};
    else if (path.endsWith("/mobile/my-shift")) json = null;
    else if (path.endsWith("/shop-configuration"))
      json = {
        version: 1,
        operatingMode: "owner-only",
        setupCompleted: true,
        setupRequired: false,
        enabledFeatures: {},
      };
    else if (path.endsWith("/settings"))
      json = {
        shopConfiguration: {
          setupCompleted: true,
          setupRequired: false,
          operatingMode: "owner-only",
        },
      };
    else if (path.endsWith("/products/pos"))
      json = products.map((p) => ({ ...p, quantity: 0, location: null }));
    else if (path.endsWith("/products") && request.method() === "POST") {
      const body = request.postDataJSON();
      posts.push(body);
      const previous = products.find((p) => p.id === body.id);
      if (previous)
        return route.fulfill({
          status: 409,
          json: { message: "Record changed; reload before saving" },
        });
      const row = {
        ...body,
        selling_price: Number(body.selling_price).toFixed(2),
        minimum_selling_price: Number(body.minimum_selling_price).toFixed(2),
        store_id: store,
        internal_code: "TM-P-000001",
        created_at: "2026-11-16T12:00:00Z",
        updated_at: "2026-11-16T12:00:00Z",
        created_by: context.profile.id,
      };
      products.push(row);
      if (lostSave)
        return route.fulfill({
          status: 503,
          json: { message: "Reply lost after commit" },
        });
      json = row;
    } else if (/\/products\/[a-f0-9-]+$/.test(path))
      json = products.find((p) => p.id === path.split("/").at(-1)) ?? null;
    else if (path.endsWith("/media") && request.method() === "POST") {
      uploads++;
      if (fail) {
        fail = false;
        return route.fulfill({
          status: 503,
          json: { message: "Photo upload interrupted. Retry." },
        });
      }
      const id = "20000000-0000-4000-8000-" + String(uploads).padStart(12, "0");
      json = {
        id,
        path: store + "/30000000-0000-4000-8000-000000000001/" + id + ".webp",
        url: "",
        mimeType: "image/webp",
      };
    } else if (path.endsWith("/media")) {
      const p = products.find((p) => p.id === url.searchParams.get("entityId"));
      json = ((p?.media_paths || []) as string[]).map((path, i) => ({
        id: path.split("/").at(-1)?.split(".")[0],
        path,
        primary: i === 0,
      }));
    } else if (path.endsWith("/media/urls")) json = {};
    else if (path.endsWith("/sync/changes"))
      json = { revision: 0, changed: false, modules: [] };
    await route.fulfill({ json });
  });
  await page.goto("/#/mobile");
  await page
    .getByLabel("Shop Address", { exact: true })
    .fill("http://192.168.50.25:3001");
  await page
    .getByRole("button", { name: "Test Connection", exact: true })
    .click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.locator(".staff-app")).toBeVisible();
  // Connect changes the route after session refresh; wait for that transition
  // before opening Products rather than racing its pending hash navigation.
  await expect(
    page.getByRole("heading", { name: "Hello, Mobile", exact: true }),
  ).toBeVisible();
  await page.goto("/#/mobile/products");
  await expect(
    page.getByRole("heading", { name: "Products", exact: true }),
  ).toBeVisible();
  return { products, posts, uploadCount: () => uploads };
}
async function photo(page: Page, label = "Take product photo") {
  const bytes = await page.evaluate(
    (color) => {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 160;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 160, 160);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    label === "Take product photo" ? "#edc04b" : "#9e3450",
  );
  await page.getByLabel(label, { exact: true }).setInputFiles({
    name: "phone-product.png",
    mimeType: "image/png",
    buffer: Buffer.from(bytes, "base64"),
  });
  await expect(
    page.getByRole("button", { name: "Save Product", exact: true }),
  ).toBeEnabled();
}
test("phone creates a product with captured and gallery photos without counter pairing", async ({
  page,
}) => {
  const state = await catalog(page);
  await page.getByRole("button", { name: "Add Product", exact: true }).click();
  const price = page.getByLabel("Selling price (PKR)", { exact: true });
  await expect(price).toHaveValue("");
  expect((await price.boundingBox())!.height).toBeGreaterThanOrEqual(40);
  await page
    .getByLabel("Product Name", { exact: true })
    .fill("Phone uploaded battery");
  await price.fill("3600");
  await page
    .getByLabel("Minimum selling price (PKR)", { exact: true })
    .fill("3000");
  await photo(page);
  await photo(page, "Upload product images");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".test-postgres/mobile-product-capture/add-product-phone.png",
  });
  await page.getByRole("button", { name: "Save Product", exact: true }).click();
  await expect(
    page.getByText("Product and 2 photos saved", { exact: true }),
  ).toBeVisible();
  expect(state.products).toHaveLength(1);
  expect(state.posts[0].media_paths).toHaveLength(2);
  expect(state.posts[0]).not.toHaveProperty("purchase_cost");
  expect(state.posts[0]).not.toHaveProperty("initial_quantity");
  await page.reload();
  const detail = page.getByRole("dialog", {
    name: "Phone uploaded battery",
    exact: true,
  });
  await expect(detail).toBeVisible();
  await detail
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await expect(
    page
      .getByRole("button")
      .filter({ hasText: "Phone uploaded battery" })
      .first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
test("upload failure retains the form and photo; retry creates only one product", async ({
  page,
}) => {
  const state = await catalog(page, { uploadFailure: true });
  await page.getByRole("button", { name: "Add Product", exact: true }).click();
  await page
    .getByLabel("Product Name", { exact: true })
    .fill("Retry phone photo");
  await page.getByLabel("Selling price (PKR)", { exact: true }).fill("500");
  await photo(page);
  await page.getByRole("button", { name: "Save Product", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Add Product", exact: true })
      .getByRole("alert")
      .filter({ hasText: "Photo upload interrupted" }),
  ).toBeVisible();
  await expect(page.getByLabel("Product Name", { exact: true })).toHaveValue(
    "Retry phone photo",
  );
  expect(state.posts).toHaveLength(0);
  await page.getByRole("button", { name: "Save Product", exact: true }).click();
  await expect(
    page.getByText("Product and 1 photo saved", { exact: true }),
  ).toBeVisible();
  expect(state.products).toHaveLength(1);
});
test("lost create acknowledgement is confirmed by readback without duplicate product", async ({
  page,
}) => {
  const state = await catalog(page, { lostSave: true });
  await page.getByRole("button", { name: "Add Product", exact: true }).click();
  await page
    .getByLabel("Product Name", { exact: true })
    .fill("Confirmed on readback");
  await page.getByLabel("Selling price (PKR)", { exact: true }).fill("800");
  await page.getByRole("button", { name: "Save Product", exact: true }).click();
  await expect(page.getByText("Product saved", { exact: true })).toBeVisible();
  expect(state.posts).toHaveLength(1);
  expect(state.products).toHaveLength(1);
});
test("inventory viewer cannot open product creation", async ({ page }) => {
  await catalog(page, { denyCreate: true });
  await expect(
    page.getByRole("button", { name: "Add Product", exact: true }),
  ).toHaveCount(0);
});
test("a corrupt selected photo cannot be silently omitted by saving", async ({
  page,
}) => {
  const state = await catalog(page);
  await page.getByRole("button", { name: "Add Product", exact: true }).click();
  await page
    .getByLabel("Product Name", { exact: true })
    .fill("Keep my failed photo");
  await page.getByLabel("Selling price (PKR)", { exact: true }).fill("500");
  await page
    .getByLabel("Upload product images", { exact: true })
    .setInputFiles({
      name: "broken.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    });
  await expect(
    page.getByRole("button", { name: "Save Product", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Retry or remove failed photos before saving.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.posts).toHaveLength(0);
});
