import assert from 'node:assert/strict';
import {test} from 'node:test';
import jwt from 'jsonwebtoken';
import {ReceiptService} from '../src/receipts/receipt.service';
import type {Database} from '../src/database/database.service';
import type {Configuration} from '../src/config';
test('opaque receipt references are stable, scoped, expiring and never authenticate accounts; legacy receipt links survive',async()=>{
 const references=new Map<string,{store:string;sale:string}>();let valid=true;
 const db={query:async(sql:string,args:string[])=>{
  if(sql.startsWith('insert into app_private.receipt_references')){references.set(args[0],{store:args[1],sale:args[2]});return {rows:[]};}
  if(sql.startsWith('select store_id'))return {rows:valid&&references.has(args[0])?[references.get(args[0])]:[]};
  return {rows:[{value:{invoice:'TM-INV-1',total:200}}]};
 }} as unknown as Database;
 const config={secret:'isolated-receipt-capability-test-secret',publicUrl:'https://shop.test'} as Configuration;
 const service=new ReceiptService(db,config),first=await service.url('shop-a','sale-a'),repeat=await service.url('shop-a','sale-a'),different=await service.url('shop-b','sale-a');
 assert.equal(first,repeat);assert.notEqual(first,different);const token=first.split('/').at(-1)!;assert.match(token,/^[A-Za-z0-9_-]{43}$/);assert.equal(references.size,2);assert.equal((await service.read(token)).total,200);
 await assert.rejects(service.read(token.slice(0,-1)+(token.endsWith('x')?'y':'x')),/invalid or expired/);valid=false;await assert.rejects(service.read(token),/invalid or expired/);
 const legacy=jwt.sign({store:'shop-a',sale:'sale-a'},config.secret,{issuer:'taha-pos',audience:'taha-customer-receipt',expiresIn:'1h'});assert.equal((await service.read(legacy)).invoice,'TM-INV-1');
 const account=jwt.sign({store:'shop-a',sale:'sale-a'},config.secret,{issuer:'taha-pos',audience:'taha-access',expiresIn:'1h'});await assert.rejects(service.read(account),/invalid or expired/);
});
