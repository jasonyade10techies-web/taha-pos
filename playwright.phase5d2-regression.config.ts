import {defineConfig} from '@playwright/test';
import local from './playwright.local.config';
// Same legacy browser coverage, retained separately from the scoped 5D.2
// theme/service/accounting fixtures so their artifact directories never collide.
export default defineConfig({...local,testIgnore:[local.testIgnore??[],/phase5d2-.*\.spec\.ts/].flat(),workers:2,outputDir:'.test-postgres/phase5d2-20261022/browser-regression-results'});
