import {defineConfig,devices} from "@playwright/test";
// Targeted counter regressions while the normal dev server is already running.
export default defineConfig({testDir:"./tests",testMatch:["counter-polish.spec.ts","mobile-polish.spec.ts"],outputDir:"test-results-counter",workers:1,timeout:90000,expect:{timeout:10000},reporter:[["list"]],use:{...devices["Desktop Chrome"],baseURL:"http://127.0.0.1:1420",viewport:{width:1366,height:768},trace:"retain-on-failure",screenshot:"only-on-failure"}});
