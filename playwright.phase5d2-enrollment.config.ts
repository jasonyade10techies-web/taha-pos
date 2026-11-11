import {defineConfig} from '@playwright/test';
import base from './playwright.local.config';
export default defineConfig({...base,testMatch:'device-settings.spec.ts',testIgnore:undefined,globalSetup:undefined,outputDir:'.test-postgres/phase5d2-20261022/enrollment-browser-results',webServer:{...(base.webServer as object),command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 1458 --strictPort',url:'http://127.0.0.1:1458'},use:{...base.use,baseURL:'http://127.0.0.1:1458'}});
