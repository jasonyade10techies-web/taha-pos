import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadConfigFromFile} from 'vite';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const valid = {VITE_DEPLOYMENT_ENV:'staging',VITE_DATA_PROVIDER:'api',VITE_USE_MOCK_AUTH:'false',VITE_API_URL:'/api/v1'};
async function cloudConfig(overrides={},mode='staging') {
  const original={...process.env};
  for (const key of Object.keys(process.env)) if(key.startsWith('VITE_')||key==='VERCEL') delete process.env[key];
  Object.assign(process.env,valid,overrides);
  try {return await loadConfigFromFile({command:'build',mode},'vite.config.ts');}
  finally {process.env=original;}
}
for(const [name,env] of [
  ['local demo',{VITE_DATA_PROVIDER:'local'}],
  ['Supabase repository',{VITE_DATA_PROVIDER:'supabase'}],
  ['mock authentication',{VITE_USE_MOCK_AUTH:'true'}],
  ['private API',{VITE_API_URL:'http://192.168.1.5:3001/api/v1'}],
  ['external API bypass',{VITE_API_URL:'https://shop-api.vercel.app/api/v1'}],
  ['private device bridge',{VITE_DEVICE_BRIDGE_URL:'https://192.168.1.5/api/v1'}],
  ['native mobile bundle',{VITE_BUNDLED_MOBILE:'true'}],
  ['browser secret',{VITE_SESSION_SECRET:'do-not-bundle-this'}],
  ['database value',{VITE_PUBLIC_SETTING:'postgresql://user:password@db.example/db'}],
  ['missing deployment label',{VITE_DEPLOYMENT_ENV:''}],
]) test(`cloud build rejects ${name}`,async()=>{await assert.rejects(()=>cloudConfig(env));});
test('valid same-origin authenticated cloud build remains available',async()=>{assert.ok(await cloudConfig());});
test('staging HTML includes noindex while local HTML stays unchanged',async()=>{
  const loaded=await cloudConfig();
  const plugin=loaded.config.plugins.find(p=>p?.name==='staff-entry');
  const html=plugin.transformIndexHtml.handler('<html><head></head><body></body></html>');
  assert.match(html,/name="robots" content="noindex, noarchive, nofollow"/);
  const local=await cloudConfig({VITE_DEPLOYMENT_ENV:'',VITE_DATA_PROVIDER:'local',VITE_USE_MOCK_AUTH:'true'},'production');
  const localPlugin=local.config.plugins.find(p=>p?.name==='staff-entry');
  assert.doesNotMatch(localPlugin.transformIndexHtml.handler('<html><head></head><body></body></html>'),/noindex/);
});

test('generated deployment preserves API errors and SPA refresh routes in order',()=>{
  const dir=mkdtempSync(join(tmpdir(),'taha-routing-'));
  try {
    const result=spawnSync(process.execPath,['scripts/configure-vercel-frontend.mjs','--api-origin','https://taha-api-staging-actual.vercel.app','--output',join(dir,'vercel.json')],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const config=JSON.parse(readFileSync(join(dir,'vercel.json'),'utf8'));
    const resolve=path=>config.routes.find(route=>route.dest&&new RegExp(`^${route.src}$`).test(path));
    assert.equal(resolve('/api/v1/unknown').dest,'https://taha-api-staging-actual.vercel.app/api/$1');
    assert.equal(resolve('/api').dest,'https://taha-api-staging-actual.vercel.app/api');
    for(const path of ['/dashboard','/pos','/products','/customers','/transactions','/returns','/settings','/products/product-id','/customers/customer-id','/transactions/invoice-id','/mobile/sales']) assert.equal(resolve(path).dest,'/index.html',path);
    assert.equal(config.outputDirectory,'dist-staging');
    assert.equal(config.buildCommand,'node scripts/build-cloud.mjs');
    assert.match(config.routes[0].headers['X-Robots-Tag'],/noindex/);
    assert.match(config.routes[0].headers['Cache-Control'],/no-store/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
for(const origin of ['', 'http://api.vercel.app','https://localhost','https://localhost.','https://api.example.com.','https://127.0.0.1','https://192.168.1.2','https://10.1.2.3','https://[::1]','https://api.example.com','https://host.invalid','https://api.test','https://user:password@api.vercel.app','https://api.vercel.app/api/v1','https://api.vercel.app?token=private']) test(`deployment generator rejects unsafe or placeholder origin ${origin.replace(/password|private/g,'redacted')}`,()=>{
  const dir=mkdtempSync(join(tmpdir(),'taha-reject-origin-'));
  try {
    const result=spawnSync(process.execPath,['scripts/configure-vercel-frontend.mjs','--api-origin',origin,'--output',join(dir,'vercel.json')],{encoding:'utf8'});
    assert.notEqual(result.status,0);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
