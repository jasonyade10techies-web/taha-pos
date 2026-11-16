import { defineConfig } from "@playwright/test";
import base from "./playwright.phase5d-mobile.config";
export default defineConfig({
  ...base,
  testMatch: "mobile-product-capture.spec.ts",
  globalSetup: undefined,
  outputDir: ".test-postgres/mobile-product-capture/browser-results",
  use: { ...base.use, baseURL: "http://127.0.0.1:1465" },
  webServer: {
    ...(base.webServer as object),
    command:
      "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 1465 --strictPort",
    url: "http://127.0.0.1:1465",
  },
});
