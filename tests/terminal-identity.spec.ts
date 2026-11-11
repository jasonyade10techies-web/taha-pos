import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const pairedTerminal = randomUUID();
async function terminal(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const uiPath = '/src/stores/ui-store.ts', bridgePath = '/src/stores/device-bridge-store.ts';
    const { useUiStore } = await import(uiPath);
    const { useDeviceBridgeStore } = await import(bridgePath);
    return { ui: useUiStore.getState().terminalId, bridge: useDeviceBridgeStore.getState().terminalId };
  });
}
test('existing paired UUID replaces a legacy short UI ID without changing the phone identity', async ({ page }) => {
  const device = randomUUID();
  await page.addInitScript(({ pairedTerminal, device }) => {
    if (!localStorage.getItem('identity-fixture')) {
      localStorage.setItem('taha-pos-ui', JSON.stringify({ version: 1, state: { terminalId: 'terminal-12345678' } }));
      localStorage.setItem('taha-device-bridge', JSON.stringify({ version: 1, state: { terminalId: pairedTerminal, deviceId: device, terminalName: 'Main Counter' } }));
      localStorage.setItem('identity-fixture', '1');
    }
  }, { pairedTerminal, device });
  await page.goto('/');
  expect(await terminal(page)).toEqual({ ui: pairedTerminal, bridge: pairedTerminal });
  expect(await page.evaluate(async () => {
    const path = '/src/stores/device-bridge-store.ts';
    return (await import(path)).useDeviceBridgeStore.getState().deviceId;
  })).toBe(device);
  await page.reload();
  expect(await terminal(page)).toEqual({ ui: pairedTerminal, bridge: pairedTerminal });
});
test('fresh UI and bridge use one valid UUID that survives reload', async ({ page }) => {
  await page.goto('/');
  const first = await terminal(page);
  expect(first.ui).toMatch(/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);
  expect(first.bridge).toBe(first.ui);
  await page.reload();
  expect(await terminal(page)).toEqual(first);
});
test('valid legacy UI UUID is retained when no bridge pairing exists', async ({ page }) => {
  const id = randomUUID();
  await page.addInitScript(id => {
    localStorage.setItem('taha-pos-ui', JSON.stringify({ version: 1, state: { terminalId: id } }));
  }, id);
  await page.goto('/');
  expect(await terminal(page)).toEqual({ ui: id, bridge: id });
});
test('malformed legacy storage cannot produce a short or mismatched terminal identity', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('taha-pos-ui', JSON.stringify({ version: 1, state: { terminalId: 123 } }));
    localStorage.setItem('taha-device-bridge', JSON.stringify({ version: 1, state: { terminalId: 'bad' } }));
  });
  await page.goto('/');
  const ids = await terminal(page);
  expect(ids.ui).toMatch(/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);
  expect(ids.bridge).toBe(ids.ui);
});
