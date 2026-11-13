import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,connect,TLSSocket} from 'node:tls';
import {Socket} from 'node:net';
import {once} from 'node:events';
import {mkdtemp,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {verifiedPostgresTls} from '../src/database/verified-tls';

test('PostgreSQL TLS is proved by the live certificate-verified client connection',{timeout:30000},async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'taha-r2c-tls-')),certRoot=path.join(directory,'certificate');
 execFileSync(process.env.TAHA_PDF_PYTHON??'python',['-X','utf8',path.resolve('../scripts/r2b-test-certificate.py'),certRoot],{windowsHide:true});
 const cert=await readFile(path.join(certRoot,'cert.pem')),key=await readFile(path.join(certRoot,'key.pem')),server=createServer({cert,key}),sockets:TLSSocket[]=[];
 server.on('secureConnection',socket=>sockets.push(socket));server.on('tlsClientError',()=>{/* Expected untrusted-certificate fixture. */});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert(address&&typeof address==='object');
 const open=async(trusted:boolean)=>{const socket=connect({host:'127.0.0.1',port:address.port,...(trusted?{ca:cert,rejectUnauthorized:true}:{rejectUnauthorized:false})});sockets.push(socket);await once(socket,'secureConnect');return socket;};
 try{
  const trusted=await open(true);
  await t.test('a trusted, matching certificate passes regardless of a proxy internal TLS report',()=>{assert.equal(trusted.authorized,true);assert.equal(verifiedPostgresTls({host:'127.0.0.1',connection:{stream:trusted}}),true);});
  await t.test('an authorized certificate for a different hostname is rejected',()=>{assert.equal(verifiedPostgresTls({host:'different.invalid',connection:{stream:trusted}}),false);});
  await t.test('encrypted but untrusted TLS cannot pass readiness',async()=>{const untrusted=await open(false);assert.equal(untrusted.encrypted,true);assert.equal(untrusted.authorized,false);assert.equal(verifiedPostgresTls({host:'127.0.0.1',connection:{stream:untrusted}}),false);});
  await t.test('plaintext and closed sockets cannot pass readiness',()=>{const plain=new Socket();try{assert.equal(verifiedPostgresTls({host:'127.0.0.1',connection:{stream:plain}}),false);}finally{plain.destroy();}trusted.destroy();assert.equal(verifiedPostgresTls({host:'127.0.0.1',connection:{stream:trusted}}),false);});
 }finally{for(const socket of sockets)socket.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
