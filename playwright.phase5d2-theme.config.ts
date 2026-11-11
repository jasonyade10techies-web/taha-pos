import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./tests',testMatch:['phase5d2-theme.spec.ts','phase5d2-toolbar.spec.ts'],
  globalSetup:'./tests/fixtures/local-suite-setup.ts',
  outputDir:'.test-postgres/phase5d2-theme/results',
  workers:1,timeout:120000,expect:{timeout:20000},reporter:'list',
  use:{baseURL:'http://127.0.0.1:1475',viewport:{width:1366,height:768},screenshot:'only-on-failure',trace:'retain-on-failure'},
  webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 1475 --strictPort',url:'http://127.0.0.1:1475',reuseExistingServer:false,timeout:120000,
    env:{VITE_DATA_PROVIDER:'local',VITE_USE_MOCK_AUTH:'true',VITE_BUNDLED_MOBILE:'false',VITE_API_BASE_URL:'/api/v1',TAHA_DEV_API_TARGET:'http://127.0.0.1:39999',TAHA_TEST_NO_HMR:'1'}},
});
