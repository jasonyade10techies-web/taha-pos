'use strict';
const started=process.hrtime.bigint();let phase='boot';
function startup(stage,during){phase=stage;console.log(JSON.stringify({event:'taha.startup',stage,elapsedMs:Number((process.hrtime.bigint()-started)/1000000n),...(during?{during}:{})}));}
startup('boot');
// Hostinger supplies PORT. Secrets are injected through its private environment UI.
process.env.NODE_ENV ||= 'production';
process.env.TAHA_RUNTIME ||= 'cloud';
process.env.TAHA_DEPLOYMENT_ENV ||= 'staging';
process.env.TAHA_SERVE_FRONTEND = 'true';
if(process.env.MIGRATE_ON_START==='true')throw Error('Run the separately approved migration command; startup migrations are disabled.');
Promise.all([import('./dist/main.js'),import('./dist/config.js')]).then(async([{createApp,startLanTls},{CONFIG}])=>{startup('modules-loaded');const app=await createApp(),config=app.get(CONFIG);startup('application-created');
if(config.cloud)app.getHttpServer().once('request',request=>{
 // Private runtime diagnostics: raw socket peer cannot be supplied through an
 // HTTP header. Observe it; never automatically trust an address or hop count.
 const protocol=request.headers['x-forwarded-proto'];
 console.log(JSON.stringify({event:'taha.proxy-observation',peerAddress:request.socket.remoteAddress??'unavailable',tlsAtNode:Boolean(request.socket.encrypted),forwardedProtocol:['https','http'].includes(protocol)?protocol:'missing-or-other',trustConfigured:Boolean(config.trustedProxy)}));
});
await app.listen(config.port,config.bindHost);startup('listening');await startLanTls(app);startup('ready');}).catch(()=>{startup('failed',phase);console.error('Taha staging initialization failed. Check private configuration and readiness diagnostics.');process.exitCode=1;});
