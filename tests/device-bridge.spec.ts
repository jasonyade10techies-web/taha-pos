import { test, expect } from '@playwright/test';

test('normal local-data desktop offers real staff pairing without asking for API mode', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Devices', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pair Staff Phone', exact: true })).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/API mode|limited to tabs in this browser|Local demo pairing/i);
});
