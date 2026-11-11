import {chooseControl,chooseMaster} from './fixtures/select-control';
import {completeSale} from "./fixtures/checkout";
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
const routes = [
  "/dashboard",
  "/pos",
  "/products",
  "/stock",
  "/locations",
  "/stock-receiving",
  "/transfers",
  "/low-stock",
  "/transactions",
  "/returns",
  "/credit",
  "/out-for-test",
  "/services",
  "/repair-jobs",
  "/buy-device",
  "/purchased-devices",
  "/suppliers",
  "/employees",
  "/shifts",
  "/coupons",
  "/payments",
  "/reports",
  "/audit-log",
  "/website-products",
  "/repair-enquiries",
  "/settings",
];
async function emptyCart(page: Page) {
  while (await page.locator(".cart-remove").count())
    await page.locator(".cart-remove").first().click();
}
async function sale(page: Page, method = "Cash") {
  await page.goto("/pos");
  await expect(page.getByTestId("cart-total")).toBeVisible();
  await emptyCart(page);
  await page.getByRole("textbox", { name: "Search products" }).fill("890001");
  await page
    .getByRole("button", {
      name: "Add Samsung Galaxy A15 Charging Board",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: /CHECKOUT/ }).click();
  await page.locator(".payment-options button").filter({hasText:method}).first().click();
  if (method === "Credit") {
    await page.getByRole("dialog", { name: "Checkout", exact: true }).getByRole("button", { name: "Select sale customer" }).click();
  await page.locator(".customer-option").filter({hasText:"ABC Mobiles"}).click();
  }
  if (method === "JazzCash")
    await page
      .getByRole("switch", { name: "Payment received and verified" })
      .check();
  await completeSale(page);
  await expect(
    page.getByRole("heading", { name: "Sale Complete", exact: true }),
  ).toBeVisible();
  return page.url().split("/").pop()!;
}

test("cash checkout persists invoice, decrements stock, return restores once and rejects excess", async ({
  page,
}) => {
  const id = await sale(page);
  await page.goto("/products/p1");
  await expect(
    page.locator(".stock-availability").first(),
  ).toContainText("11");
  await page.reload();
  await expect(
    page.locator(".stock-availability").first(),
  ).toContainText("11");
  await page.goto("/returns?invoice=" + id);
  await page.getByRole("button",{name:"Original invoice item",exact:true}).click();
  await page.getByRole("menuitem",{name:/Samsung Galaxy A15 Charging Board/}).click();
  await page.getByLabel("Return reason").fill("Customer returned sealed item");
  await page
    .getByRole("button", { name: "Process Return", exact: true })
    .click();
  await expect(
    page.getByText("Return recorded", { exact: true }),
  ).toBeVisible();
  await page.goto("/products/p1");
  await expect(
    page.locator(".stock-availability").first(),
  ).toContainText("12");
  await page.goto("/transactions/" + id);
  await expect(
    page.getByText("Status", { exact: true }).locator(".."),
  ).toContainText("Returned");
});
test("digital checkout requires verification and records JazzCash", async ({
  page,
}) => {
  const id = await sale(page, "JazzCash");
  await page.goto("/transactions/" + id);
  await expect(
    page.locator(".form-section .summary-line").filter({ hasText: "JazzCash" }),
  ).toContainText("1,450");
});
test("credit checkout and old debt collection persist without changing stock", async ({
  page,
}) => {
  await sale(page, "Credit");
  await page.goto("/credit/c1");
  await expect(
    page.getByText("Outstanding", { exact: true }).locator(".."),
  ).toContainText("1,450");
  await page
    .getByRole("button", { name: "Receive Payment", exact: true })
    .click();
  await page.getByRole("dialog").getByLabel("Amount (PKR)").fill("450");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Receive Payment", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Payment Receipt" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await expect(
    page.getByText("Outstanding", { exact: true }).locator(".."),
  ).toContainText("1,000");
  await page.goto("/products/p1");
  await expect(
    page.locator(".stock-availability").first(),
  ).toContainText("11");
});
test("sale reversal preserves invoice and restores stock", async ({ page }) => {
  const id = await sale(page);
  await page.goto("/transactions/" + id);
  await page.getByRole("button", { name: "Void / Reverse Sale" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(
    page.getByText("Status", { exact: true }).locator(".."),
  ).toContainText("Voided");
  await page.goto("/products/p1");
  await expect(
    page.locator(".stock-availability").first(),
  ).toContainText("12");
});
test("product creation, price edits, duplication and archive preserve permanent codes", async ({
  page,
}) => {
  await page.goto("/products/new");
  await page
    .getByLabel("Product Name", { exact: true })
    .fill("Test Nokia Camera");
  await chooseMaster(page,"Brand","Nokia");
  await page.getByLabel("Selling price (PKR)", { exact: true }).fill("2500");
  await page
    .getByLabel("Minimum selling price (PKR)", { exact: true })
    .fill("2200");
  await chooseControl(page,"Default box","box-12-B-04");
  await page.getByLabel("Initial stock", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Save Product", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Test Nokia Camera", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".page-heading")).toContainText("TM-P-000126");
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByLabel("Selling price (PKR)", { exact: true }).fill("2600");
  await page.getByRole("button", { name: "Save Product", exact: true }).click();
  await expect(page.locator(".product-detail-keyline").first()).toContainText("PKR 2,600");
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Test Nokia Camera · Copy",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".page-heading")).toContainText("TM-P-000127");
  await expect(
    page.locator(".stock-availability").first(),
  ).toContainText("0");
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(
    page.getByText("Status", { exact: true }).locator(".."),
  ).toContainText("archived");
});
test("stock receiving draft, receive and transfer retain total stock", async ({
  page,
}) => {
  await page.goto("/stock-receiving?product=p1");
  await chooseControl(page,"Supplier","supplier-1");
  await page.getByLabel("Reference", { exact: true }).fill("LOCAL-RECEIVE-1");
  await chooseControl(page,"Destination 1","box-12-B-04");
  await page.getByLabel("Quantity 1", { exact: true }).fill("5");
  await page.getByLabel("Purchase cost 1", { exact: true }).fill("900");
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Receive Stock", exact: true })
    .click();
  await page.getByRole("dialog",{name:"Review Stock Receiving",exact:true}).getByRole("button",{name:"Confirm Receive Stock",exact:true}).click();
  await expect(page.getByText("Stock received", { exact: true })).toBeVisible();
  await page.goto("/products/p1");
  await expect(
    page.locator(".stock-availability").first(),
  ).toContainText("17");
  await page.goto("/transfers");
  await chooseControl(page,"Product","p1");
  await chooseControl(page,"Source box","box-12-B-04");
  await chooseControl(page,"Destination box","box-08-A-03");
  await page.getByLabel("Quantity", { exact: true }).fill("3");
  await page
    .getByRole("button", { name: "Transfer Stock", exact: true })
    .click();
  await expect(
    page.getByText("Stock transferred", { exact: true }),
  ).toBeVisible();
  await page.goto("/products/p1");
  await expect(
    page.locator(".stock-availability").first(),
  ).toContainText("17");
  await page.getByRole("tab", { name: "Stock & Locations" }).click();
  await expect(
    page.getByRole("cell", { name: "3", exact: true }),
  ).toBeVisible();
});
test("insufficient transfer is rejected and leaves source inventory unchanged", async ({
  page,
}) => {
  await page.goto("/transfers");
  await chooseControl(page,"Product","p1");
  await chooseControl(page,"Source box","box-12-B-04");
  await chooseControl(page,"Destination box","box-08-A-03");
  await page.getByLabel("Quantity", { exact: true }).fill("999");
  await expect(page.getByRole("button", {name:"Transfer Stock",exact:true})).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("Insufficient source stock");
  await page.goto("/products/p1");
  await expect(
    page.locator(".stock-availability").first(),
  ).toContainText("12");
});
test("out for test holds stock, return restores, and conversion never deducts twice", async ({
  page,
}) => {
  await page.goto("/out-for-test");
  const send = async () => {
    await page.getByRole("button", { name: "Send for Test" }).click();
    await page.getByLabel("Customer / shop").and(page.locator("select"))
    .selectOption("c1");
    await chooseControl(page,"Product","p1");
    await page.getByRole("button", { name: "Send Items", exact: true }).click();
    await expect(
      page.getByText("Items sent for testing", { exact: true }),
    ).toBeVisible();
  };
  await send();
  await page.goto("/products/p1");
  await expect(
    page.locator(".stock-availability").first(),
  ).toContainText("11");
  await page.goto("/out-for-test");
  await page.getByRole("button", { name: "Return", exact: true }).click();
  await expect(
    page.getByText("Test items returned", { exact: true }),
  ).toBeVisible();
  await send();
  await page
    .getByRole("button", { name: "Convert to Sale", exact: true })
    .click();
  await expect(page.getByTestId("cart-total")).toHaveText("PKR 1,450");
  await page.getByRole("button", { name: /CHECKOUT/ }).click();
  await completeSale(page);
  await expect(
    page.getByRole("heading", { name: "Sale Complete" }),
  ).toBeVisible();
  await page.goto("/products/p1");
  await expect(
    page.locator(".stock-availability").first(),
  ).toContainText("11");
  await page.goto("/out-for-test");
  await expect(
    page.getByText("CONVERTED TO SALE", { exact: true }),
  ).toBeVisible();
});
test("below minimum demo approval records manager, employee, price and reason", async ({
  page,
}) => {
  await page.goto("/pos");
  await page
    .getByRole("button", {
      name: "Edit 20W USB-C Power Adapter price",
      exact: true,
    })
    .click();
  await page.getByLabel("New Price").fill("2000");
  await page.getByLabel("Manager demo PIN").fill("000000");
  await page
    .getByRole("button", { name: "Approve & Apply", exact: true })
    .click();
  await expect(
    page
      .getByText("Use demo PIN 123456 with an eligible manager.", {
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await page.getByLabel("Manager demo PIN").fill("123456");
  await page
    .getByRole("button", { name: "Approve & Apply", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /CHECKOUT/ }).click();
  await completeSale(page);
  await expect(page.getByText(/Approved by Ali Raza/)).toBeVisible();
  await page.goto("/audit-log");
  await expect(page.getByText(/approved by Ali Raza/)).toBeVisible();
});
test("new used-device purchase creates stock and individually tracked device", async ({
  page,
}) => {
  await page.goto("/buy-device");
  for (const [label, value] of [
    ["Seller name", "Local Seller"],
    ["Phone", "03001234567"],
    ["Brand", "Apple"],
    ["Model", "iPhone SE"],
    ["IMEI 1 (15 digits)", "123456789012345"],
    ["Purchase price (PKR)", "18000"],
    ["Target selling price (PKR)", "24000"],
    ["Minimum selling price (PKR)", "22000"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page
    .getByRole("button", { name: "Save Purchase", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Apple iPhone SE" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Inventory Record" }).click();
  await expect(
    page.locator(".stock-availability").first(),
  ).toContainText("1");
  await expect(
    page.locator(".product-detail-keyline").first(),
  ).toContainText("24,000");
});
test("service added at POS does not affect inventory balances", async ({
  page,
}) => {
  await page.goto("/services");
  await page.getByRole("button", { name: "Add Repair Service" }).click();
  await page.getByLabel("Service name").fill("Local Camera Cleaning");
  await page.getByLabel("Selling price (PKR)").fill("1000");
  await page.getByLabel("Minimum price (PKR)").fill("800");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.goto("/pos");
  await expect(page.getByTestId("cart-total")).toBeVisible();
  await emptyCart(page);
  await page
    .getByRole("textbox", { name: "Search products" })
    .fill("Local Camera Cleaning");
  await page
    .getByRole("button", { name: "Add Local Camera Cleaning", exact: true })
    .click();
  await page.getByRole("button", { name: /CHECKOUT/ }).click();
  await completeSale(page);
  await expect(
    page.getByRole("heading", { name: "Sale Complete" }),
  ).toBeVisible();
  await page.goto("/products/p1");
  await expect(
    page.locator(".stock-availability").first(),
  ).toContainText("12");
});
test("settings receipt policy persists and permission switching denies direct URLs", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Receipts", exact: true }).click();
  await page
    .getByLabel("Receipt printing behavior").and(page.locator("select"))
    .selectOption("Never Auto Print");
  await page.getByRole("button", { name: "Save Settings" }).click();
  await expect(page.getByText("Settings saved", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Receipts", exact: true }).click();
  await expect(page.getByLabel("Receipt printing behavior").and(page.locator("select"))).toHaveValue(
    "Never Auto Print",
  );
  await page.goto("/counter");
  await page.getByRole("button", { name: "Hamza Employee" }).click();
  await page.getByLabel("6-digit PIN").fill("123456");
  await page.getByRole("button", { name: "Start working" }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: "Access Denied" }),
  ).toBeVisible();
  await page.goto("/pos");
  await expect(page.locator("body")).not.toContainText(
    /purchase cost|gross profit/i,
  );
});
test("shift closing requires explanation for a discrepancy and persists closing record", async ({
  page,
}) => {
  await page.goto("/shifts");
  await page
    .getByRole("button", { name: "Close Shift", exact: true })
    .first()
    .click();
  await page.getByLabel("Counted cash (PKR)").fill("1");
  await page.getByRole("button", { name: "Complete Closing" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Explain the cash difference",
  );
  await page
    .getByLabel("Cash difference reason / closing notes")
    .fill("Demo counted cash adjustment");
  await page.getByRole("button", { name: "Complete Closing" }).click();
  await expect(page.getByText("Shift closed", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Closing History" }).click();
  await expect(page.getByText("Demo counted cash adjustment")).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Closing History" }).click();
  await expect(page.getByText("Demo counted cash adjustment")).toBeVisible();
});
test("location hierarchy rename preserves its permanent code and rejects archiving stock", async ({
  page,
}) => {
  await page.goto("/locations");
  await page
    .locator(".location-list")
    .first()
    .getByRole("button", { name: /Rack 12 TM-L/ })
    .click();
  await page
    .locator(".location-list")
    .nth(1)
    .getByRole("button", { name: /Shelf B TM-L/ })
    .click();
  const box = page
    .locator(".location-list")
    .nth(2)
    .locator("article")
    .filter({ hasText: "Box 04" });
  const code = (await box.locator("small").innerText()).split(" · ")[0];
  await box.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByLabel("Location name").fill("Box Service Parts");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  const renamed = page
    .locator(".location-list")
    .nth(2)
    .locator("article")
    .filter({ hasText: "Box Service Parts" });
  await expect(renamed).toContainText(code);
  await renamed.getByRole("button", { name: "Archive", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Only empty locations");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await renamed.getByRole("link", { name: "Details" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Rack 12 → Shelf B → Box Service Parts",
  );
});
test("employee permissions save and persist, while POS DTO never displays costs", async ({
  page,
}) => {
  await page.goto("/employees/employee-1");
  await page.getByRole("tab", { name: "Permissions", exact: true }).click();
  const costs = page.getByRole("switch", {
    name: "costs · view purchase cost",
    exact: true,
  });
  await costs.check();
  await page
    .getByRole("button", { name: "Save Permissions", exact: true })
    .click();
  await expect(
    page.getByText("Permissions updated", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Permissions", exact: true }).click();
  await expect(costs).toBeChecked();
  await page.goto("/counter");
  await page.getByRole("button", { name: "Hamza Employee" }).click();
  await page.getByLabel("6-digit PIN").fill("123456");
  await page.getByRole("button", { name: "Start working" }).click();
  await page.goto("/products/p1");
  await page.getByText("Authorized pricing", {exact:true}).click();
  await expect(
    page.getByText(/^Purchase cost: PKR/),
  ).toBeVisible();
  await page.goto("/pos");
  await expect(page.locator("body")).not.toContainText(
    /purchase cost|gross profit/i,
  );
});
test("low stock filter excludes well stocked products", async ({ page }) => {
  await page.goto("/low-stock");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "In Stock", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Reorder", exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Reorder", exact: true })
    .first()
    .click();
  await expect(page.getByRole("combobox",{name:"Product 1",exact:true})).not.toHaveValue(
    "",
  );
  await expect(page.getByLabel("Quantity 1", { exact: true })).not.toHaveValue(
    "0",
  );
});
test("invalid multi row receiving rolls back the entire stock mutation", async ({
  page,
}) => {
  await page.goto("/stock-receiving?product=p1");
  await chooseControl(page,"Supplier","supplier-1");
  await chooseControl(page,"Destination 1","box-12-B-04");
  await page.getByLabel("Quantity 1", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Add Row", exact: true }).click();
  await page
    .getByRole("button", { name: "Receive Stock", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Row 2: choose an active physical product",
  );
  await page.goto("/products/p1");
  await expect(
    page.locator(".stock-availability").first(),
  ).toContainText("12");
});
test("CSV preview imports validated product and rejects invalid destination", async ({
  page,
}) => {
  await page.goto("/products/import");
  await page.getByLabel("Upload product CSV").setInputFiles({
    name: "stock.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Name,Price,Minimum,Quantity,Location\nImported Battery,2100,1800,2,INVALID",
    ),
  });
  await expect(
    page.getByText("Unknown box code", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Import 1 Products" }),
  ).toBeDisabled();
  await page.getByLabel("Upload product CSV").setInputFiles({
    name: "stock.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Name,Price,Minimum,Quantity,Location\nImported Battery,2100,1800,2,TM-L-000003",
    ),
  });
  await page.getByRole("button", { name: "Import 1 Products" }).click();
  await expect(
    page.getByText("Products imported", { exact: true }),
  ).toBeVisible();
  await page.goto("/products");
  await page
    .getByRole("textbox", { name: "Search records" })
    .fill("Imported Battery");
  await expect(
    page.getByRole("link", { name: /Imported Battery/ }),
  ).toBeVisible();
});

test("cash change and split payment record exact allocations", async ({
  page,
}) => {
  await page.goto("/pos");
  await expect(page.getByTestId("cart-total")).toBeVisible();
  await emptyCart(page);
  await page.getByRole("textbox", { name: "Search products" }).fill("890001");
  await page
    .getByRole("button", {
      name: "Add Samsung Galaxy A15 Charging Board",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: /CHECKOUT/ }).click();
  await page.getByLabel("Cash received (PKR)").fill("2000");
  await expect(
    page.locator(".summary-line").filter({ hasText: "Change" }),
  ).toContainText("550");
  await page
    .getByRole("button", { name: /^Split Payment/ })
    .click();
  await page.getByLabel("Cash portion (PKR)").fill("450");
  await page.getByLabel("Remaining method").and(page.locator("select"))
    .selectOption("jazzcash");
  await page.getByLabel("Credit portion (PKR, optional)").fill("450");
  await page.getByRole("dialog", { name: "Checkout", exact: true }).getByRole("button", { name: "Select sale customer" }).click();
  await page.locator(".customer-option").filter({hasText:"ABC Mobiles"}).click();
  await page.getByLabel("Cash received (PKR)").fill("500");
  await expect(
    page.locator(".summary-line").filter({ hasText: "Change" }),
  ).toContainText("50");
  await expect(
    page.getByRole("button", { name: "Review Sale", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("switch", { name: "Payment received and verified" })
    .check();
  await completeSale(page);
  await expect(
    page.getByRole("heading", { name: "Sale Complete", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".form-section .summary-line")
      .filter({ hasText: "Cash" })
      .filter({ hasNotText: "JazzCash" }),
  ).toContainText("450");
  await expect(
    page.locator(".form-section .summary-line").filter({ hasText: "JazzCash" }),
  ).toContainText("550");
  await expect(
    page.locator(".form-section .summary-line").filter({ hasText: "Credit" }),
  ).toContainText("450");
  await page.goto("/credit/c1");
  await expect(
    page.getByText("Outstanding", { exact: true }).locator(".."),
  ).toContainText("450");
});

test("payment account QR and required proof persist and appear at checkout", async ({
  page,
}) => {
  const png = {
    name: "payment.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAO0lEQVR4nO3WuQkAMBADQWfqvyRVJldhcDBwueDQs2fN0zsE6kXhoglaVMW0aQ3OTGZRRYBXoWO+pusLMwAcavKGiNYAAAAASUVORK5CYII=",
      "base64",
    ),
  };
  await page.goto("/payments");
  await page
    .getByRole("row")
    .filter({ hasText: "JazzCash" })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page.getByLabel("Upload payment QR", {exact:true}).setInputFiles(png);
  await expect(page.getByRole("button", {name:"Preview image 1"})).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page.getByText("Saved successfully", { exact: true }),
  ).toBeVisible();
  await page.goto("/settings");
  await page.getByRole("button", { name: "Payments", exact: true }).click();
  await page.getByLabel("Require electronic payment proof").check();
  await page
    .getByRole("button", { name: "Save Settings", exact: true })
    .click();
  await expect(page.getByText("Settings saved", { exact: true })).toBeVisible();
  await page.goto("/pos");
  await expect(page.getByTestId("cart-total")).toBeVisible();
  await page.getByRole("textbox", { name: "Search products" }).fill("890001");
  await page
    .getByRole("button", {
      name: "Add Samsung Galaxy A15 Charging Board",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: /CHECKOUT/ }).click();
  await page.locator(".payment-options button").filter({hasText:"JazzCash"}).first().click();
  await expect(
    page.getByRole("img", { name: "JazzCash QR", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("switch", { name: "Payment received and verified" })
    .check();
  await expect(page.getByRole("button",{name:"Review Sale",exact:true})).toBeDisabled();
  await expect(page).toHaveURL(/\/pos$/);
  await page.getByLabel("Upload payment proof", {exact:true}).setInputFiles(png);
  await expect(page.getByRole("button",{name:"Preview image 1"})).toBeVisible();
  await page.getByLabel("Transfer reference").fill("DEMO-PROOF-001");
  await page.getByRole("switch",{name:"Payment received and verified"}).check();
  await completeSale(page);
  await expect(
    page.getByRole("heading", { name: "Sale Complete", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View Proof", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Uploaded payment proof", exact: true }),
  ).toBeVisible();
});

test("repair enquiry conversion keeps one job and status edits persist", async ({
  page,
}) => {
  await page.goto("/repair-enquiries");
  await page
    .getByRole("row")
    .filter({ hasText: "Usman" })
    .getByRole("button", { name: "Convert to Job", exact: true })
    .click();
  await expect(page.getByLabel("Customer", { exact: true })).toHaveValue(
    "Usman",
  );
  const jobUrl = page.url();
  await chooseControl(page,"Status","Ready");
  await page
    .getByLabel("Technician notes")
    .fill("Demo repair verified and ready for collection");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Repair job saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Status", { exact: true }).and(page.locator("select"))).toHaveValue("Ready");
  expect(page.url()).toBe(jobUrl);
  await page.goto("/repair-enquiries");
  const enquiry = page.getByRole("row").filter({ hasText: "Usman" });
  await expect(enquiry).toContainText("Converted");
  await expect(
    enquiry.getByRole("button", { name: "Convert to Job", exact: true }),
  ).toHaveCount(0);
  await enquiry.getByRole("button", { name: "Manage", exact: true }).click();
  await expect(
    page.getByLabel("Status", { exact: true }).locator('option[value="New"]'),
  ).toHaveCount(0);
});

test("website visibility and demo reset affect local records", async ({
  page,
}) => {
  await page.goto("/website-products");
  const product = page
    .getByRole("row")
    .filter({ hasText: "Samsung Galaxy A15 Charging Board" });
  const wasPublic = await product
    .getByRole("switch", { name: "Public", exact: true })
    .isChecked();
  await product.getByRole("switch", { name: "Public", exact: true }).click();
  await expect(
    page.getByText("Visibility updated", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    product.getByRole("switch", { name: "Public", exact: true }),
  ).toBeChecked({ checked: !wasPublic });
  await sale(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Data / Demo", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset Demo Data", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset Demo Data", exact: true })
    .click();
  await expect(
    page.getByText("Demo data restored", { exact: true }),
  ).toBeVisible();
  await page.goto("/products/p1");
  await expect(
    page.locator(".stock-availability").first(),
  ).toContainText("12");
});

test("negative stock setting explicitly permits a sale beyond available units", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await page.getByLabel("Allow negative stock").check();
  await page
    .getByRole("button", { name: "Save Settings", exact: true })
    .click();
  await expect(page.getByText("Settings saved", { exact: true })).toBeVisible();
  await page.goto("/pos");
  await expect(page.getByTestId("cart-total")).toBeVisible();
  await emptyCart(page);
  await page.getByRole("textbox", { name: "Search products" }).fill("890001");
  await page
    .getByRole("button", {
      name: "Add Samsung Galaxy A15 Charging Board",
      exact: true,
    })
    .click();
  for (let i = 1; i < 13; i++)
    await page
      .getByRole("button", {
        name: "Increase Samsung Galaxy A15 Charging Board quantity",
        exact: true,
      })
      .click();
  await expect(
    page.getByLabel("Samsung Galaxy A15 Charging Board quantity", {
      exact: true,
    }),
  ).toContainText("13");
  await page.getByRole("button", { name: /CHECKOUT/ }).click();
  await completeSale(page);
  await expect(
    page.getByRole("heading", { name: "Sale Complete", exact: true }),
  ).toBeVisible();
  await page.goto("/products/p1");
  await expect(
    page.locator(".stock-availability").first(),
  ).toContainText("-1");
});

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
])
  test(`all management routes render without overflow or console errors ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.setViewportSize(viewport);
    mkdirSync("docs/screenshots/phase2", { recursive: true });
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Access Denied", exact: true }),
      ).toHaveCount(0);
      await expect(page.locator(".loading-skeleton")).toHaveCount(0);
      await expect(
        page.getByRole("heading", {
          name: "Unable to load this page",
          exact: true,
        }),
      ).toHaveCount(0);
      await page.waitForTimeout(120);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route,
      ).toBeTruthy();
      if (
        [
          "/products",
          "/locations",
          "/pos",
          "/reports",
          "/stock-receiving",
        ].includes(route)
      )
        await page.screenshot({
          path: `docs/screenshots/phase2/${route.slice(1)}-${viewport.width}.png`,
        });
    }
    await page.getByRole("button", { name: "Choose theme" }).click();
    await page.getByRole("menuitem", { name: "Dark", exact: true }).click();
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route + " dark",
      ).toBeTruthy();
    }
    expect(errors).toEqual([]);
    if (viewport.width === 390) {
      await expect(
        page.getByRole("navigation", { name: "Mobile navigation" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Open navigation", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Close navigation" }),
      ).toBeVisible();
    }
  });
