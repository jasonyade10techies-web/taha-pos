import {defineConfig,devices} from "@playwright/test";
export default defineConfig({testDir:"./tests",testMatch:"shop-connection.spec.ts",outputDir:"test-results-connection",workers:1,timeout:60000,expect:{timeout:12000},reporter:[["list"]],use:{...devices["Desktop Chrome"],baseURL:"http://127.0.0.1:4175",viewport:{width:390,height:844},trace:"retain-on-failure"}});
