import assert from 'node:assert/strict';
import {test} from 'node:test';
import {serviceInput} from '../src/workflows/validation';
const base={name:'Battery replacement',category:'Repair',sellingPrice:2500,minimumSellingPrice:0};
test('explicit null unlinks a template, while omitted linkage remains omitted',()=>{
 assert.equal(serviceInput({...base,linkedProductId:null}).linkedProductId,null);
 assert.equal(Object.hasOwn(serviceInput(base),'linkedProductId'),false);
 assert.equal(serviceInput({...base,linkedProductId:null,defaultLaborCharge:null,pricingRule:null}).linkedProductId,null);
});
test('a fixed explicit zero is distinct from a missing configured price',()=>{
 assert.equal(serviceInput({...base,sellingPrice:0}).sellingPrice,0);
 assert.throws(()=>serviceInput({...base,sellingPrice:''}));
 assert.throws(()=>serviceInput({...base,sellingPrice:undefined}));
});
test('unlink does not silently accept a nonzero labor allocation without material',()=>{
 assert.throws(()=>serviceInput({...base,linkedProductId:null,defaultLaborCharge:500}));
});
