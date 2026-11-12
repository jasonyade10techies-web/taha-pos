'use strict';
// Hostinger supplies PORT. Secrets are injected through its private environment UI.
process.env.NODE_ENV ||= 'production';
process.env.TAHA_RUNTIME ||= 'cloud';
process.env.TAHA_DEPLOYMENT_ENV ||= 'staging';
process.env.TAHA_SERVE_FRONTEND = 'true';
if(process.env.MIGRATE_ON_START==='true')throw Error('Run the separately approved migration command; startup migrations are disabled.');
Promise.all([import('./dist/main.js'),import('./dist/config.js')]).then(async([{createApp,startLanTls},{CONFIG}])=>{const app=await createApp(),config=app.get(CONFIG);await app.listen(config.port,config.bindHost);await startLanTls(app);}).catch(()=>{console.error('Taha staging initialization failed. Check private configuration and readiness diagnostics.');process.exitCode=1;});
