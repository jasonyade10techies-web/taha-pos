import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'r2a-counter.spec.ts',workers:1,timeout:180000,expect:{timeout:25000},reporter:'list',outputDir:'.test-postgres/r2a-20261111/browser-results',use:{baseURL:'http://127.0.0.1:1423',actionTimeout:20000,viewport:{width:1366,height:768},trace:'retain-on-failure',screenshot:'only-on-failure'}});
