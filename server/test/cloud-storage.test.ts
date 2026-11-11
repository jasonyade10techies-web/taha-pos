import assert from 'node:assert/strict';
import {test} from 'node:test';
import {LocalFileStorage} from '../src/media/file-storage';
import type {Configuration} from '../src/config';

test('local storage never issues cloud upload grants',()=>{
 const storage=new LocalFileStorage({storageRoot:'.test-postgres/unused-media-test',storageDriver:'local'} as Configuration);
 assert.equal(typeof (storage as any).directUpload,'function','Storage must implement scoped cloud grants');
 assert.equal((storage as any).directUpload('staging/private/file','image/png',1024,new Date(Date.now()+300000)),null);
});

test('cloud policy has exact private scope, enforced byte range and bounded expiry',()=>{
 const storage=new LocalFileStorage({storageRoot:'.test-postgres/unused-media-test',storageDriver:'s3',s3Bucket:'private-bucket',s3Region:'us-east-1',s3Endpoint:'https://objects.example',s3AccessKey:'fixture',s3SecretKey:'fixture-secret'} as Configuration);
 assert.equal(typeof (storage as any).directUpload,'function','Storage must implement scoped cloud grants');
 const result=(storage as any).directUpload('staging/store/profile/id','image/png',1024,new Date('2030-01-02T03:09:05.000Z'),new Date('2030-01-02T03:04:05.000Z'));
 assert.equal(result.url,'https://objects.example/private-bucket');const policy=JSON.parse(Buffer.from(result.fields.policy,'base64').toString());
 assert.equal(policy.expiration,'2030-01-02T03:09:05.000Z');assert(policy.conditions.some((c:any)=>c.key==='staging/store/profile/id'));assert(policy.conditions.some((c:any)=>c['Content-Type']==='image/png'));assert(policy.conditions.some((c:any)=>Array.isArray(c)&&c[0]==='content-length-range'&&c[1]===1024&&c[2]===1024));assert.equal(result.fields.acl,undefined);
});

test('readiness probes a real private bucket and reports missing buckets as unavailable',async()=>{
 const http=await import('node:http');const server=http.createServer((req,res)=>{if(req.method==='HEAD'&&req.url?.startsWith('/private-bucket')&&req.headers.authorization)res.writeHead(200).end();else res.writeHead(404).end();});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const config={storageRoot:'.test-postgres/unused-media-test',storageDriver:'s3',s3Bucket:'private-bucket',s3Region:'us-east-1',s3Endpoint:'http://127.0.0.1:'+(server.address() as any).port,s3AccessKey:'fixture',s3SecretKey:'fixture-secret'} as Configuration;
 try{const good=new LocalFileStorage(config);assert.equal(typeof (good as any).probe,'function','Readiness must query object storage');await (good as any).probe();const missing=new LocalFileStorage({...config,s3Bucket:'missing-bucket'});await assert.rejects(()=>(missing as any).probe());}finally{await new Promise<void>(r=>server.close(()=>r()));}
});

test('object reads reject provider sizes and chunked bodies beyond the authorized bound',async()=>{
 const http=await import('node:http');const server=http.createServer((req,res)=>{if(req.url?.includes('/declared'))res.writeHead(200,{'Content-Length':'100'}).end(Buffer.alloc(100));else{res.writeHead(200);res.write(Buffer.alloc(7));res.end(Buffer.alloc(7));}});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const storage=new LocalFileStorage({storageRoot:'.test-postgres/unused-media-test',storageDriver:'s3',s3Bucket:'private-bucket',s3Region:'us-east-1',s3Endpoint:'http://127.0.0.1:'+(server.address() as any).port,s3AccessKey:'fixture',s3SecretKey:'fixture-secret'} as Configuration);
 try{await assert.rejects(()=>storage.readBounded('declared',8),/too large/);await assert.rejects(()=>storage.readBounded('chunked',8),/too large/);}finally{await new Promise<void>(r=>server.close(()=>r()));}
});
