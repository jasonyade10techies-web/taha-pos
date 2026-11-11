import { test, expect } from "@playwright/test";
test("mock logout, protected redirect, explicit owner login, profile and PIN preview", async ({
  page,
}) => {
  test.setTimeout(90_000);await page.goto("/pos");
  await expect(
    page.getByRole("heading", { name: "New Sale", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open profile menu" }).click();
  await page.getByRole("menuitem", { name: "Sign Out", exact: true }).click();
  await page.getByRole("dialog", {name:"Sign out of account?"}).getByRole("button", {name:"Sign Out",exact:true}).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByText("Development mock mode", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/employees");
  await expect(page).toHaveURL(/\/login$/);
  await page
    .getByRole("button", { name: "Enter mock owner workspace" })
    .click();
  await expect(page).toHaveURL(/\/employees$/);
  await page.getByRole("button", { name: "Open profile menu" }).click();
  await page.getByRole("menuitem", { name: "Profile", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your Profile" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save profile" }),
  ).toBeEnabled();
  await page.getByLabel("Phone", { exact: true }).fill("0300 1112233");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText("Profile updated.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Phone", { exact: true })).toHaveValue(
    "0300 1112233",
  );
  await page.getByRole("button", { name: "Open profile menu" }).click();
  await page.getByRole("menuitem", { name: "Switch employee" }).click();
  await expect(
    page.getByRole("heading", { name: "Who’s working?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hamza Employee" }).click();
  await page.screenshot({ path: "docs/screenshots/counter-pin-light.png" });
  await page.getByLabel("6-digit PIN").fill("123456");
  await expect(
    page.getByRole("button", { name: "Start working" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Start working" }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page.goto("/employees");
  await expect(
    page.getByRole("heading", { name: "Access Denied", exact: true }),
  ).toBeVisible();
  await page.goto("/pos");
  await expect(page.locator("body")).not.toContainText(
    /purchase cost|gross profit/i,
  );
});
