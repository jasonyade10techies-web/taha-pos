// Vercel Node entrypoint. Compiled Nest sources retain TypeScript decorator metadata.
// No TCP/LAN listener, migrations or filesystem bootstrap runs inside this handler.
const {createApp}=require('../dist/main');
const {createFunctionHandler}=require('../dist/function-handler');
module.exports=createFunctionHandler(async()=>{
 const app=await createApp();await app.init();
 return app.getHttpAdapter().getInstance();
});
