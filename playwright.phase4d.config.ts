import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:/(?:phase4d|device-bridge-integration)\.spec\.ts/,workers:1,timeout:60000,expect:{timeout:12000},reporter:[['list']],use:{baseURL:'http://127.0.0.1:4175',viewport:{width:390,height:844},screenshot:'only-on-failure',trace:'retain-on-failure'},outputDir:'test-results-4d'});
