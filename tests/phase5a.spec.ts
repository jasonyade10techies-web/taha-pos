import { test, expect, type Page } from "@playwright/test";
import type { SaleInput, PaymentMethod, DemoSettings } from "../src/types/demo";
import type { PosProductRow } from "../src/types/database";

/** Browser IPC contract tests; these do not certify native Windows/DPAPI hardware. */
async function native(page: Page, fail = false) {
  await page.addInitScript(
    ({ fail }) => {
      const calls: { command: string; args: Record<string, unknown> }[] = [],
        cache: Record<string, unknown> = {},
        receipts: unknown[] = [];
      let callbackId = 0;
      const callbacks = new Map<number, (value: unknown) => void>();
      Object.assign(window, {
        isTauri: true,
        __desktopTest: { calls, cache, receipts },
        __TAURI_EVENT_PLUGIN_INTERNALS__: {
          unregisterListener: () => undefined,
        },
        __TAURI_INTERNALS__: {
          metadata: {
            currentWindow: { label: "main" },
            currentWebview: { label: "main" },
          },
          transformCallback: (fn: (value: unknown) => void) => {
            callbacks.set(++callbackId, fn);
            return callbackId;
          },
          unregisterCallback: (id: number) => callbacks.delete(id),
          invoke: async (
            command: string,
            args: Record<string, unknown> = {},
          ) => {
            calls.push({ command, args });
            if (command === "desktop_init") {
              if (fail) throw new Error("Local database unavailable");
              return {
                backend: "https://shop.invalid/api/v1",
                version: "0.5.0",
                database: "SQLite",
                build: "DEVELOPMENT",
              };
            }
            if (command === "desktop_http")
              return {
                status: 401,
                body: btoa(JSON.stringify({ message: "Sign in" })),
                contentType: "application/json",
              };
            if (command === "desktop_cache") {
              if (args.value !== null && args.value !== undefined)
                cache[String(args.name)] = args.value;
              return cache[String(args.name)] ?? null;
            }
            if (command === "desktop_receipts") return receipts;
            if (command === "desktop_queue_sale") {
              receipts.push(args.receipt);
              return args.receipt;
            }
            if (command === "desktop_image")
              return args.data
                ? { id: args.id }
                : { path: "uploaded/photo.webp" };
            if (command === "desktop_offline_context")
              throw new Error("Connect once");
            if (command === "plugin:event|listen") return ++callbackId;
            if (command === "plugin:window|is_fullscreen") return false;
            return null;
          },
        },
      });
    },
    { fail },
  );
  await page.goto("/#/pos");
}
test("bundled startup hands off to main and database failure opens a visible recovery screen", async ({
  page,
}) => {
  await native(page, true);
  await expect(
    page.getByRole("heading", { name: "Something went wrong" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reload App", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset Shop Connection", exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Diagnostics", exact: true }).click();
  await expect(page.locator("#boot-details")).toContainText("Windows 0.5.0");
  const ready = await page.evaluate(() =>
    Reflect.get(window, "__desktopTest").calls.some(
      (c: { command: string }) => c.command === "desktop_ready",
    ),
  );
  expect(ready).toBe(true);
});
test("SQLite adapter scopes cache reads and raw delta merges avoid double reservations", async ({
  page,
}) => {
  await native(page);
  await expect(
    page.getByRole("heading", { name: "New Sale", exact: true }),
  ).toBeVisible();
  const result = await page.evaluate(async () => {
    const db = await import(
      /* @vite-ignore */ "/src/lib/desktop/" + "database.ts"
    );
    await db.sqliteCache("pos-products", [{ id: "battery", quantity: 8 }]);
    await db.sqliteCache("pos-products", undefined, true);
    const sync = await import(
      /* @vite-ignore */ "/src/stores/" + "sync-store.ts"
    );
    sync.useSyncStore.setState({ status: "OFFLINE" });
    const { cachedCounterRead } = await import(
      /* @vite-ignore */ "/src/lib/api/" + "read-cache.ts"
    );
    let fetched = false;
    const rows = await cachedCounterRead("pos-products", async () => {
      fetched = true;
      throw new Error("offline");
    });
    sync.useSyncStore.setState({ status: "ONLINE" });
    const { ApiProductRepository } = await import(
      /* @vite-ignore */ "/src/lib/api/" + "catalog-repositories.ts"
    );
    const cachedProducts = await new ApiProductRepository().pos();
    return {
      rows,
      cachedProducts,
      fetched,
      calls: Reflect.get(window, "__desktopTest").calls.filter(
        (c: { command: string }) => c.command === "desktop_cache",
      ),
    };
  });
  expect(result.fetched).toBe(false);
  expect(result.rows).toEqual([{ id: "battery", quantity: 8 }]);
  expect(result.cachedProducts[0].id).toBe("battery");
  expect(
    result.calls.some(
      (c: { args: { raw: boolean; scope: string } }) =>
        c.args.raw && c.args.scope.includes("https://shop.invalid/api/v1|"),
    ),
  ).toBe(true);
});
test("cash checkout queues one stable invoice and rejects offline credit, coupons and below-minimum prices", async ({
  page,
}) => {
  await native(page);
  await expect(
    page.getByRole("heading", { name: "New Sale", exact: true }),
  ).toBeVisible();
  const result = await page.evaluate(async () => {
    const db = await import(
      /* @vite-ignore */ "/src/lib/desktop/" + "database.ts"
    );
    const { completeDesktopCash } = await import(
      /* @vite-ignore */ "/src/lib/desktop/" + "sales.ts"
    );
    const key = crypto.randomUUID();
    await db.sqliteCache("pos-products", [
      {
        id: "battery",
        internal_code: "TM-P-1",
        name: "Battery",
        category: "Parts",
        selling_price: 1000,
        minimum_selling_price: 900,
        quantity: 8,
        low_stock_level: 2,
      },
    ] as PosProductRow[]);
    await db.sqliteCache("settings", {
      storeName: "Taha Mobiles",
      branch: "Main Branch",
      receiptFooter: "Thank you for choosing Taha Mobiles.",
      taxProfiles: [],
    } as unknown as DemoSettings);
    await db.sqliteCache("payment-methods", [
      { id: "cash", name: "Cash", kind: "Cash", enabled: true },
    ] as PaymentMethod[]);
    const input: SaleInput = {
      cartId: crypto.randomUUID(),
      idempotencyKey: key,
      customerId: "",
      coupon: "",
      cashReceived: 1200,
      payments: [{ methodId: "cash", amount: 1000, reference: "" }],
      lines: [{ productId: "battery", quantity: 1, unitPrice: 1000 }],
    };
    const first = await completeDesktopCash(input),
      second = await completeDesktopCash(input);
    const failures: string[] = [];
    for (const bad of [
      { ...input, idempotencyKey: crypto.randomUUID(), coupon: "SAVE" },
      {
        ...input,
        idempotencyKey: crypto.randomUUID(),
        payments: [{ methodId: "credit", amount: 1000, reference: "" }],
      },
      {
        ...input,
        idempotencyKey: crypto.randomUUID(),
        lines: [{ productId: "battery", quantity: 1, unitPrice: 800 }],
      },
    ]) {
      try {
        await completeDesktopCash(bad);
      } catch (error) {
        failures.push(String(error));
      }
    }
    return {
      first,
      second,
      failures,
      calls: Reflect.get(window, "__desktopTest").calls.filter(
        (c: { command: string }) => c.command === "desktop_queue_sale",
      ),
    };
  });
  expect(result.first.invoice).toMatch(/^TM-INV-O-[A-F0-9-]{36}$/);
  expect(result.second.invoice).toBe(result.first.invoice);
  expect(result.first.change).toBe(200);
  expect(result.first.syncStatus).toBe("PENDING_SYNC");
  expect(result.calls).toHaveLength(1);
  expect(result.failures).toHaveLength(3);
  expect(JSON.stringify(result.calls)).not.toMatch(
    /purchase_cost|purchaseCost|password|refreshToken/,
  );
});
test("queued photo references reuse acknowledged uploads and F11 uses native fullscreen control", async ({
  page,
}) => {
  await native(page);
  await expect(
    page.getByRole("heading", { name: "New Sale", exact: true }),
  ).toBeVisible();
  const value = await page.evaluate(async () => {
    const { preserveDesktopImage, preservedImagePath } = await import(
      /* @vite-ignore */ "/src/lib/desktop/" + "images.ts"
    );
    const data = "data:image/jpeg;base64,/9j/AAAAAAAAAAAAAAAAAAAA";
    const a = await preserveDesktopImage(data, "product"),
      b = await preserveDesktopImage(data, "product");
    return { a, b, path: await preservedImagePath(data, "product") };
  });
  expect(value.a).toBe(value.b);
  expect(value.path).toBe("uploaded/photo.webp");
  await page.keyboard.press("F11");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Reflect.get(window, "__desktopTest").calls.filter(
            (c: { command: string }) =>
              c.command === "plugin:window|set_fullscreen",
          ).length,
      ),
    )
    .toBe(1);
});
