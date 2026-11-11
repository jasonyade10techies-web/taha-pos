import assert from 'node:assert/strict';
import {test} from 'node:test';
import {configuration} from '../src/config';
import {databasePoolOptions} from '../src/database/pool-options';
import {PollingGateway} from '../src/realtime/polling.gateway';

function env(values:Record<string,string|undefined>,work:()=>void){const before={...process.env};try{for(const key of Object.keys(process.env))if(/^(VERCEL|TAHA_|DATABASE_|STORAGE_|S3_|FRONTEND_|PUBLIC_API|JWT_|NODE_ENV)/.test(key))delete process.env[key];Object.assign(process.env,{NODE_ENV:'production',DATABASE_URL:'postgresql://taha_runtime:fixture-only@ep-unit-pooler.example.net/taha_staging?sslmode=verify-full',JWT_SECRET:'unit-test-fixture-only-long-configuration-secret',FRONTEND_ORIGIN:'https://taha-staging.example',PUBLIC_API_URL:'https://taha-api.example',STORAGE_DRIVER:'s3',S3_BUCKET:'taha-staging-private',S3_ACCESS_KEY_ID:'fixture-key',S3_SECRET_ACCESS_KEY:'fixture-secret',...values});work();}finally{for(const key of Object.keys(process.env))if(!(key in before))delete process.env[key];Object.assign(process.env,before);}}

test('Vercel cloud defaults to bounded polling and rejects disk storage/private endpoints',()=>{
 env({VERCEL:'1',TAHA_DEPLOYMENT_ENV:'staging'},()=>{const c=configuration();assert.equal(c.cloud,true);assert.equal(c.deploymentEnv,'staging');assert.equal(c.databasePoolMax,2);assert.equal(c.cookieSecure,true);});
 for(const values of [{STORAGE_DRIVER:'local'},{DATABASE_URL:'postgresql://x@localhost/shop'},{PUBLIC_API_URL:'https://192.168.1.8:3001'},{S3_BUCKET:''},{FRONTEND_ORIGIN:'*'}])env({VERCEL:'1',TAHA_DEPLOYMENT_ENV:'staging',...values},()=>assert.throws(()=>configuration()));
});
test('cloud database enforces verified TLS, bounded pool and does not leak secrets in errors',()=>{
 env({VERCEL:'1',TAHA_DEPLOYMENT_ENV:'staging'},()=>{const c=configuration();const p=databasePoolOptions(c);assert.equal(p.max,2);assert.equal(p.connectionTimeoutMillis,8000);assert.equal(p.idleTimeoutMillis,5000);assert.equal(p.allowExitOnIdle,true);assert.deepEqual(p.ssl,{rejectUnauthorized:true});assert.ok(!p.connectionString?.includes('sslmode='));});
 for(const mode of ['disable','no-verify'])env({VERCEL:'1',TAHA_DEPLOYMENT_ENV:'staging',DATABASE_URL:'postgresql://runtime:never-disclose@public.example/db?sslmode='+mode},()=>assert.throws(()=>configuration(),error=>error instanceof Error&&!error.message.includes('never-disclose')));
 env({VERCEL:'1',TAHA_DEPLOYMENT_ENV:'staging',DATABASE_POOL_MAX:'99'},()=>assert.throws(()=>configuration(),/pool/i));
});
test('local development retains disk transport and ordinary pool without requiring hosted credentials',()=>{
 env({VERCEL:undefined,TAHA_DEPLOYMENT_ENV:'development',NODE_ENV:'development',DATABASE_URL:'postgresql://runtime@127.0.0.1/local',STORAGE_DRIVER:'local',PUBLIC_API_URL:'http://localhost:3001',FRONTEND_ORIGIN:'http://localhost:1423'},()=>{delete process.env.VERCEL;const c=configuration();assert.equal(c.cloud,false);assert.equal(c.databasePoolMax,10);assert.equal(databasePoolOptions(c).ssl,undefined);});
});
test('polling gateway never starts timers, keeps rooms or claims a socket presence',async()=>{
 const gateway=new PollingGateway();assert.equal(await gateway.hasDevicePresence('fixture-store','fixture-device'),false);await gateway.changed({userId:'u',sessionId:'s'},'shop','products');await gateway.camera({},'camera.request.created');await gateway.pairingEvent({},'device.online');assert.equal('server' in gateway,false);assert.equal('presence' in gateway,false);
});
