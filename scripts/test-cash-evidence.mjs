import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const file=join(mkdtempSync(join(tmpdir(),'taha-cash-evidence-')),'counter.sqlite3');
let db=new DatabaseSync(file);
db.exec(readFileSync('src-tauri/migrations/001_desktop.sql','utf8'));
const migration=readFileSync('src-tauri/migrations/002_cash_evidence.sql','utf8');
db.exec(migration);
const insert=readFileSync('src-tauri/sql/capture-cash.sql','utf8');
const scope='https://shop.test/api/v1|shop|employee',id=randomUUID(),invoice='TM-INV-O-'+id.toUpperCase();
const receipt={invoice,employeeId:'employee',employeeName:'Original Seller',createdAt:'2026-10-15T08:00:00Z',total:1000,cashReceived:1200,change:200,lines:[{name:'Battery',quantity:1,unitPrice:1000}],customerName:'Walk-in Customer'};
test('actual native SQL atomically retains immutable original receipt and collected cash',()=>{
 db.exec('BEGIN IMMEDIATE');db.prepare('INSERT INTO outbox(id,scope,type,payload,idempotency_key,created_at) VALUES(?,?,?,?,?,?)').run(id,scope,'CASH_SALE',JSON.stringify({terminalId:'counter',createdAt:receipt.createdAt}),id,Date.now());
 db.prepare('INSERT INTO receipts VALUES(?,?,?,?,?)').run(id,scope,invoice,JSON.stringify(receipt),Date.now());
 db.prepare(insert).run(id);db.exec('COMMIT');
 const c=db.prepare('select * from cash_evidence').get();assert.equal(c.collected_minor,100000);assert.equal(c.tendered_minor,120000);assert.equal(c.change_minor,20000);assert.equal(c.seller_id,'employee');
 assert.throws(()=>db.prepare('update cash_evidence set collected_minor=0 where id=?').run(id),/immutable/);assert.throws(()=>db.prepare('delete from cash_evidence').run(),/immutable/);
});
test('logout/employee switch and reopening preserve evidence independently of current employee',()=>{
 db.prepare('delete from drafts').run();db.close();db=new DatabaseSync(file);db.exec(migration);
 const prefix='https://shop.test/api/v1|shop|';assert.equal(db.prepare('select count(*) n from cash_evidence where substr(scope,1,length(?))=?').get(prefix,prefix).n,1);
 assert.equal(JSON.parse(db.prepare('select receipt from cash_evidence where id=?').get(id).receipt).employeeName,'Original Seller');
});
test('actual native cash projection exposes the retained legacy receipt to owner and preserves employee scope',()=>{
 const query=readFileSync('src-tauri/sql/list-cash-records.sql','utf8'),prefix='https://shop.test/api/v1|shop|';
 assert.equal(db.prepare(query).all(prefix+'different-employee',0,prefix).length,0);
 const row=db.prepare(query).get(prefix+'owner',1,prefix),record=JSON.parse(Object.values(row)[0]);
 assert.deepEqual(record.payload.receipt,receipt);assert.equal(record.seller_id,'employee');assert.equal(record.collected,1000);
 assert.equal(db.prepare(query).all('https://other.test/api/v1|shop|owner',1,'https://other.test/api/v1|shop|').length,0);
});
test('crash during sync preserves original identity and receipt even after server acknowledgment',()=>{
 db.exec("update outbox set status='SYNCING';update outbox set status='PENDING' where status='SYNCING'");
 db.prepare('update receipts set value=? where id=?').run(JSON.stringify({...receipt,id:'server-id',syncStatus:'SYNCED'}),id);
 assert.deepEqual(JSON.parse(db.prepare('select receipt from cash_evidence').get().receipt),receipt);
 assert.equal(db.prepare('select idempotency_key from outbox').get().idempotency_key,id);
});
test('duplicate capture and migration reruns cannot replace evidence or drop money',()=>{
 db.prepare(insert).run(id);db.exec(migration);assert.equal(db.prepare('select count(*) n from cash_evidence').get().n,1);
 assert.equal(db.prepare('select collected_minor from cash_evidence').get().collected_minor,100000);
});
test('rollback of local checkout does not leave a partial cash record',()=>{
 const second=randomUUID();db.exec('BEGIN IMMEDIATE');db.prepare('INSERT INTO outbox(id,scope,type,payload,idempotency_key,created_at) VALUES(?,?,?,?,?,?)').run(second,scope,'CASH_SALE','{}',second,Date.now());db.exec('ROLLBACK');assert.equal(db.prepare('select count(*) n from outbox').get().n,1);
});
test('actual shop reservation query includes previous employee cash and excludes another backend',()=>{
 db.prepare('insert into reservations values(?,?,?,?)').run(scope,'battery',id,2);
 const query=readFileSync('src-tauri/sql/reserved-shop-stock.sql','utf8');assert.equal(db.prepare(query).get('https://shop.test/api/v1|shop|','battery')['coalesce(sum(quantity),0)'],2);
 assert.equal(db.prepare(query).get('https://other.test/api/v1|shop|','battery')['coalesce(sum(quantity),0)'],0);
});
test('actual native closing query distinguishes unsubmitted evidence from server-registered retained cash',()=>{
 const query=readFileSync('src-tauri/sql/list-cash-backlog.sql','utf8'),prefix='https://shop.test/api/v1|shop|';
 const parse=()=>JSON.parse(Object.values(db.prepare(query).get(prefix))[0]);assert.equal(parse().registered,0);
 db.prepare(readFileSync('src-tauri/sql/record-cash-decision.sql','utf8')).run(id,'REGISTERED','owner','{}',Date.now());assert.equal(parse().registered,1);
 assert.throws(()=>db.exec('delete from cash_events'),/immutable/);
});
test('refund decisions close transport and release reservations while immutable cash receipt remains retained',()=>{
 db.exec('BEGIN IMMEDIATE');db.prepare(readFileSync('src-tauri/sql/record-cash-decision.sql','utf8')).run(id,'REFUNDED','owner',JSON.stringify({reason:'Actual customer refund',cashReturned:1000}),Date.now());
 db.prepare("UPDATE outbox SET status='SYNCED',error=NULL WHERE id=?").run(id);db.prepare('DELETE FROM reservations WHERE outbox_id=?').run(id);db.exec('COMMIT');
 assert.equal(db.prepare('select count(*) n from reservations').get().n,0);assert.equal(db.prepare('select collected_minor from cash_evidence').get().collected_minor,100000);
 assert.equal(JSON.parse(db.prepare('select receipt from cash_evidence').get().receipt).invoice,invoice);
});
