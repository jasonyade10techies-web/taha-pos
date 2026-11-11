import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:/(?:phase4e|phase4d-desktop)\.spec\.ts/,workers:1,timeout:90_000,expect:{timeout:15_000},reporter:[['list']],use:{baseURL:'http://127.0.0.1:1423',viewport:{width:1366,height:768},screenshot:'only-on-failure',trace:'retain-on-failure'},outputDir:'test-results-4e'});
