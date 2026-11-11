import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validateStagingSeedTarget} from '../scripts/seed-staging';
import {seedStaging} from '../scripts/seed-staging';
import {migrate} from '../scripts/migrate';
import pg from 'pg';
test('staging seed refuses owner database, unapproved targets, weak credentials and production',()=>{
 const valid={environment:'staging',approved:true,url:'postgresql://migration@db.example/taha_staging',email:'owner@staging.test',password:'Isolated staging fixture passphrase!'};
 assert.doesNotThrow(()=>validateStagingSeedTarget(valid));
 for(const change of [{environment:'production'},{approved:false},{url:'postgresql://admin@127.0.0.1:55439/taha_api_browser_1791211953496'},{password:'short'},{email:'not-an-email'}])assert.throws(()=>validateStagingSeedTarget({...valid,...change}));
});
test('isolated staging seed commits domain history once and preserves stock/credit on rerun',{timeout:300000},async()=>{
 const adminUrl=new URL(process.env.TAHA_TEST_POSTGRES_URL??'');assert.equal(adminUrl.port,'55459');assert.equal(adminUrl.hostname,'127.0.0.1');assert.equal(adminUrl.pathname,'/postgres');
 const admin=new pg.Client({connectionString:adminUrl.toString()});await admin.connect();const name='taha_stage_seed_'+Date.now();await admin.query('create database '+name);adminUrl.pathname='/'+name;
 const db=new pg.Client({connectionString:adminUrl.toString()});await db.connect();try{
  await migrate(db);const input={environment:'staging',approved:true,url:adminUrl.toString(),email:'owner@isolated-staging.test',password:'Isolated staging seed fixture passphrase!'};
  const first=await seedStaging(db,input);assert.equal(first.created,true);assert.equal((await seedStaging(db,input)).created,false);
  const m=first.manifest;assert.equal(Number((await db.query('select sum(debit-credit) n from public.credit_ledger_entries where customer_id=$1',[m.customer])).rows[0].n),2600);
  const quantity=await db.query('select sum(quantity) n from public.stock_balances where product_id=$1',[m.products[1].id]);assert.equal(Number(quantity.rows[0].n),18);
  assert.equal(Number((await db.query('select count(*) n from public.sales where store_id=$1',[m.store])).rows[0].n),4);
  assert.equal(Number((await db.query('select count(*) n from public.returns where store_id=$1',[m.store])).rows[0].n),1);
  assert.equal((await db.query('select manifest::text from app_private.staging_datasets')).rows[0].manifest.includes(input.password),false);
 }finally{await db.end();await admin.query('drop database '+name+' with(force)');await admin.end();}
});
