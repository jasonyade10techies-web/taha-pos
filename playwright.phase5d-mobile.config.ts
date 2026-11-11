import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'phase5d-mobile-acceptance.spec.ts',globalSetup:'./tests/fixtures/mobile-suite-setup.ts',workers:1,timeout:90000,expect:{timeout:20000},reporter:'list',outputDir:'.test-postgres/phase5d-20261016/mobile-results',
 use:{baseURL:'http://127.0.0.1:1445',viewport:{width:390,height:844},launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']},trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 1445 --strictPort',url:'http://127.0.0.1:1445',reuseExistingServer:false,timeout:120000,
 env:{VITE_DATA_PROVIDER:'api',VITE_USE_MOCK_AUTH:'false',VITE_BUNDLED_MOBILE:'true',VITE_MOBILE_TEST:'true',VITE_API_BASE_URL:'/api/v1',TAHA_DEV_API_TARGET:'http://127.0.0.1:39999',TAHA_TEST_NO_HMR:'1'}},
});
