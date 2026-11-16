import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createSoftwareHandler} from '../../distribution/software-handler.mjs';
test('one public portal serves versioned Windows files and HTTPS updater metadata without private records',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'taha-software-http-'));let server;
 try{
  const bytes=Buffer.from('synthetic installer bytes'),url='/downloads/taha-pos/windows/staging/0.5.1/setup.exe';
  const release={schemaVersion:1,platform:'windows-x86_64',channel:'staging',applicationId:'com.tahamobiles.pos.staging',version:'0.5.1',releasedAt:'2026-11-14T12:00:00Z',releaseNotes:['Test release'],files:[{type:'nsis',url,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),signature:Buffer.from('test signature metadata').toString('base64')}]};
  await mkdir(path.join(root,'windows/staging/0.5.1'),{recursive:true});await mkdir(path.join(root,'releases'));await writeFile(path.join(root,'windows/staging/0.5.1/setup.exe'),bytes);
  for(const name of ['windows-staging','windows-staging-0.5.1'])await writeFile(path.join(root,'releases',name+'.json'),JSON.stringify(release));
  const handler=createSoftwareHandler(root,{publicOrigin:'https://shop.test'});server=createServer(async(req,res)=>{if(!await handler(req,res)){res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const page=await fetch(base+'/downloads');assert.equal(page.status,200);const html=await page.text();assert(html.includes('Windows'));assert(html.includes('Android'));assert(html.includes(url));assert(!html.includes('purchase_cost'));assert(html.includes('No verified release'));
  const updater=await (await fetch(base+'/downloads/taha-pos/updates/staging.json',{headers:{Host:'evil.test'}})).json();assert.equal(updater.platforms['windows-x86_64'].url,'https://shop.test'+url);assert.equal(updater.platforms['windows-x86_64'].sha256,release.files[0].sha256);
  const installer=await fetch(base+url);assert.equal(installer.status,200);assert.deepEqual(Buffer.from(await installer.arrayBuffer()),bytes);assert.match(installer.headers.get('cache-control'),/immutable/);
  assert.equal((await fetch(base+url+'.sig')).status,200);assert.equal((await fetch(base+url,{method:'HEAD'})).headers.get('content-length'),String(bytes.length));
  for(const route of ['/downloads/taha-pos/windows/staging/0.5.1/unknown.exe','/downloads/private/customer.jpg','/downloads/taha-pos/updates/stable.json','/api/v1/health'])assert.equal((await fetch(base+route)).status,404);
  assert.equal((await fetch(base+'/downloads',{method:'POST'})).status,405);
  await writeFile(path.join(root,'windows/staging/0.5.1/setup.exe'),'corrupt');assert.equal((await fetch(base+url)).status,404);
 }finally{if(server)await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});
