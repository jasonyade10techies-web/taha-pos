import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
function rehearsal(fail=false){
 const folder=mkdtempSync(join(tmpdir(),'taha-startup-'));
 try{mkdirSync(join(folder,'dist'));writeFileSync(join(folder,'server.cjs'),readFileSync('../scripts/managed-release/server.cjs'));writeFileSync(join(folder,'dist/config.js'),'exports.CONFIG="config";');
  writeFileSync(join(folder,'dist/main.js'),fail?'exports.createApp=async()=>{throw Error("PRIVATE_SENTINEL_MUST_NOT_APPEAR")};exports.startLanTls=async()=>{};':'exports.createApp=async()=>({get:()=>({port:0,bindHost:"127.0.0.1"}),listen:async()=>{}});exports.startLanTls=async()=>{};');
  return spawnSync(process.execPath,['server.cjs'],{cwd:folder,env:{...process.env,MIGRATE_ON_START:'false'},encoding:'utf8',windowsHide:true,timeout:10000});
 }finally{assert.equal(dirname(resolve(folder)),resolve(tmpdir()));assert(basename(folder).startsWith('taha-startup-'));rmSync(folder,{recursive:true,force:true});}
}
test('managed startup exposes monotonic stage timing without infrastructure configuration',()=>{
 const result=rehearsal();assert.equal(result.status,0);const events=result.stdout.trim().split('\n').map(line=>JSON.parse(line));assert.deepEqual(events.map(event=>event.stage),['boot','modules-loaded','application-created','listening','ready']);assert(events.every((event,index)=>event.elapsedMs>=0&&(!index||event.elapsedMs>=events[index-1].elapsedMs)));
});
test('managed startup identifies its failed stage without printing private exception text',()=>{
 const result=rehearsal(true);assert.equal(result.status,1);assert(!result.stdout.includes('PRIVATE_SENTINEL'));assert(!result.stderr.includes('PRIVATE_SENTINEL'));const events=result.stdout.trim().split('\n').map(line=>JSON.parse(line));assert.equal(events.at(-1).stage,'failed');assert.equal(events.at(-1).during,'modules-loaded');
});
