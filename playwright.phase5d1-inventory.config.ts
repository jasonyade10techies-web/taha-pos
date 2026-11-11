import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "phase5d1-inventory.spec.ts",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 8000 },
  reporter: "list",
  outputDir: ".test-postgres/phase5d1-inventory-results",
  use: {
    baseURL: "http://127.0.0.1:1461",
    viewport: { width: 1366, height: 768 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      '"C:/Users/hassa/AppData/Local/hermes/node/node.exe" node_modules/vite/bin/vite.js --host 127.0.0.1 --port 1461 --strictPort',
    url: "http://127.0.0.1:1461",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      VITE_DATA_PROVIDER: "local",
      VITE_USE_MOCK_AUTH: "true",
      VITE_API_BASE_URL: "/api/v1",
      TAHA_DEV_API_TARGET: "http://127.0.0.1:39999",
      TAHA_TEST_NO_HMR: "1",
    },
  },
});
