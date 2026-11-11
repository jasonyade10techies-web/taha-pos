import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {selectLocalApiPort} from './local-service-ports.mjs';
test('local launcher reuses only a healthy Taha API and does not accept another project on3001',async()=>{
 const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
 const other=http.createServer((_q,r)=>r.end('<h1>Another project</h1>'));const taha=http.createServer((_q,r)=>{r.setHeader('Content-Type','application/json');r.end(JSON.stringify({application:'taha-pos',status:'ok',database:'connected'}));});
 const a=await listen(other),b=await listen(taha);try{assert.deepEqual(await selectLocalApiPort([a,b]),{port:b,reuse:true});await assert.rejects(()=>selectLocalApiPort([a]),/occupied|available/i);}finally{other.closeAllConnections();taha.closeAllConnections();await Promise.all([new Promise(r=>other.close(r)),new Promise(r=>taha.close(r))]);}
});
