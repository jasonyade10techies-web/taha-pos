import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:1420",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /(?:r1-api-acceptance|api-backend|phase4d|device-bridge-integration|authorization|supabase(?:-transactions)?|shop-connection|instant-camera|phase6a-(?:frontend|browser-api))\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 768 },
      },
    },
    {
      name: "authorization",
      testMatch: /(?:authorization|supabase(?:-transactions)?)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:1421",
        viewport: { width: 1366, height: 768 },
      },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      url: "http://127.0.0.1:1420",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "node scripts/start-auth-test.mjs",
      url: "http://127.0.0.1:1421",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
