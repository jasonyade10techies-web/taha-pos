import { defineConfig } from "@playwright/test";
// This harness loads Vite source modules; native release startup uses the bundled chunks.
export default defineConfig({
  testDir: "./tests",
  testMatch: /phase5a\.spec\.ts/,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 60_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:1423",
    viewport: { width: 1366, height: 768 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  outputDir: "test-results-5a",
});
