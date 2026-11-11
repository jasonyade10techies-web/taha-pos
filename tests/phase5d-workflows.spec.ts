import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
async function chooseDate(page:Page,label:string,value:string){
 await page.getByRole('button',{name:new RegExp('^'+label+':')}).click();const dialog=page.getByRole('dialog',{name:new RegExp(label)});await dialog.getByRole('spinbutton',{name:'Calendar year',exact:true}).fill(value.slice(0,4));await dialog.getByRole('button',{name:'Calendar month',exact:true}).click();const month=new Date(value+'T12:00:00').toLocaleDateString('en',{month:'long'});await page.getByRole('menuitem',{name:month,exact:true}).click();await dialog.locator('[data-day="'+value+'"]').click();
}


test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === 'passed')
    await page.screenshot({ path: testInfo.outputPath('verified.png') });
});

async function accountFixture(page: Page, extraDue = false) {
  await page.goto('/pos');
  await expect(page.getByRole('button', { name: 'Custom Service', exact: true })).toBeVisible();
  return page.evaluate(async (extraDue) => {
    const path = '/src/lib/repositories/index.ts';
    const r = (await import(path)).repositories;
    const box = (await r.locations.list()).find((l: { kind: string; stockCondition?: string; archived: boolean }) => l.kind === 'box' && l.stockCondition !== 'Damaged' && !l.archived);
    const source = (await r.products.list())[0];
    const product = await r.products.save({ ...source, id: undefined, name: 'Phase5D Audit Panel', sellingPrice: 1000, minimumSellingPrice: 800, initialQuantity: 4, locationId: box.id, purchaseCost: 400 });
    const customer = await r.customers.save({ id: crypto.randomUUID(), name: 'Phase5D Receipts Account', type: 'Individual', shopName: '', ownerName: '', collectingPerson: '', phone: '03001234567', address: '', notes: '', photo: '', creditEnabled: true, creditLimit: 10000, createdAt: new Date().toISOString() });
    const credit = (await r.payments.list()).find((m: { kind: string }) => m.kind === 'Credit');
    const sell = (due: string) => r.sales.complete({ idempotencyKey: crypto.randomUUID(), customerId: customer.id, creditDueAt: due, coupon: '', cashReceived: 0, payments: [{ methodId: credit.id, amount: 2000, reference: '' }], lines: [{ productId: product.id, quantity: 2, unitPrice: 1000 }] });
    const late = '2030-12-20T13:00:00.000Z';
    const sale = await sell(late);
    if (extraDue) await sell('2030-12-10T13:00:00.000Z');
    return { customerId: customer.id, customerName: customer.name, productName: product.name, invoice: sale.invoice };
  }, extraDue);
}

for (const tab of ['Sales', 'Profit', 'Inventory', 'Credit']) {
  test(`Reports ${tab} CSV exports the selected report`, async ({ page }) => {
    const fixture = await accountFixture(page);
    await page.getByRole('link', { name: 'Reports', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await expect(page.locator('.stat-card').first()).toBeVisible();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
    const download = await pending;
    const content = await readFile((await download.path())!, 'utf8');
    if (tab === 'Sales') {
      expect(content).toContain(fixture.invoice);
      expect(content).toContain(fixture.customerName);
    } else if (tab === 'Profit') {
      expect(content).toContain('grossProfit');
      expect(content).not.toContain('quantity');
    } else if (tab === 'Inventory') {
      expect(content).toContain(fixture.productName);
      expect(content).toContain('lowStockLevel');
    } else {
      expect(content).toContain(fixture.customerName);
      expect(content).toContain('"2000"');
    }
  });
}

test('Credit Accounts shows the earliest unpaid due date rather than the oldest invoice date', async ({ page }) => {
  const fixture = await accountFixture(page, true);
  await page.evaluate(async () => {
    const path = '/src/lib/repositories/index.ts';
    const r = (await import(path)).repositories;
    const obligations = await r.customers.reminders();
    // The server orders obligations by capture time; a newer invoice can be due first.
    obligations.sort((a: { dueAt?: string }, b: { dueAt?: string }) => Date.parse(b.dueAt ?? '') - Date.parse(a.dueAt ?? ''));
    r.customers.reminders = async () => obligations;
  });
  await page.getByRole('link', { name: 'Credit Accounts', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: fixture.customerName });
  await expect(row).toContainText(/10[- ]Dec[- ]2030/);
  await expect(row).not.toContainText(/20[- ]Dec[- ]2030/);
});

test('Customer receipts provides the complete paginated list after the first hundred', async ({ page }) => {
  const fixture = await accountFixture(page);
  await page.evaluate(async (customerId) => {
    const repositoryPath = '/src/lib/repositories/index.ts', databasePath = '/src/lib/local/database.ts';
    const r = (await import(repositoryPath)).repositories, { demoDb } = await import(databasePath);
    const sale = (await r.sales.list()).find((s: { customerId: string }) => s.customerId === customerId);
    // Historical invoice fixtures exercise list pagination without introducing 100 unrelated financial mutations.
    await demoDb.sales.bulkPut(Array.from({ length: 101 }, (_, i) => ({ ...sale, id: crypto.randomUUID(), invoice: `PH5D-HISTORY-${String(i).padStart(3, '0')}`, createdAt: new Date(Date.now() - (i + 1) * 1000).toISOString() })));
  }, fixture.customerId);
  await page.goto('/customers/' + fixture.customerId);
  await page.getByRole('tab', { name: 'Purchases', exact: true }).click();
  const all = page.getByRole('link', { name: 'View All Receipts', exact: true });
  await expect(all).toBeVisible();
  await all.click();
  await expect(page).toHaveURL(new RegExp('/transactions\\?customer=' + fixture.customerId));
  await expect(page.getByText('Showing this customer\'s receipts.', { exact: false })).toBeVisible();
  await expect(page.locator('body')).toContainText('102');
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByRole('link', { name: 'PH5D-HISTORY-024', exact: false })).toBeVisible();
});

for (const allowed of [true, false]) {
  test(`Server report inventory is explicitly ${allowed ? 'unavailable with stock navigation' : 'restricted'} instead of empty exported stock`, async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
    await page.evaluate(async (allowed) => {
      const repositoryPath = '/src/lib/repositories/index.ts', sessionPath = '/src/stores/session-store.ts';
      const r = (await import(repositoryPath)).repositories;
      const snapshot = await r.reports.snapshot();
      snapshot.aggregate = { summary: { sales: 0, transactions: 0, returns: 0, discounts: 0, creditGiven: 0, debtCollected: 0, cash: 0, digital: 0 }, profit: null, chart: [], methods: [], top: [], employees: [], credit: [], recentSales: [] };
      snapshot.products = [];
      r.reports.snapshot = async () => snapshot;
      if (!allowed) {
        const { useSessionStore } = await import(sessionPath), old = useSessionStore.getState();
        useSessionStore.setState({ profile: { ...old.profile, role: 'employee' }, permissions: ['reports.view', 'reports.export'] });
      }
      window.dispatchEvent(new Event('taha-remote-changed'));
    }, allowed);
    // Changing the range forces a fresh read through the real report component.
    await chooseDate(page,'Report start date','2026-01-01');
    await page.getByRole('tab', { name: 'Inventory', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Export CSV', exact: true })).toBeDisabled();
    const stock = page.getByRole('link', { name: 'Open Stock', exact: true });
    if (allowed) await expect(stock).toHaveAttribute('href', '/stock');
    else {
      await expect(stock).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Inventory access restricted', exact: true })).toBeVisible();
    }
  });
}

test('Server Sales report labels its recent sample and opens the complete date-filtered receipts', async ({ page }) => {
  const fixture = await accountFixture(page);
  await page.evaluate(async (customerId) => {
    const repositoryPath = '/src/lib/repositories/index.ts', databasePath = '/src/lib/local/database.ts';
    const r = (await import(repositoryPath)).repositories, { demoDb } = await import(databasePath);
    const sale = (await r.sales.list()).find((row: { customerId: string }) => row.customerId === customerId);
    await demoDb.sales.bulkPut(Array.from({ length: 27 }, (_, i) => ({ ...sale, id: crypto.randomUUID(), invoice: `PH5D-PERIOD-${String(i).padStart(3, '0')}`, createdAt: i === 26 ? '2030-12-12T13:00:00.000Z' : `2030-12-10T13:${String(i).padStart(2, '0')}:00.000Z` })));
    const snapshot = await r.reports.snapshot('2030-12-10', '2030-12-11');
    snapshot.sales = snapshot.sales.slice(0, 25);
    snapshot.aggregate = { summary: { sales: 52000, transactions: 26, returns: 0, discounts: 0, creditGiven: 52000, debtCollected: 0, cash: 0, digital: 0 }, profit: null, chart: [], methods: [], top: [], employees: [], credit: [], recentSales: snapshot.sales };
    r.reports.snapshot = async () => snapshot;
  }, fixture.customerId);
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await chooseDate(page,'Report end date','2030-12-11');
  await chooseDate(page,'Report start date','2030-12-10');
  await page.getByRole('tab', { name: 'Sales', exact: true }).click();
  await expect(page.getByText(/Recent receipts.*25/)).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Recent Receipts CSV', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toContain('recent-receipts');
  const content = await readFile((await download.path())!, 'utf8');
  expect(content).toContain('Recent receipts');
  await page.getByRole('link', { name: 'View All Receipts', exact: true }).click();
  await expect(page).toHaveURL(/\/transactions\?from=2030-12-10&to=2030-12-11/);
  await expect(page.getByRole('button',{name:/^Transaction start date:/})).toHaveAttribute('aria-label',/2030-12-10/);
  await expect(page.getByRole('button',{name:/^Transaction end date:/})).toHaveAttribute('aria-label',/2030-12-11/);
  await expect(page.locator('.table-pagination')).toContainText('26 records');
  await expect(page.getByRole('link', { name: 'PH5D-PERIOD-026', exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByRole('link', { name: 'PH5D-PERIOD-000', exact: false })).toBeVisible();
});

test('Transactions preserves exact-date links and clearly rejects inverted ranges', async ({ page }) => {
  await page.goto('/transactions?date=2030-12-10');
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
  await expect(page.getByRole('button',{name:/^Transaction start date:/})).toHaveAttribute('aria-label',/2030-12-10/);
  await expect(page.getByRole('button',{name:/^Transaction end date:/})).toHaveAttribute('aria-label',/2030-12-10/);
  await page.goto('/transactions?from=2030-12-12&to=2030-12-10');
  await expect(page.getByRole('alert')).toContainText('Start date must be on or before end date.');
  await expect(page.locator('.management-table')).toHaveCount(0);
  await chooseDate(page,'Transaction end date','2030-12-13');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('No records match your filters', { exact: true })).toBeVisible();
});
