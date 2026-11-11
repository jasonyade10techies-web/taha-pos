import {spawn,execFileSync} from 'node:child_process';
import {openSync,closeSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
import {selectLocalApiPort} from './local-service-ports.mjs';
import {randomUUID} from 'node:crypto';
import {isolatedLaunchPlan,isolatedRuntime,startIsolatedAcceptance} from './isolated-local-acceptance.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.argv.includes('--isolated')){
 try{const plan=isolatedLaunchPlan(root,randomUUID());console.log(JSON.stringify(await startIsolatedAcceptance(plan,isolatedRuntime(plan)),null,2));console.log('Verified isolated services are ready. Fixture credentials: owner@taha.test / Secure test password 2026!');}
 catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
}else{
const logs=path.join(root,'.test-postgres','local-acceptance');mkdirSync(logs,{recursive:true});
const listening=port=>new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port});socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>resolve(false));socket.setTimeout(1000,()=>{socket.destroy();resolve(false);});});
function launch(name,args,cwd,extra={}){
 const fd=openSync(path.join(logs,name+'.log'),'a');
 const child=spawn(process.execPath,args,{cwd,env:{...process.env,...extra},detached:true,windowsHide:true,stdio:['ignore',fd,fd]});child.unref();closeSync(fd);return child.pid;
}
if(!await listening(55439)){
 const ctl=path.join(root,'.test-postgres','pgsql','bin','pg_ctl.exe');
 execFileSync(ctl,['-D',path.join(root,'.test-postgres','data'),'-l',path.join(logs,'postgres.log'),'-o','-p55439 -h127.0.0.1','-W','start'],{cwd:root,windowsHide:true,stdio:'ignore'});
}
const selected=await selectLocalApiPort();
const status={startedAt:new Date().toISOString(),frontend:'http://localhost:1423/dashboard',health:`http://localhost:${selected.port}/api/v1/health`,mode:'Real custom backend · local development data',pids:{}};
if(!selected.reuse)status.pids.api=launch('api',['--import','tsx','scripts/local-acceptance-api.ts'],path.join(root,'server'),{TAHA_LOCAL_API_PORT:String(selected.port)});
if(!await listening(1423))status.pids.frontend=launch('frontend',['node_modules/vite/bin/vite.js','--config','scripts/vite-mobile.config.ts','--host','0.0.0.0','--port','1423','--strictPort'],root,{VITE_DATA_PROVIDER:'api',VITE_USE_MOCK_AUTH:'false',VITE_API_URL:'/api/v1',VITE_API_BASE_URL:'/api/v1',VITE_LOCAL_ACCEPTANCE:'true',TAHA_DEV_API_TARGET:`http://127.0.0.1:${selected.port}`});
writeFileSync(path.join(logs,'processes.json'),JSON.stringify(status,null,2));
console.log(JSON.stringify(status,null,2));
console.log('Services run independently. Existing listeners were not stopped. Startup is not readiness: check the reported Taha health endpoint before testing.');
}
