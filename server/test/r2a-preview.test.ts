import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Sale,ReturnRecord} from '../../src/types/demo';
import {returnPreview} from '../../src/lib/return-preview';
import {normalizeWhatsapp,whatsappUrl} from '../../src/lib/reminders';
const sale=(changes:Partial<Sale>={}):Sale=>({id:'sale',invoice:'TEST',customerId:'customer',customerName:'Isolated',employeeId:'owner',employeeName:'Owner',createdAt:new Date().toISOString(),lines:[{productId:'part',name:'Battery',variant:'',quantity:3,originalPrice:2000,unitPrice:2000,discount:0,total:6000,locationId:'box',service:false}],subtotal:6000,discount:0,total:6000,coupon:'',status:'Paid',payments:[],returned:{},paid:6000,outstanding:0,...changes});
test('return preview distinguishes cash payout from remaining invoice debt and over-return',()=>{
 const cash=returnPreview(sale(),[],'part',1)!;assert.equal(cash.manualRefund,2000);assert.equal(cash.creditReduction,0);
 const credit=returnPreview(sale({outstanding:2600}),[],'part',2)!;assert.equal(credit.manualRefund,1400);assert.equal(credit.creditReduction,2600);assert.equal(credit.after,0);
 assert.equal(returnPreview(sale({returned:{part:2}}),[],'part',2),null);
});
test('last partial return preserves rounding and historical amounts',()=>{
 const sample=sale();sample.lines[0].total=10;sample.total=10;sample.returned={part:2};
 const history=[{saleId:'sale',productId:'part',quantity:2,amount:6.66}] as ReturnRecord[];
 assert.equal(returnPreview(sample,history,'part',1)?.amount,3.34);
});
test('compound preview uses product/tax snapshots and retains labor unless explicitly refunded',()=>{
 const sample=sale();sample.lines[0].quantity=2;sample.lines[0].compound={productSellingBasis:2000,productRevenue:4000,laborRevenue:1000,productDiscount:0,productTax:400,laborTax:100,productTotal:4400,laborTotal:1100};
 assert.equal(returnPreview(sample,[],'part',1)?.amount,2200);
 assert.equal(returnPreview(sample,[],'part',1,true)?.amount,2750);
});
test('WhatsApp accepts safe Pakistani formats and rejects text or URL masquerading as a number',()=>{
 for(const value of ['0300 1234567','+92 (300) 123-4567','00923001234567'])assert.equal(normalizeWhatsapp(value),'923001234567');
 for(const value of ['customer03001234567','https://example.test/03001234567','++923001234567','0300'])assert.equal(normalizeWhatsapp(value),'');
 const url=new URL(whatsappUrl('03001234567','Invoice 123\nNothing was sent.'));assert.equal(url.hostname,'wa.me');assert.equal(url.pathname,'/923001234567');assert.equal(url.searchParams.get('text'),'Invoice 123\nNothing was sent.');
});
