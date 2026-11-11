import {defineConfig} from '@playwright/test';

// Reproducible isolated browser/demo regression run. Live-shop and Supabase
// integration suites have separate fixtures and must not run against shop data.
export default defineConfig({
  testDir:'./tests',
  globalSetup:'./tests/fixtures/local-suite-setup.ts',
  testIgnore:/(?:r2a-counter|r1-api-acceptance|api-backend|authorization|supabase(?:-transactions)?|phase4d|device-bridge-integration|instant-camera|shop-connection|cash-reconciliation|phase5d-(?:api|mobile)-acceptance|phase5d1-(?:api-acceptance|mobile-sales)|phase6a-(?:frontend|browser-api))\.spec\.ts/,
  outputDir:'.test-postgres/phase5c1-20261015/local-browser-results',
  workers:1,timeout:90000,expect:{timeout:20000},reporter:'list',
  use:{baseURL:'http://127.0.0.1:1437',viewport:{width:1366,height:768},screenshot:'only-on-failure',trace:'retain-on-failure'},
  // Tests import application modules through Vite. Own this fixture rather than
  // reusing a counter with unknown environment; suppress source-edit reloads.
  webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 1437 --strictPort',url:'http://127.0.0.1:1437',reuseExistingServer:false,timeout:120000,
    env:{VITE_DATA_PROVIDER:'local',VITE_USE_MOCK_AUTH:'true',VITE_BUNDLED_MOBILE:'false',VITE_API_BASE_URL:'/api/v1',TAHA_DEV_API_TARGET:'http://127.0.0.1:39999',TAHA_TEST_NO_HMR:'1'}},
});
