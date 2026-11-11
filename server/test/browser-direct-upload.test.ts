import assert from 'node:assert/strict';
import {test} from 'node:test';
import http from 'node:http';
const modulePath='../../src/lib/api/direct-upload';

// API fake stops at the external service boundary. Browser fetch, form bytes,
// digest, retry state and completion orchestration are production code.
test('browser direct upload sends >4.5MB bytes only to provider without POS credentials',async()=>{
 const library=await import(modulePath).catch(()=>({}));assert.equal(typeof library.uploadBrowserMedia,'function','Browser direct upload transport must exist');
 const bytes=Buffer.alloc(5*1024*1024,91);let observed=false;
 const server=http.createServer(async(req,res)=>{const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));assert.equal(req.headers.authorization,undefined);assert.equal(req.headers.cookie,undefined);const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':req.headers['content-type']!}}).formData();assert.equal(form.get('key'),'staging/shop/profile/id');assert.equal((form.get('file') as File).size,5*1024*1024);observed=true;res.writeHead(204).end();});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const provider='http://127.0.0.1:'+(server.address() as any).port;let grantCalls=0;
 const request=async(path:string,options:any)=>{assert(!options.body?.includes('data:image/'));if(path.endsWith('/upload-grants')){const b=JSON.parse(options.body);assert.equal(b.size,5*1024*1024);assert.match(b.sha256,/^[a-f0-9]{64}$/);grantCalls++;return {mode:'direct',id:'grant',url:provider,fields:{key:'staging/shop/profile/id','Content-Type':'image/png'}};}assert.equal(path,'/stores/shop/media/upload-grants/grant/complete');assert(observed);return {path:'shop/final.webp'};};
 try{assert.equal(await library.uploadBrowserMedia('/stores/shop',new Blob([bytes],{type:'image/png'}),{kind:'product',staged:true},request),'shop/final.webp');assert.equal(grantCalls,1);}finally{await new Promise<void>(r=>server.close(()=>r()));}
});

test('lost completion retries same capture ID and local storage falls back without direct transfer',async()=>{
 const library=await import(modulePath).catch(()=>({}));assert.equal(typeof library.uploadBrowserMedia,'function','Browser direct upload transport must exist');
 const server=http.createServer(async(req,res)=>{for await(const _chunk of req){/* drain form bytes */}res.writeHead(204).end();});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const image=new Blob(['fixture'],{type:'image/png'});let id:string|undefined,grantCalls=0,completeCalls=0;
 const request=async(path:string,options:any)=>{if(path.endsWith('/upload-grants')){const body=JSON.parse(options.body);if(id)assert.equal(body.uploadId,id,'An interrupted capture must reuse its request ID');id=body.uploadId;grantCalls++;return grantCalls===1?{mode:'direct',id:'grant',url:'http://127.0.0.1:'+(server.address() as any).port,fields:{key:'staging/id'}}:{mode:'completed',result:{path:'private/existing.webp'}};}completeCalls++;throw new Error('Completion response was lost');};
 try{await assert.rejects(()=>library.uploadBrowserMedia('/stores/shop',image,{kind:'profile'},request),/Completion response was lost/);assert.equal(await library.uploadBrowserMedia('/stores/shop',image,{kind:'profile'},request),'private/existing.webp');assert.equal(completeCalls,1);assert.equal(grantCalls,2);
 assert.equal(await library.uploadBrowserMedia('/stores/shop',image,{kind:'profile'},async()=>({mode:'multipart'})),null);}finally{await new Promise<void>(r=>server.close(()=>r()));}
});
