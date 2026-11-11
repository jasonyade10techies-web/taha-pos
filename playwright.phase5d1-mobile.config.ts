import { defineConfig } from "@playwright/test";
import base from "./playwright.phase5d-mobile.config";
export default defineConfig({
  ...base,
  testMatch: "phase5d1-mobile-sales.spec.ts",
  globalSetup: undefined,
  outputDir: ".test-postgres/phase5d1-mobile-results",
  webServer: {
    ...(base.webServer as object),
    command:
      "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 1449 --strictPort",
    url: "http://127.0.0.1:1449",
  },
  use: { ...base.use, baseURL: "http://127.0.0.1:1449" },
});
