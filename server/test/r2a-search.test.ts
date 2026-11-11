import assert from 'node:assert/strict';
import {test} from 'node:test';
import {searchProducts as backend} from '../src/business/product-search';
import {searchProducts as frontend} from '../../src/lib/product-search';

const products = [
 {name:'Samsung Galaxy A15 Charging Board',brand:'Samsung',compatibleModel:'A15',internalCode:'TM-P-000001',aliases:['charging patta','8901234567890']},
 {name:'iPhone 13 Battery',brand:'Apple',compatibleModel:'iPhone 13',internalCode:'TM-P-000002',aliases:['battri','8901234567891']},
 {name:'Vivo Y20 Screen',brand:'Vivo',compatibleModel:'Y20',internalCode:'TM-P-000003',aliases:[]},
 {name:'Diagnosis',brand:'',compatibleModel:'',internalCode:'TM-S-000004',aliases:['repair inspection']},
];
for(const [name,search] of [['frontend',frontend],['backend',backend]] as const){
 test(name+' short word prefixes and service names work from the first character',()=>{
  for(const q of ['s','sa','sam','  SAMSUNG  '])assert.equal(search(products,q)[0]?.internalCode,'TM-P-000001',q);
  for(const q of ['i','ip','iph','b','ba','bat','batt'])assert.equal(search(products,q)[0]?.internalCode,'TM-P-000002',q);
  assert.equal(search(products,'di')[0]?.name,'Diagnosis');
  assert.equal(search(products,'a1')[0]?.internalCode,'TM-P-000001');
  assert.equal(search(products,'iphone1')[0]?.internalCode,'TM-P-000002');
 });
 test(name+' dictionary aliases retain prefix, fuzzy and Roman Urdu lookup',()=>{
  for(const q of ['pa','pan','panel','lcd'])assert.equal(search(products,q)[0]?.name,'Vivo Y20 Screen',q);
  for(const q of ['charging patta','a15 charging patti'])assert.equal(search(products,q)[0]?.internalCode,'TM-P-000001',q);
  assert.equal(search(products,'battry')[0]?.internalCode,'TM-P-000002');
 });
 test(name+' exact SKU/barcode identity and partial SKU lookup remain deterministic',()=>{
  assert.equal(search(products,' tm-p-000002 ')[0]?.internalCode,'TM-P-000002');
  assert.equal(search(products,'8901234567891')[0]?.internalCode,'TM-P-000002');
  assert.deepEqual(search(products,'8901234567892'),[],'Never fuzzy-match a different barcode');
  assert.equal(search(products,'TM-P-000').length,3);
  assert.deepEqual(search(products,'   '),products);
 });
}
