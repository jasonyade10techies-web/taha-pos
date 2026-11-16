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
let listener,handler,app,listenerFailed=false,stopping=false,listenerReady=Promise.resolve();
if(process.env.TAHA_RUNTIME==='cloud'){
 const port=Number(process.env.PORT??3000),host=process.env.TAHA_BIND_HOST??'0.0.0.0';
 if(!Number.isInteger(port)||port<1||port>65535||!['0.0.0.0','127.0.0.1','::'].includes(host))throw Error('Invalid platform listener configuration.');
 // Hostinger requires listen() within three seconds, before loading NestJS.
 // The same listener serves the initialized API; no second port or fake health.
 // Literal CommonJS http preserves managed-loader/require-cache interception.
 listener=require('http').createServer((request,response)=>{
  if(handler)return handler(request,response);
  response.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store','Retry-After':'1','X-Robots-Tag':'noindex'});
  response.end(JSON.stringify({statusCode:503,code:'STARTING',message:'Taha POS is starting. Retry shortly.'}));
 });
 listenerReady=new Promise((resolve,reject)=>{
  listener.once('error',error=>{listenerFailed=true;startup('failed','listener');console.error('Taha POS could not open its assigned listener.');process.exitCode=1;reject(error);});
  listener.listen(port,host,()=>{startup('listener-open');resolve();});
 });
 for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{stopping=true;handler=null;listener.close();});
}
listenerReady.then(()=>Promise.all([import('./dist/api.js'),import('./dist/config.js')])).then(async([{createApp,startLanTls},{CONFIG}])=>{startup('modules-loaded');app=await createApp();if(listenerFailed||stopping)throw Error('Listener is no longer available.');const config=app.get(CONFIG);startup('application-created');
if(config.cloud)(listener||app.getHttpServer()).once('request',request=>{
 // Private runtime diagnostics: raw socket peer cannot be supplied through an
 // HTTP header. Observe it; never automatically trust an address or hop count.
 const protocol=request.headers['x-forwarded-proto'];
 console.log(JSON.stringify({event:'taha.proxy-observation',peerAddress:request.socket.remoteAddress??'unavailable',tlsAtNode:Boolean(request.socket.encrypted),forwardedProtocol:['https','http'].includes(protocol)?protocol:'missing-or-other',trustConfigured:Boolean(config.trustedProxy)}));
});
if(listener){await app.init();if(listenerFailed||stopping)throw Error('Listener is no longer available.');handler=app.getHttpAdapter().getInstance();}else await app.listen(config.port,config.bindHost);
startup('listening');await startLanTls(app);startup('ready');}).catch(async()=>{startup('failed',phase);console.error('Taha staging initialization failed. Check private configuration and readiness diagnostics.');process.exitCode=1;handler=null;listener?.close();try{await app?.close();}catch{/* Preserve the original failure and never log configuration secrets. */}});
