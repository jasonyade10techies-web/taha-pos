import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isolatedLaunchPlan,startIsolatedAcceptance,validateFixtureProof,validatePostgresIdentity} from './isolated-local-acceptance.mjs';

const plan=isolatedLaunchPlan('D:/Inventory system POS','test-session');
const fixture={runId:'test-session',pid:123,host:'127.0.0.1',port:3306,postgresHost:'127.0.0.1',postgresPort:55459,adminRole:'taha_phase5c',database:'taha_api_browser_123',ready:true};
const health={application:'taha-pos',status:'ok',database:'connected'};
function runtime(overrides={}){const calls=[];return {calls,portListening:async port=>{calls.push(['probe',port]);return false;},ensurePostgres:async()=>{calls.push(['postgres']);},launch:async service=>{calls.push(['launch',service.name]);return service.name==='api'?123:456;},waitForApi:async()=>{calls.push(['api-ready']);return{fixture,health};},waitForFrontend:async()=>{calls.push(['frontend-ready']);},writeStatus:async status=>{calls.push(['status',status.ready]);},stopOwned:async pid=>{calls.push(['stop',pid]);},...overrides};}

test('isolated plan fixes disposable targets and real authentication without consulting saved env',()=>{
 assert.equal(plan.postgres.port,55459);assert.equal(plan.postgres.adminUrl,'postgresql://taha_phase5c@127.0.0.1:55459/postgres');
 assert.match(plan.postgres.dataDirectory,/phase5c-20261014[\\/]pgdata$/);assert.match(plan.logs,/r1-20261111[\\/]local-acceptance$/);
 assert.equal(plan.api.env.TAHA_TEST_POSTGRES_URL,plan.postgres.adminUrl);assert.equal(plan.api.env.TAHA_TEST_API_PORT,'3306');
 assert.equal(plan.frontend.env.VITE_DATA_PROVIDER,'api');assert.equal(plan.frontend.env.VITE_USE_MOCK_AUTH,'false');
 assert.equal(plan.frontend.env.TAHA_DEV_API_TARGET,'http://127.0.0.1:3306');assert.ok(plan.frontend.args.includes('127.0.0.1'));assert.ok(plan.frontend.args.includes('--strictPort'));
 assert.equal(JSON.stringify(plan).includes('55439'),false);assert.equal(JSON.stringify(plan).includes('.env.mobile-test'),false);
});
for(const occupied of [3306,1423])test(`isolated launcher refuses an occupied ${occupied} even when it could be a healthy Taha service`,async()=>{
 const r=runtime({portListening:async port=>port===occupied});await assert.rejects(startIsolatedAcceptance(plan,r),/occupied.*not reused/i);assert.deepEqual(r.calls,[]);
});
test('Postgres identity must match the existing isolated data directory and administrator role',()=>{
 assert.doesNotThrow(()=>validatePostgresIdentity(plan,{dataDirectory:plan.postgres.dataDirectory,role:'taha_phase5c'}));
 assert.throws(()=>validatePostgresIdentity(plan,{dataDirectory:'D:/other/pgdata',role:'taha_phase5c'}),/isolated PostgreSQL identity/);
 assert.throws(()=>validatePostgresIdentity(plan,{dataDirectory:plan.postgres.dataDirectory,role:'taha_test'}),/isolated PostgreSQL identity/);
});
test('fixture readiness requires matching process, session, database target, and connected Taha health',()=>{
 assert.doesNotThrow(()=>validateFixtureProof(plan,123,{fixture,health}));
 for(const wrong of [{runId:'foreign'},{pid:124},{postgresPort:55439},{database:'saved_database'},{ready:false},{host:'0.0.0.0'}])assert.throws(()=>validateFixtureProof(plan,123,{fixture:{...fixture,...wrong},health}),/fixture identity/);
 assert.throws(()=>validateFixtureProof(plan,123,{fixture,health:{...health,application:'other'}}),/Taha health/);
});
test('readiness is announced only after database, API identity, and frontend proxy are verified',async()=>{
 const r=runtime(),status=await startIsolatedAcceptance(plan,r);assert.equal(status.ready,true);assert.deepEqual(status.pids,{api:123,frontend:456});
 assert.deepEqual(r.calls,[['probe',3306],['probe',1423],['postgres'],['launch','api'],['api-ready'],['launch','frontend'],['frontend-ready'],['status',true]]);
});
test('failed API identity never starts frontend or announces ready and stops only its own child',async()=>{
 const r=runtime({waitForApi:async()=>({fixture:{...fixture,runId:'foreign'},health})});await assert.rejects(startIsolatedAcceptance(plan,r),/fixture identity/);
 assert.deepEqual(r.calls,[['probe',3306],['probe',1423],['postgres'],['launch','api'],['stop',123]]);
});
test('failed frontend readiness stops the two owned processes and does not publish readiness',async()=>{
 const r=runtime({waitForFrontend:async()=>{throw Error('frontend failed');}});await assert.rejects(startIsolatedAcceptance(plan,r),/frontend failed/);
 assert.deepEqual(r.calls.slice(-2),[['stop',456],['stop',123]]);assert.equal(r.calls.some(c=>c[0]==='status'),false);
});
