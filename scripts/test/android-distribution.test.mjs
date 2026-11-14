import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {validateRelease} from '../../distribution/manifest.mjs';
import {publishRelease,createDownloadHandler} from '../../distribution/handler.mjs';
const bytes=Buffer.from('synthetic apk bytes — tests only');
const release={schemaVersion:1,channel:'test',applicationId:'com.tahamobiles.staff.debug',versionName:'0.5R.3a-test',versionCode:12,apkUrl:'/downloads/taha-staff/apks/test/12/Taha-Staff-test-build12.apk',sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),signingCertificateSha256:'a'.repeat(64),releasedAt:'2026-11-14T12:00:00.000Z',minAndroidApi:26,minBackendApiVersion:1,required:false,releaseNotes:['Approved synthetic release']};
test('manifest rejects traversal, external URLs, bad identity, missing fields and unbounded payloads',()=>{
 assert.equal(validateRelease(release).versionCode,12);
 for(const value of [{...release,apkUrl:'https://evil.test/file.apk'},{...release,apkUrl:'/downloads/taha-staff/apks/test/12/../file.apk'},{...release,sizeBytes:0},{...release,sizeBytes:67108865},{...release,versionCode:12.1},{...release,applicationId:'bad'},{...release,sha256:'bad'},{...release,required:'true'},{...release,releaseNotes:['x'.repeat(2001)]},{...release,releasedAt:'bad'},{...release,channel:'stable'}])assert.throws(()=>validateRelease(value));
});
test('publication verifies bytes before atomic metadata, retains last good version and refuses collisions',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'taha-distribution-'));try{
  const input=path.join(root,'input.apk');await writeFile(input,bytes);
  await assert.rejects(publishRelease(path.join(root,'out'),input,{...release,sha256:'b'.repeat(64)}));
  await assert.rejects(readFile(path.join(root,'out/releases/test.json')));
  await publishRelease(path.join(root,'out'),input,release);
  await publishRelease(path.join(root,'out'),input,release);
  await assert.rejects(publishRelease(path.join(root,'out'),input,{...release,versionName:'collision'}));
  assert.equal(JSON.parse(await readFile(path.join(root,'out/releases/test.json'),'utf8')).versionName,release.versionName);
  await writeFile(path.join(root,'out/apks/test/12/Taha-Staff-test-build12.apk'),'corrupt');
  await assert.rejects(publishRelease(path.join(root,'out'),input,release));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('download site starts without database, serves exact bytes anonymously and blocks private paths',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'taha-download-http-'));let server;try{
  const input=path.join(root,'input.apk');await writeFile(input,bytes);await publishRelease(root,input,release);
  await mkdir(path.join(root,'private'));await writeFile(path.join(root,'private/secret'),'never expose');
  const handler=createDownloadHandler(root);server=createServer(async(req,res)=>{if(!await handler(req,res)){res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  const page=await fetch(base+'/downloads/taha-staff');assert.equal(page.status,200);assert.match(await page.text(),/Taha Staff/);assert.match(page.headers.get('cache-control'),/no-store/);
  const manifest=await fetch(base+'/downloads/taha-staff/releases/test.json');assert.deepEqual(await manifest.json(),release);
  assert.deepEqual(await (await fetch(base+'/downloads/taha-staff/status?channel=stable')).json(),{available:false,channel:'stable'});
  assert.deepEqual(await (await fetch(base+'/downloads/taha-staff/status?channel=test')).json(),{available:true,channel:'test',release});
  const apk=await fetch(base+'/downloads/taha-staff/latest.apk?channel=test');assert.equal(apk.status,200);assert.equal(apk.headers.get('content-type'),'application/vnd.android.package-archive');assert.deepEqual(Buffer.from(await apk.arrayBuffer()),bytes);
  const immutable=await fetch(base+release.apkUrl);assert.match(immutable.headers.get('cache-control'),/immutable/);
  for(const url of ['/downloads/taha-staff/releases/stable.json','/downloads/taha-staff/private/secret','/downloads/taha-staff/%2e%2e/private/secret','/api/v1/health'])assert.equal((await fetch(base+url)).status,404);
  assert.equal((await fetch(base+'/downloads/taha-staff',{method:'POST'})).status,405);
 }finally{if(server)await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});
test('interrupted publication preserves the previous current manifest',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'taha-publish-interrupt-'));try{const input=path.join(root,'input.apk');await writeFile(input,bytes);await publishRelease(root,input,release);await mkdir(path.join(root,'releases/test-13.json'));const next={...release,versionCode:13,apkUrl:'/downloads/taha-staff/apks/test/13/next.apk'};await assert.rejects(publishRelease(root,input,next));assert.deepEqual(JSON.parse(await readFile(path.join(root,'releases/test.json'),'utf8')),release);}finally{await rm(root,{recursive:true,force:true});}
});
