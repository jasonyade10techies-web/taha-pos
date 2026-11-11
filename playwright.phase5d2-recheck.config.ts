import {defineConfig} from '@playwright/test';
import local from './playwright.local.config';
export default defineConfig({...local,testMatch:/(?:local-prototype|phase1|phase4e|phase5d-chart|smart-services)\.spec\.ts/,testIgnore:[],workers:1,outputDir:'.test-postgres/phase5d2-20261022/browser-recheck-results',use:{...local.use,baseURL:'http://127.0.0.1:1476'},webServer:{...(Array.isArray(local.webServer)?local.webServer[0]:local.webServer),command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 1476 --strictPort',url:'http://127.0.0.1:1476'}});
