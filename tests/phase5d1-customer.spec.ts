import type {Location,PaymentMethod} from "../src/types/demo";
import { test, expect, type Page } from "@playwright/test";
async function account(page: Page) {
  await page.goto("/pos");
  await expect(
    page.getByRole("button", { name: "Custom Service", exact: true }),
  ).toBeVisible();
  return page.evaluate(async () => {
    const { repositories: r } = await import(
      String("/src/lib/repositories/index.ts")
    );
    const settings = await r.settings.get();
    await r.settings.save({
      ...settings,
      returnApproval: false,
      remindersEnabled: true,
    });
    const location = (await r.locations.list()).find(
      (l: Location) => l.kind === "box" && l.stockCondition !== "Damaged",
    )!;
    const original = (await r.products.list())[0];
    const product = await r.products.save({
      ...original,
      id: undefined,
      name: "Workspace Panel",
      sellingPrice: 1000,
      minimumSellingPrice: 800,
      initialQuantity: 4,
      locationId: location.id,
      purchaseCost: 400,
    });
    const customer = await r.customers.save({
      id: crypto.randomUUID(),
      name: "Workspace Ali",
      type: "Individual",
      shopName: "",
      ownerName: "",
      phone: "03001234567",
      collectingPerson: "",
      address: "Market road",
      notes: "Account profile note",
      photo: "",
      creditEnabled: true,
      creditLimit: 10000,
      createdAt: new Date().toISOString(),
    });
    const methods = await r.payments.list(),
      credit = methods.find((m: PaymentMethod) => m.kind === "Credit")!,
      cash = methods.find((m: PaymentMethod) => m.kind === "Cash")!;
    const sale = await r.sales.complete({
      idempotencyKey: crypto.randomUUID(),
      customerId: customer.id,
      coupon: "",
      cashReceived: 0,
      payments: [{ methodId: credit.id, amount: 2000, reference: "" }],
      lines: [{ productId: product.id, quantity: 2, unitPrice: 1000 }],
    });
    await r.credit.receive(
      customer.id,
      500,
      cash.id,
      "workspace payment",
      "Partial collection",
    );
    const returned = await r.sales.returnItem(
      sale.id,
      product.id,
      1,
      "Unused item",
      "Sellable Stock",
      undefined,
      { locationId: location.id, idempotencyKey: crypto.randomUUID() },
    );
    await r.customers.addNote!(customer.id, {
      idempotencyKey: crypto.randomUUID(),
      text: "Agreed to review balance on Friday.",
    });
    return {
      customerId: customer.id,
      productId: product.id,
      saleId: sale.id,
      invoice: sale.invoice,
      returnCode: returned.code,
    };
  });
}
test("coherent customer workspace, exact obligation, clickable typed history and retained filters", async ({
  page,
}) => {
  const fixture = await account(page);
  await page.goto("/customers/" + fixture.customerId);
  await expect(
    page.getByRole("region", { name: "Customer account workspace" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Timeline", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Purchases", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Activity / Ledger", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Balance and next due" }),
  ).toContainText("PKR 500");
  await expect(
    page.getByRole("region", { name: "Upcoming obligations" }),
  ).toContainText("No time limit");
  await expect(
    page.getByRole("region", { name: "Upcoming obligations" }),
  ).toContainText("Taken on");
  await expect(
    page.getByRole("region", { name: "Payment reminder" }),
  ).toContainText("Payment Reminder");
  await page.getByRole("tab", { name: "Returns", exact: true }).click();
  await page
    .getByRole("button", {
      name: new RegExp("Product returned.*" + fixture.returnCode, "i"),
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Unused item");
  await expect(dialog).toContainText("Sellable Stock");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByRole("tab", { name: "Returns", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Purchases", exact: true }).click();
  await page
    .getByRole("button", {
      name: new RegExp("Purchase.*" + fixture.invoice, "i"),
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Workspace Panel");
  await expect(page.getByRole("dialog")).toContainText("Payment history");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page.getByRole("tab", { name: "Payments", exact: true }).click();
  await page.getByRole("button", { name: /Payment received.*TM-PAY/i }).click();
  await expect(page.getByRole("dialog")).toContainText("Partial collection");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page.getByRole("tab", { name: "Notes", exact: true }).click();
  await page.getByRole("button", { name: /Internal account note/i }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Agreed to review balance on Friday.",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await expect(page.locator('input[type="date"]')).toHaveCount(0);
});
test("ledger balances use complete history before pagination and undated/settled dues are truthful", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  const result = await page.evaluate(async () => {
    const model = await import(
      String("/src/features/credit/customer-account.ts")
    );
    const ledger = Array.from({ length: 65 }, (_, i) => ({
      id: String(i).padStart(3, "0"),
      customerId: "x",
      reference: "R" + i,
      description: "Account charge",
      debit: 10,
      credit: 0,
      employeeId: "owner",
      createdAt: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
    }));
    const rows = model.customerLedger(ledger, 650);
    return {
      last: rows.at(-1)?.balance,
      page2: rows.slice(30, 60)[0].balance,
      undated: model.obligationTiming(
        { occurredAt: "2026-10-17", dueAt: undefined },
        Date.parse("2026-10-21T00:00:00Z"),
      ),
      due: model.obligationTiming(
        { occurredAt: "2026-10-17", dueAt: "2026-10-24" },
        Date.parse("2026-10-21T00:00:00Z"),
      ),
    };
  });
  expect(result.last).toBe(650);
  expect(result.page2).toBe(310);
  expect(result.undated.label).toBe("No time limit");
  expect(result.undated.taken).toContain("Time not recorded");
  expect(result.due.label).toContain("3 days left");
});
test("new sale preserves an unrelated populated cart until owner makes a choice", async ({
  page,
}) => {
  const fixture = await account(page);
  await page.evaluate(async ({ productId }) => {
    const { repositories: r } = await import(
      String("/src/lib/repositories/index.ts")
    );
    const { useCartStore } = await import(String("/src/stores/cart-store.ts"));
    useCartStore.getState().add((await r.products.get(productId))!);
    useCartStore.setState({ customerId: "existing-customer" });
  }, fixture);
  await page.goto("/customers/" + fixture.customerId);
  // The cart is an in-memory draft: set it after navigation, as an existing POS session does.
  await page.evaluate(async ({ productId }) => {
    const { repositories: r } = await import(
      String("/src/lib/repositories/index.ts")
    );
    const { useCartStore } = await import(String("/src/stores/cart-store.ts"));
    useCartStore.getState().add((await r.products.get(productId))!);
    useCartStore.setState({ customerId: "existing-customer" });
  }, fixture);
  await page.getByRole("button", { name: "New Sale", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "An existing sale draft is open" }),
  ).toBeVisible();
  expect(
    await page.evaluate(async () => {
      const { useCartStore } = await import(
        String("/src/stores/cart-store.ts")
      );
      return useCartStore.getState().customerId;
    }),
  ).toBe("existing-customer");
  await page
    .getByRole("button", { name: "Use this customer for existing draft" })
    .click();
  await expect(page).toHaveURL(/\/pos$/);
  const cart = await page.evaluate(async () => {
    const { useCartStore } = await import(String("/src/stores/cart-store.ts"));
    return {
      customerId: useCartStore.getState().customerId,
      count: useCartStore.getState().items.length,
    };
  });
  expect(cart.customerId).toBe(fixture.customerId);
  expect(cart.count).toBe(1);
});

test("settled debts remove overdue reminders and malformed numbers never open WhatsApp", async ({
  page,
}) => {
  const fixture = await account(page);
  await page.evaluate(async ({ customerId, productId }) => {
    const { repositories: r } = await import(
      String("/src/lib/repositories/index.ts")
    );
    const customer = await r.customers.get(customerId);
    await r.customers.save({ ...customer, phone: "123" });
    await r.sales.complete({
      idempotencyKey: crypto.randomUUID(),
      customerId,
      creditDueAt: "2026-10-17T12:00:00+05:00",
      coupon: "",
      cashReceived: 0,
      payments: [{ methodId: "credit", amount: 1000, reference: "" }],
      lines: [{ productId, quantity: 1, unitPrice: 1000 }],
    });
  }, fixture);
  await page.goto("/customers/" + fixture.customerId);
  const reminder = page.getByRole("region", { name: "Payment reminder" });
  await expect(
    reminder.getByRole("button", { name: "Open WhatsApp", exact: true }),
  ).toBeDisabled();
  await expect(
    reminder.getByRole("link", { name: "Edit Number" }),
  ).toBeVisible();
  await expect(
    reminder.getByRole("button", { name: "Copy Message" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("region", { name: "Balance and next due" }),
  ).toContainText("Overdue by");
  await page.evaluate(async ({ customerId }) => {
    const { repositories: r } = await import(
      String("/src/lib/repositories/index.ts")
    );
    const balance = await r.customers.outstanding(customerId),
      cash = (await r.payments.list()).find(
        (method: PaymentMethod) => method.kind === "Cash",
      );
    await r.credit.receive(
      customerId,
      balance,
      cash.id,
      "settled",
      "Settled all debts",
    );
  }, fixture);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Balance and next due" }),
  ).toContainText("Settled account");
  await expect(
    page.getByRole("region", { name: "Upcoming obligations" }),
  ).not.toContainText("Overdue");
  await expect(
    page.getByRole("region", { name: "Payment reminder" }),
  ).toContainText("No outstanding payment obligation");
});
test("customer workspace and detail adapt to all requested light and dark viewports", async ({
  page,
}) => {
  const fixture = await account(page);
  await page.goto("/customers/" + fixture.customerId);
  await expect(
    page.getByRole("region", { name: "Customer account workspace" }),
  ).toBeVisible();
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate(async (value) => {
      const { useUiStore } = await import(String("/src/stores/ui-store.ts"));
      useUiStore.getState().setTheme(value);
    }, theme);
    for (const [width, height] of [
      [1920, 1080],
      [1440, 900],
      [1366, 768],
      [1024, 768],
      [390, 844],
      [412, 915],
    ]) {
      await page.setViewportSize({ width, height });
      await expect(
        page.getByRole("region", { name: "Account history" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path:
          "docs/screenshots/phase5d1/customer-" + theme + "-" + width + ".png",
        fullPage: true,
        animations: "disabled",
      });
    }
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole("tab", { name: "Returns", exact: true }).click();
  await page
    .getByRole("button", {
      name: new RegExp("Product returned.*" + fixture.returnCode, "i"),
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Unused item");
  await page.screenshot({
    path: "docs/screenshots/phase5d1/customer-history-detail-dark-1366.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("test items and prepared payment reminders open distinct details without claiming delivery", async ({
  page,
}) => {
  const fixture = await account(page);
  await page.evaluate(async ({ customerId, productId }) => {
    const { repositories: r } = await import(
      String("/src/lib/repositories/index.ts")
    );
    const product = await r.products.get(productId);
    await r.credit.send({
      id: crypto.randomUUID(),
      code: "",
      customerId,
      productId,
      locationId: product.locationId,
      quantity: 1,
      takenDate: "2026-10-21",
      dueDate: "2026-10-24",
      employeeId: "",
      notes: "Inspect this panel before purchase",
      status: "OUT",
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => {} },
    });
  }, fixture);
  await page.goto("/customers/" + fixture.customerId);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => {} },
    }),
  );
  await page.getByRole("tab", { name: "Test Items", exact: true }).click();
  await page.getByRole("button", { name: /Out for Test.*TM-TEST/i }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Inspect this panel before purchase",
  );
  await expect(page.getByRole("dialog")).toContainText("Time not recorded");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page
    .getByRole("region", { name: "Payment reminder" })
    .getByRole("button", { name: "Copy Message" })
    .click();
  await page.getByRole("tab", { name: "Notes", exact: true }).click();
  await page
    .getByRole("button", { name: /Reminder Prepared.*TM-INV/i })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "does not establish delivery",
  );
  await expect(page.getByRole("dialog")).toContainText("Payment Reminder");
});
