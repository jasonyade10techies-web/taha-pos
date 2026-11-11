import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'phase5d-api-acceptance.spec.ts',workers:1,timeout:120000,expect:{timeout:20000},reporter:'list',outputDir:'.test-postgres/phase5d-20261016/api-acceptance-results',
 use:{baseURL:'http://127.0.0.1:1422',viewport:{width:1366,height:768},trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 1422 --strictPort',url:'http://127.0.0.1:1422',reuseExistingServer:false,timeout:120000,
 env:{VITE_DATA_PROVIDER:'api',VITE_USE_MOCK_AUTH:'false',VITE_API_URL:'/api/v1',VITE_API_BASE_URL:'/api/v1',TAHA_DEV_API_TARGET:'http://127.0.0.1:3002',TAHA_TEST_NO_HMR:'1'}},
});
