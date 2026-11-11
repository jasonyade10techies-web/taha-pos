import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
const origin=process.env.TAHA_TEST_SHOP_URL;
if(!origin)throw new Error('Set TAHA_TEST_SHOP_URL to the local test API origin.');
const target=new URL(origin);if(!/^192\.168\./.test(target.hostname)||target.pathname!=='/')throw new Error('This diagnostic command is limited to a private LAN test server.');
const password=process.env.TAHA_TEST_PASSWORD;if(!password)throw new Error('Set TAHA_TEST_PASSWORD for the existing test account.');
const headers={Origin:'http://localhost','Content-Type':'application/json'};
let token:string|undefined,job:{id:string}|undefined,store:string|undefined;
async function request(path:string,method='GET',body?:unknown){const r=await fetch(target.origin+'/api/v1'+path,{method,headers:{...headers,...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});assert(r.ok,`HTTP ${r.status} from ${path}`);return r.json();}
async function run(){
 try{
  const health=await request('/health');assert.equal(health.database,'connected');
  const login=await request('/auth/login','POST',{email:'owner@taha.test',password,deviceName:'LAN camera transport diagnostic'});token=login.accessToken;store=login.context.store.id;
  job=await request(`/stores/${store}/camera/test`,'POST',{});assert(job);
  const bytes=await sharp({create:{width:1200,height:800,channels:3,background:'#ffc107'}}).jpeg().toBuffer();const id=randomUUID(),form=new FormData();form.set('captureId',id);form.set('file',new Blob([bytes],{type:'image/jpeg'}),'diagnostic.jpg');const start=performance.now();
  const uploaded=await fetch(target.origin+`/api/v1/stores/${store}/camera/jobs/${job.id}/captures`,{method:'POST',headers:{Origin:'http://localhost',Authorization:'Bearer '+token},body:form,signal:AbortSignal.timeout(30000)});assert.equal(uploaded.status,201);assert.equal(uploaded.headers.get('access-control-allow-origin'),'http://localhost');const result=await uploaded.json();assert.equal(result.capture.captureId,id);
  const thumb=await fetch(result.capture.thumbnailUrl,{signal:AbortSignal.timeout(10000)});assert.equal(thumb.status,200);const metadata=await sharp(Buffer.from(await thumb.arrayBuffer())).metadata();assert(metadata.width&&metadata.width<=360);
  console.log(JSON.stringify({health:'pass',multipart:'pass',cors:'http://localhost',idempotentCaptureId:true,thumbnail:'pass',thumbnailWidth:metadata.width,storedBytes:result.capture.size,milliseconds:Math.round(performance.now()-start)}));
 }finally{if(job&&store)await request(`/stores/${store}/camera/jobs/${job.id}/test`,'DELETE');if(token)await request('/auth/logout','POST');}
}
run().catch(e=>{console.error(e.message);process.exitCode=1;});
