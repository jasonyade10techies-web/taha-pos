import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'device-bridge-integration.spec.ts',outputDir:'test-results-bridge',workers:1,timeout:90000,expect:{timeout:15000},reporter:[['list']],use:{baseURL:'http://127.0.0.1:1423',viewport:{width:1366,height:768},trace:'retain-on-failure',screenshot:'only-on-failure'}});
