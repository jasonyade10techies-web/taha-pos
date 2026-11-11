import assert from 'node:assert/strict';
import {test} from 'node:test';
import {displaySnapshot} from '../src/display/display-snapshot';
const base={mode:'CART_ACTIVE',terminalId:'counter-A',items:[{id:'p1',name:'Battery',variant:'Original',quantity:1,unitPrice:3600}],subtotal:3600,discount:0,total:3600};
test('customer display rejects nested cost/stock controls and proof data',()=>{
 assert.throws(()=>displaySnapshot({...base,items:[{...base.items[0],purchaseCost:10}]},'counter-A'));
 assert.throws(()=>displaySnapshot({...base,payment:{method:'JazzCash',total:3600,proofPath:'private/proof'}},'counter-A'));
 assert.throws(()=>displaySnapshot({...base,config:{phone:'',address:'',promotions:true,paymentQr:true,enabled:true,fullscreen:false,completeDuration:15,methods:[{name:'Cash',kind:'Cash',accountSecret:'secret'}]}},'counter-A'));
});
test('customer display validates finite monetary values and the exact counter',()=>{
 assert.throws(()=>displaySnapshot({...base,total:Infinity},'counter-A'));
 assert.throws(()=>displaySnapshot(base,'counter-B'));
 assert.throws(()=>displaySnapshot({...base,items:[{...base.items[0],quantity:0}]},'counter-A'));
});
test('customer display accepts receipt and configured payment instructions without private fields',()=>{
 const input={...base,mode:'SALE_COMPLETE',invoiceNumber:'TM-INV-000123',saleId:'reference',completedAt:new Date().toISOString(),payment:{method:'Bank Transfer',kind:'Digital',total:3600,title:'TAHA MOBILES',number:'012345',iban:'PK00TEST',qr:'https://payments.example/qr.png'}};
 assert.deepEqual(displaySnapshot(input,'counter-A'),input);
 assert.throws(()=>displaySnapshot({...base,payment:{method:'Bank',total:3600,qr:'javascript:alert(1)'}},'counter-A'));
 const qr='http://localhost:3000/api/v1/media/50000000-0000-4000-8000-000000000001?token=test';
 assert.doesNotThrow(()=>displaySnapshot({...base,payment:{method:'Bank',total:3600,qr}},'counter-A','http://localhost:3000'));
 assert.throws(()=>displaySnapshot({...base,payment:{method:'Bank',total:3600,qr:'http://evil.example/qr.png'}},'counter-A','http://localhost:3000'));
});
