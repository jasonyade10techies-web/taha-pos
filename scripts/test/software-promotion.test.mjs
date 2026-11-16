import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {promoteSoftware} from '../../distribution/promotion.mjs';
const bytes=Buffer.from('synthetic apk'),key='apks/test/13/test.apk';
const release={schemaVersion:1,channel:'test',applicationId:'com.tahamobiles.staff.debug',versionName:'test',versionCode:13,apkUrl:'/downloads/taha-staff/'+key,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),signingCertificateSha256:'a'.repeat(64),releasedAt:'2026-11-14T12:00:00Z',minAndroidApi:26,minBackendApiVersion:1,required:false,releaseNotes:[]};
test('cloud release pointer moves last, verification failure cannot publish and interrupted upload retains prior release',async()=>{
 const calls=[],writer={current:async()=>null,immutable:async key=>{calls.push(key);},pointer:async key=>calls.push(key)};
 await assert.rejects(promoteSoftware({release,assets:new Map([[key,bytes]]),writer}),/signature verifier/);assert.deepEqual(calls,[]);
 await promoteSoftware({release,assets:new Map([[key,bytes]]),writer,verifyAndroid:async()=>{}});assert.deepEqual(calls,[key,'releases/test-13.json','releases/test.json']);
 calls.length=0;await assert.rejects(promoteSoftware({release,assets:new Map([[key,bytes]]),writer:{...writer,immutable:async key=>{calls.push(key);throw Error('interrupted');}},verifyAndroid:async()=>{}}));assert.deepEqual(calls,[key]);
});
