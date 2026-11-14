import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
test('source-root Hostinger entry starts the existing API with bundled UI and the assigned port',()=>{const directory=mkdtempSync(path.join(tmpdir(),'taha-source-start-'));try{mkdirSync(path.join(directory,'server/dist'),{recursive:true});writeFileSync(path.join(directory,'server/hostinger.cjs'),readFileSync('server/hostinger.cjs'));writeFileSync(path.join(directory,'server/dist/main.js'),`exports.createApp=async()=>({listen:async(port,host)=>{if(port!==43210||host!=='0.0.0.0'||process.env.TAHA_SERVE_FRONTEND!=='true'||!process.env.TAHA_FRONTEND_ROOT.endsWith('dist-staging'))throw Error('Invalid entry');}});exports.startLanTls=async()=>{};`);writeFileSync(path.join(directory,'server/dist/config.js'),`exports.configuration=()=>({port:Number(process.env.PORT),bindHost:process.env.TAHA_BIND_HOST});`);const result=spawnSync(process.execPath,['server/hostinger.cjs'],{cwd:directory,encoding:'utf8',env:{...process.env,PORT:'43210',TAHA_BIND_HOST:'0.0.0.0',MIGRATE_ON_START:'false'},timeout:10000});assert.equal(result.status,0);assert.match(result.stdout,/listening/);}finally{rmSync(directory,{recursive:true,force:true});}});
