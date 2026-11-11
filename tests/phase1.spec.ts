import {completeSale} from "./fixtures/checkout";
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { allNavigation } from "../src/components/navigation/navigation-data";

test("dashboard, every sidebar link, collapse, global search, and F1 navigation", async ({
  page,
}) => {
  // This check visits every module, including screens that load several records.
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Today's Sales", { exact: true })).toBeVisible();
  await expect(page.locator(".kpi-sales .kpi-value")).not.toContainText("—");
  await expect(
    page.getByRole("img", { name: /sales and gross profit chart/ }),
  ).toBeVisible();
  for (const item of allNavigation) {
    if(["/website-products","/repair-enquiries"].includes(item.path)){await expect(page.getByRole("navigation").getByRole("link",{name:item.label,exact:true})).toHaveCount(0);continue;}
    await page
      .getByRole("navigation")
      .getByRole("link", { name: item.label, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${item.path}$`));
    await expect(
      page.getByRole("heading", {
        name: item.label === "Payments" ? "Payment Methods" : item.label,
        exact: true,
      }),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  await expect(page.locator(".sidebar")).toHaveCSS("width", "72px");
  await page
    .getByRole("button", { name: "Expand sidebar", exact: true })
    .click();
  await expect(page.locator(".sidebar")).toHaveCSS("width", "230px");
  await page.keyboard.press("Control+k");
  const command = page.getByRole("combobox", { name: "Search modules" });
  await expect(command).toBeFocused();
  await command.fill("New Sale");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/pos$/);
  await page.keyboard.press("Control+k");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("F1");
  await expect(page).toHaveURL(/\/pos$/);
  expect(errors).toEqual([]);
});

test("POS search, barcode alias, category, stock limit, add, quantity, remove and totals", async ({
  page,
}) => {
  await page.goto("/pos");
  const search = page.getByRole("textbox", { name: "Search products" });
  await expect(search).toBeFocused();
  await expect(page.getByTestId("cart-total")).toHaveText("PKR 20,300");
  await search.fill("890001");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Add Samsung Galaxy A15 Charging Board",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("cart-total")).toHaveText("PKR 21,750");
  await page
    .getByRole("button", {
      name: "Increase Samsung Galaxy A15 Charging Board quantity",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("cart-total")).toHaveText("PKR 23,200");
  await page
    .getByRole("button", {
      name: "Decrease Samsung Galaxy A15 Charging Board quantity",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("cart-total")).toHaveText("PKR 21,750");
  await page
    .getByRole("button", {
      name: "Remove Samsung Galaxy A15 Charging Board",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("cart-total")).toHaveText("PKR 20,300");
  await search.fill("nothing-matches");
  await expect(page.getByText("No matching products")).toBeVisible();
  await page.getByRole("button", { name: "Reset search" }).click();
  await page.getByRole("tab", { name: "Accessories", exact: true }).click();
  expect(await page.locator(".product-card").count()).toBeGreaterThan(3);
  await expect(
    page.getByRole("button", {
      name: "Add Lightning Charging Cable",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "Phones", exact: true }).click();
  const addPhone = page.getByRole("button", {
    name: "Add Samsung Galaxy A15 · Used",
    exact: true,
  });
  await addPhone.click();
  await addPhone.click();
  await expect(addPhone).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Increase Samsung Galaxy A15 · Used quantity",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(page.locator("body")).not.toContainText(/purchase cost/i);
});

test("negotiated price range, blocked manager approval, coupons and mock checkout", async ({
  page,
}) => {
  await page.goto("/pos");
  await page
    .getByRole("button", {
      name: "Edit 20W USB-C Power Adapter price",
      exact: true,
    })
    .click();
  await expect(page.getByText("Listed Price", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Minimum Allowed", { exact: true }),
  ).toBeVisible();
  const price = page.getByLabel("New Price", { exact: false });
  await price.fill("2000");
  await expect(
    page.getByText("Manager Approval Required", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve & Apply", exact: true }),
  ).toBeDisabled();
  await price.fill("2200");
  await expect(
    page.getByText("Within allowed range", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Reason", { exact: true })
    .and(page.locator('select'))
    .selectOption("Trade Customer");
  await page.getByRole("button", { name: "Apply price", exact: true }).click();
  await expect(page.getByTestId("cart-total")).toHaveText("PKR 20,000");
  await page.getByRole("button", { name: "Add coupon", exact: true }).click();
  await page.getByRole("textbox", { name: "Coupon code" }).fill("INVALID");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Coupon is invalid or inactive.",
  );
  await page.getByRole("textbox", { name: "Coupon code" }).fill("TAHA500");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByTestId("cart-total")).toHaveText("PKR 19,500");
  await page.keyboard.press("F4");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator(".payment-options button").filter({hasText:"JazzCash"}).first().click();
  await page
    .getByRole("switch", { name: "Payment received and verified" })
    .check();
  await completeSale(page);
  await expect(
    page.getByRole("heading", { name: "Sale Complete", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "New Sale", exact: true })
    .last()
    .click();
  await expect(page.getByTestId("cart-total")).toHaveText("PKR 0");
  await expect(page.getByRole("button", { name: /CHECKOUT/ })).toBeDisabled();
});

test("default light, dark persistence, system appearance, UI-only storage and offline preview", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Choose theme" }).click();
  await page.getByRole("menuitem", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.goto("/settings");
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByRole("button", { name: "System", exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass("dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Data / Demo", exact: true }).click();
  await page.getByRole("switch", { name: "Preview offline mode" }).click();
  await expect(page.getByText("OFFLINE MODE", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Saved on this device. Synchronization is not enabled in the local prototype.",
      { exact: false },
    ),
  ).toBeVisible();
  const storage = await page.evaluate(() => ({
    keys: Object.keys(localStorage),
    value: localStorage.getItem("taha-pos-ui"),
  }));
  expect(storage.keys.sort()).toEqual(["taha-device-bridge","taha-pos-ui","taha-terminal-identity"]);
  expect(await page.evaluate(()=>localStorage.getItem('taha-terminal-identity'))).toMatch(/^[0-9a-f-]{36}$/i);
  expect(await page.evaluate(()=>localStorage.getItem("taha-device-bridge"))).not.toMatch(/password|accessToken|refreshToken|purchaseCost|cart/);
  expect(storage.value).not.toMatch(
    /purchaseCost|employee|unitPrice|items|cart/,
  );
});

test("customer display shows only customer-safe cart and updates across browser tabs", async ({
  page,
  context,
}) => {
  await page.goto("/pos");
  await expect(page.getByTestId("cart-total")).toBeVisible();
  while (await page.locator(".cart-remove").count())
    await page.locator(".cart-remove").first().click();
  await page.getByRole("button", {name:"Add Samsung Galaxy A15 Charging Board",exact:true}).click();
  const display = await context.newPage();
  await display.goto("/customer-display");
  await expect(
    display.getByRole("heading", { name: "Your Order", exact: true }),
  ).toBeVisible();
  await expect(display.locator(".display-total")).toContainText("PKR 1,450");
  await page
    .getByRole("button", {
      name: "Add Samsung Galaxy A15 Charging Board",
      exact: true,
    })
    .click();
  await expect(display.locator(".display-total")).toContainText("PKR 2,900");
  await expect(display.locator("body")).not.toContainText(
    /minimum|purchase cost|stock|profit|rack|Ahmed Khan/i,
  );
  await expect(display.getByRole("button")).toHaveCount(0);
  await display.close();
  await page.getByRole("link", { name: "Preview customer display" }).click();
  await expect(page.locator(".display-total")).toContainText("PKR 2,900");
});

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
]) {
  test(`responsive dashboard and POS at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    mkdirSync("docs/screenshots", { recursive: true });
    for (const route of ["dashboard", "pos"]) {
      await page.goto(`/${route}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator(".page-content")).toHaveCSS("opacity", "1");
      await page.evaluate(() => document.fonts.ready);
      if (route === "pos") {
        await expect(
          page.getByRole("button", { name: /CHECKOUT/ }),
        ).toBeInViewport();
        await expect(page.getByTestId("cart-total")).toBeInViewport();
      }
      const overflow = await page.evaluate(() => {
        const main = document.querySelector(".main-content")!;
        return {
          document: document.documentElement.scrollWidth > innerWidth,
          main: main.scrollWidth > main.clientWidth + 1,
        };
      });
      expect(overflow).toEqual({ document: false, main: false });
      await page.screenshot({
        path: `docs/screenshots/${route}-${viewport.width}-light.png`,
      });
      await page.getByRole("button", { name: "Choose theme" }).click();
      await page.getByRole("menuitem", { name: "Dark", exact: true }).click();
      await expect(page.locator("html")).toHaveClass("dark");
      await expect(page.locator(".kpi-card, .product-card").first()).toHaveCSS(
        "border-color",
        "rgb(65, 65, 65)",
      );
      await page.screenshot({
        path: `docs/screenshots/${route}-${viewport.width}-dark.png`,
      });
      await page.getByRole("button", { name: "Choose theme" }).click();
      await page.getByRole("menuitem", { name: "Light", exact: true }).click();
    }
  });
}
