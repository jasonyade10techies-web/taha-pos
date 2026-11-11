import {spawn,execFileSync} from 'node:child_process';
import {openSync,closeSync,mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {portListening} from './local-service-ports.mjs';

export function isolatedLaunchPlan(root,runId,evidenceDirectory){
 const logs=path.resolve(root,evidenceDirectory??'.test-postgres/r1-20261111/local-acceptance');
 const privateRoot=path.resolve(root,'.test-postgres')+path.sep;
 if(!logs.toLowerCase().startsWith(privateRoot.toLowerCase()))throw Error('Isolated evidence must stay inside the project test directory.');
 const postgres={port:55459,role:'taha_phase5c',adminUrl:'postgresql://taha_phase5c@127.0.0.1:55459/postgres',dataDirectory:path.join(root,'.test-postgres','phase5c-20261014','pgdata'),binDirectory:path.join(root,'.test-postgres','pgsql','bin')};
 return {root,runId,logs,postgres,manifest:path.join(logs,'fixture-'+runId+'.json'),
  api:{name:'api',port:3306,cwd:path.join(root,'server'),args:['--import','tsx','scripts/serve-test.ts'],env:{TAHA_TEST_POSTGRES_URL:postgres.adminUrl,TAHA_TEST_API_PORT:'3306',TAHA_TEST_FRONTEND_ORIGINS:'http://127.0.0.1:1423,http://localhost:1423',TAHA_TEST_FIXTURE_RUN_ID:runId,TAHA_TEST_FIXTURE_MANIFEST:path.join(logs,'fixture-'+runId+'.json'),STORAGE_DRIVER:'local',TAHA_RUNTIME:'local',VERCEL:'0',TAHA_LAN_TLS_CERT:'',TAHA_LAN_TLS_KEY:''}},
  frontend:{name:'frontend',port:1423,cwd:root,args:['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','1423','--strictPort'],env:{VITE_DATA_PROVIDER:'api',VITE_USE_MOCK_AUTH:'false',VITE_BUNDLED_MOBILE:'false',VITE_API_URL:'/api/v1',VITE_API_BASE_URL:'/api/v1',VITE_LOCAL_ACCEPTANCE:'true',TAHA_TEST_NO_HMR:'1',TAHA_DEV_API_TARGET:'http://127.0.0.1:3306'}}};
}
const normalized=value=>path.resolve(value).replaceAll('\\','/').toLowerCase();
export function validatePostgresIdentity(plan,identity){
 if(identity.role!==plan.postgres.role||normalized(identity.dataDirectory)!==normalized(plan.postgres.dataDirectory))throw Error('The isolated PostgreSQL identity does not match the existing R1 cluster. No database was changed.');
}
export function validateFixtureProof(plan,pid,{fixture,health}){
 if(!fixture||fixture.runId!==plan.runId||fixture.pid!==pid||fixture.host!=='127.0.0.1'||fixture.port!==3306||fixture.postgresHost!=='127.0.0.1'||fixture.postgresPort!==55459||fixture.adminRole!==plan.postgres.role||!/^taha_api_browser_\d+$/.test(fixture.database)||fixture.ready!==true)throw Error('The isolated fixture identity does not match this launcher session.');
 if(health?.application!=='taha-pos'||health?.status!=='ok'||health?.database!=='connected')throw Error('Connected Taha health is required before readiness.');
}
export async function startIsolatedAcceptance(plan,runtime){
 const occupied=(await Promise.all([plan.api.port,plan.frontend.port].map(async port=>await runtime.portListening(port)?port:null))).filter(Boolean);
 if(occupied.length)throw Error(`Isolated acceptance ports ${occupied.join(', ')} are occupied and are not reused. Existing processes were left running.`);
 const pids={};
 try{
  await runtime.ensurePostgres(plan.postgres);
  pids.api=await runtime.launch(plan.api);
  const proof=await runtime.waitForApi(pids.api);validateFixtureProof(plan,pids.api,proof);
  pids.frontend=await runtime.launch(plan.frontend);await runtime.waitForFrontend();
  const status={startedAt:new Date().toISOString(),runId:plan.runId,mode:'isolated disposable API fixture · real authentication',ready:true,frontend:'http://127.0.0.1:1423/dashboard',health:'http://127.0.0.1:3306/api/v1/health',postgres:{host:'127.0.0.1',port:55459,database:proof.fixture.database},manifest:plan.manifest,pids};
  await runtime.writeStatus(status);return status;
 }catch(error){for(const pid of Object.values(pids).reverse())await runtime.stopOwned(pid);throw error;}
}
const delay=()=>new Promise(resolve=>setTimeout(resolve,500));
async function untilReady(check,label,timeout=120000){const deadline=Date.now()+timeout;let last;while(Date.now()<deadline){try{return await check();}catch(error){last=error;}await delay();}throw Error(`${label} did not become ready: ${last?.message??'timed out'}`);}
async function getJson(url){const response=await fetch(url,{signal:AbortSignal.timeout(2000)});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json();}

export function isolatedRuntime(plan){
 const children=new Map();mkdirSync(plan.logs,{recursive:true});
 const ensureChild=pid=>{const child=children.get(pid);if(child&&(child.exitCode!==null||child.signalCode!==null))throw Error(`Owned process ${pid} exited before readiness; inspect ${plan.logs}.`);};
 return {portListening,
  async ensurePostgres(postgres){
   if(!existsSync(path.join(postgres.dataDirectory,'PG_VERSION')))throw Error('The existing isolated PostgreSQL cluster is missing; this launcher never initializes or resets databases.');
   if(!await portListening(postgres.port))execFileSync(path.join(postgres.binDirectory,'pg_ctl.exe'),['-D',postgres.dataDirectory,'-l',path.join(plan.logs,'postgres.log'),'-o','-p55459 -h127.0.0.1','-W','start'],{cwd:plan.root,windowsHide:true,stdio:'ignore'});
   await untilReady(async()=>{execFileSync(path.join(postgres.binDirectory,'pg_isready.exe'),['-h','127.0.0.1','-p','55459','-U',postgres.role,'-d','postgres'],{windowsHide:true,stdio:'ignore'});const raw=execFileSync(path.join(postgres.binDirectory,'psql.exe'),['-h','127.0.0.1','-p','55459','-U',postgres.role,'-d','postgres','-At','-c',"select current_setting('data_directory') || '|' || current_user"],{windowsHide:true,encoding:'utf8',env:{...process.env,PGCONNECT_TIMEOUT:'2'}}).trim();const [dataDirectory,role]=raw.split('|');validatePostgresIdentity(plan,{dataDirectory,role});},'Isolated PostgreSQL',30000);
  },
  async launch(service){const fd=openSync(path.join(plan.logs,service.name+'.log'),'a');try{const child=spawn(process.execPath,service.args,{cwd:service.cwd,env:{...process.env,...service.env},detached:true,windowsHide:true,stdio:['ignore',fd,fd]});if(!child.pid)throw Error(`Could not start isolated ${service.name}.`);child.unref();children.set(child.pid,child);return child.pid;}finally{closeSync(fd);}},
  async waitForApi(pid){return untilReady(async()=>{ensureChild(pid);const fixture=JSON.parse(readFileSync(plan.manifest,'utf8'));const health=await getJson('http://127.0.0.1:3306/api/v1/health');validateFixtureProof(plan,pid,{fixture,health});return{fixture,health};},'Isolated API');},
  async waitForFrontend(){return untilReady(async()=>{ensureChild([...children.keys()].at(-1));const response=await fetch('http://127.0.0.1:1423/login',{signal:AbortSignal.timeout(2000)});if(!response.ok||!(await response.text()).includes('/src/bootstrap.ts'))throw Error('Expected Taha frontend entry was not served.');const health=await getJson('http://127.0.0.1:1423/api/v1/health');if(health.application!=='taha-pos'||health.status!=='ok'||health.database!=='connected')throw Error('Frontend Taha API proxy is not connected.');},'Isolated frontend');},
  async writeStatus(status){writeFileSync(path.join(plan.logs,'processes.json'),JSON.stringify(status,null,2));},
  async stopOwned(pid){if(children.has(pid)){try{process.kill(pid);}catch{/* It already exited. */}}},
 };
}
