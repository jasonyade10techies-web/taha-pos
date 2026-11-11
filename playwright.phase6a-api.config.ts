import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:'phase6a-browser-api.spec.ts',workers:1,timeout:180000,expect:{timeout:25000},reporter:'list',outputDir:'.test-postgres/phase6a-20261029/frontend-api-browser-results',
 use:{baseURL:'http://127.0.0.1:1487',viewport:{width:1366,height:768},trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'node node_modules/vite/bin/vite.js --mode staging --host 127.0.0.1 --port 1487 --strictPort',url:'http://127.0.0.1:1487',reuseExistingServer:false,timeout:120000,
 env:{VITE_DEPLOYMENT_ENV:'staging',VITE_DATA_PROVIDER:'api',VITE_USE_MOCK_AUTH:'false',VITE_API_URL:'/api/v1',VITE_API_BASE_URL:'/api/v1',VITE_BUNDLED_MOBILE:'false',TAHA_DEV_API_TARGET:'http://127.0.0.1:3306',TAHA_TEST_NO_HMR:'1'}},
});
