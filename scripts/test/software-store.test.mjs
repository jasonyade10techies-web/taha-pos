import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {localReleaseStore,verifiedAsset,readJson} from '../../distribution/release-store.mjs';
import {s3ReleaseStore} from '../../distribution/s3-store.mjs';
const data=Buffer.from('approved installer fixture'),sha=createHash('sha256').update(data).digest('hex');
test('local software store verifies streamed bytes, rejects corruption and confines metadata',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'taha-software-'));try{
  await mkdir(path.join(root,'windows'));await writeFile(path.join(root,'windows/test.exe'),data);await writeFile(path.join(root,'release.json'),'{"channel":"staging"}');const store=localReleaseStore(root);
  assert.deepEqual(await readJson(store,'release.json'),{channel:'staging'});await verifiedAsset(store,'windows/test.exe',data.length,sha,new Map());
  await assert.rejects(readJson(store,'../secret'));await assert.rejects(verifiedAsset(store,'windows/test.exe',data.length,'a'.repeat(64),new Map()));
  await writeFile(path.join(root,'too-large.json'),'x'.repeat(32769));await assert.rejects(readJson(store,'too-large.json'));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('durable store scopes every object, pins reads to ETag and never exposes media keys',async()=>{
 const calls=[];class Head{constructor(input){this.input=input;}}class Get{constructor(input){this.input=input;}}
 const client={send:async command=>{calls.push(command.input);return command instanceof Head?{ContentLength:data.length,ETag:'version1'}:{Body:Readable.from(data),ContentLength:data.length,ETag:'version1'};}};
 const store=s3ReleaseStore({client,bucket:'private-fixture',prefix:'software-releases/v1/',HeadObjectCommand:Head,GetObjectCommand:Get});
 await verifiedAsset(store,'windows/test.exe',data.length,sha,new Map());assert(calls.every(c=>c.Key==='software-releases/v1/windows/test.exe'));assert.equal(calls.at(-1).IfMatch,'version1');
 for(const key of ['../media/customer.jpg','/media/secret','windows/../secret','a\\b','a%2fb'])await assert.rejects(store.head(key));
});
