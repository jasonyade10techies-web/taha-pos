// Never load server/.env.mobile-test or the saved shop database.
if(!process.env.TAHA_R2B_PACKAGE_ROOT)throw Error('Set TAHA_R2B_PACKAGE_ROOT to an R2B package and use the isolated PostgreSQL fixture.');
await import('./test-r2b-package.mjs');
