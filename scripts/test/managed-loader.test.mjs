import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

for(const entryScoped of [false,true])test('CommonJS hosting loader observes '+(entryScoped?'entry-scoped':'cached')+' HTTP shim listen synchronously',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'taha-loader-contract-'));
 try{
  await mkdir(path.join(root,'dist'));
  for(const name of ['main.js','server.cjs'])await writeFile(path.join(root,name),await readFile('scripts/managed-release/'+name));
  await writeFile(path.join(root,'runner.cjs'),`
   const assert=require('node:assert/strict'),{EventEmitter}=require('node:events');let observed=0,handler;
   const server=new EventEmitter();server.close=()=>{};server.listen=(port,host)=>{assert.equal(port,43211);assert.equal(host,'127.0.0.1');observed++;return server;};
   const shim={createServer:callback=>{handler=callback;return server;}};
   if(${entryScoped}){const {Module}=require('node:module'),filename=require.resolve('./main.js'),entry=new Module(filename,module);entry.filename=filename;entry.paths=module.paths;const base=entry.require.bind(entry);entry.require=id=>id==='http'?shim:base(id);entry._compile(require('node:fs').readFileSync(filename,'utf8'),filename);}
   else{require.cache.http={id:'http',filename:'http',loaded:true,exports:shim};require('./main.js');}
   assert.equal(observed,1,'The managed HTTP shim must see listen before the entry returns');
   let status,body;handler({method:'POST',url:'/api/v1/checkout'},{writeHead:value=>{status=value;},end:value=>{body=JSON.parse(value);}});
   assert.equal(status,503);assert.equal(body.code,'STARTING');console.log('hosting-loader-captured-listen');
  `);
  const result=spawnSync(process.execPath,['runner.cjs'],{cwd:root,encoding:'utf8',timeout:5000,env:{...process.env,NODE_ENV:'production',TAHA_RUNTIME:'cloud',PORT:'43211',TAHA_BIND_HOST:'127.0.0.1',MIGRATE_ON_START:'false'}});
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/hosting-loader-captured-listen/);
 }finally{await rm(root,{recursive:true,force:true});}
});
