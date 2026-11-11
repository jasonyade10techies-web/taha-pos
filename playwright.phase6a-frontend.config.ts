import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:'phase6a-frontend.spec.ts',workers:1,timeout:60000,expect:{timeout:15000},reporter:'list',
  outputDir:'.test-postgres/phase6a-20261029/frontend-browser-results',
  use:{baseURL:'http://127.0.0.1:1486',viewport:{width:1366,height:768},trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'node node_modules/vite/bin/vite.js --mode staging --host 127.0.0.1 --port 1486 --strictPort',url:'http://127.0.0.1:1486',reuseExistingServer:false,timeout:120000,
    env:{VITE_DEPLOYMENT_ENV:'staging',VITE_DATA_PROVIDER:'api',VITE_USE_MOCK_AUTH:'false',VITE_API_URL:'/api/v1',VITE_BUNDLED_MOBILE:'false',VITE_API_BASE_URL:'/api/v1',TAHA_DEV_API_TARGET:'http://127.0.0.1:39999',TAHA_TEST_NO_HMR:'1'}},
});
