import assert from 'node:assert/strict';
import {test} from 'node:test';
test('router/hotspot selection uses a live explicit adapter and recovers from stale DHCP',async()=>{
 const {selectLanAddress}=await import('../src/auth/lan-discovery');
 assert.equal(selectLanAddress(['192.168.1.3','192.168.137.1'],'192.168.137.1'),'192.168.137.1');
 assert.equal(selectLanAddress(['192.168.1.3'],'192.168.1.8'),'192.168.1.3');
 assert.equal(selectLanAddress(['127.0.0.1','0.0.0.0']),'localhost');
});
test('DNS-SD announces the actual protected listener and contains no enrollment credentials',async()=>{
 const dns=await import('../src/auth/lan-discovery').catch(()=>null);
 assert.equal(typeof dns?.discoveryPacket,'function','The protected listener must provide DNS-SD service records.');
 const packet=dns!.discoveryPacket({address:'192.168.1.3',port:3443,name:'Taha Counter',host:'taha-test.local'});
 assert.equal(packet.readUInt16BE(2),0x8400);assert.equal(packet.readUInt16BE(6),4);
 assert(packet.includes(Buffer.from('_taha-pos')));assert(packet.includes(Buffer.from([192,168,1,3])));
 assert(!/challenge|token|password|refresh/i.test(packet.toString()));
 assert.throws(()=>dns!.discoveryPacket({address:'0.0.0.0',port:3443,name:'Counter',host:'taha.local'}));
});
test('discovery only responds to bounded Taha DNS queries and ignores responses and malformed compression',async()=>{
 const dns=await import('../src/auth/lan-discovery').catch(()=>null);assert.equal(typeof dns?.isTahaQuery,'function');
 const label=(s:string)=>Buffer.concat(s.split('.').filter(Boolean).map(v=>Buffer.concat([Buffer.from([Buffer.byteLength(v)]),Buffer.from(v)])));
 const header=Buffer.alloc(12);header.writeUInt16BE(1,4);
 const query=Buffer.concat([header,label('_taha-pos._tcp.local'),Buffer.from([0,0,12,0,1])]);
 assert(dns!.isTahaQuery(query));const response=Buffer.from(query);response.writeUInt16BE(0x8000,2);assert(!dns!.isTahaQuery(response));
 assert(!dns!.isTahaQuery(Buffer.alloc(9000)));assert(!dns!.isTahaQuery(Buffer.concat([header,Buffer.from([0xc0,0x0c,0,12,0,1])])));
});
