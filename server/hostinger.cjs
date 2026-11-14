// The UI is a same-origin bundle. No Vite process or startup migrations.
const path=require('node:path');
process.env.NODE_ENV ||= 'production';
process.env.TAHA_RUNTIME ||= 'cloud';
process.env.TAHA_DEPLOYMENT_ENV ||= 'staging';
process.env.TAHA_SERVE_FRONTEND='true';
process.env.TAHA_FRONTEND_ROOT=path.resolve(__dirname,'../dist-staging');
process.env.TAHA_BIND_HOST=process.env.TAHA_BIND_HOST||'0.0.0.0';
if(process.env.MIGRATE_ON_START==='true')throw Error('Run the separately authorized migration command before starting.');
const {createApp,startLanTls}=require('./dist/main.js');
const {configuration}=require('./dist/config.js');
createApp().then(async app=>{const config=configuration();await app.listen(config.port,config.bindHost);await startLanTls(app);console.log('Taha POS listening.');}).catch(()=>{console.error('Taha POS could not start. Review the required backend configuration in private diagnostics.');process.exitCode=1;});
