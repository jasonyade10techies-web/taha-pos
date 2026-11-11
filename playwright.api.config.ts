import { defineConfig, devices } from "@playwright/test";
export default defineConfig({ testDir:"./tests", outputDir:"test-results-api", testMatch:"api-backend.spec.ts", workers:1, timeout:90000, expect:{timeout:20000}, use:{...devices["Desktop Chrome"],baseURL:"http://127.0.0.1:1422",viewport:{width:1366,height:768},trace:"retain-on-failure",screenshot:"only-on-failure"},reporter:[["list"]] });
