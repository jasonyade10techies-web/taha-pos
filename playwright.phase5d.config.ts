import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:/phase5d-(?:products|whatsapp|chart)\.spec\.ts/,globalSetup:'./tests/fixtures/local-suite-setup.ts',workers:1,timeout:90000,expect:{timeout:20000},reporter:'list',
 outputDir:'.test-postgres/phase5d-20261016/product-results',
 use:{baseURL:'http://127.0.0.1:1440',viewport:{width:1366,height:768},trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 1440 --strictPort',url:'http://127.0.0.1:1440',reuseExistingServer:false,timeout:120000,
 env:{VITE_DATA_PROVIDER:'local',VITE_USE_MOCK_AUTH:'true',VITE_API_BASE_URL:'/api/v1',TAHA_DEV_API_TARGET:'http://127.0.0.1:39999',TAHA_TEST_NO_HMR:'1'}},
});
