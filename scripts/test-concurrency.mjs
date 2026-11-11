import assert from 'node:assert/strict';
import pg from 'pg';
import {testDatabase} from './check-migrations.mjs';
import {seedTransactions,prepareCatalog,setActor,call,saleInput,id,store} from './test-transactions.mjs';
// Separate PostgreSQL server connections, not PGlite's single queued connection.
// This runner creates a fresh isolated test database and never modifies an existing business database.
const adminUrl=process.env.TAHA_TEST_POSTGRES_URL ?? 'postgresql://taha_test@127.0.0.1:55439/postgres';
const parsed=new URL(adminUrl);
if (!['127.0.0.1','localhost'].includes(parsed.hostname) || parsed.pathname!=='/postgres') throw new Error('Use a local PostgreSQL test administrator connection to /postgres.');
const admin=new pg.Client({connectionString:adminUrl});await admin.connect();
const database='taha_test_3b_'+Date.now();await admin.query(`CREATE DATABASE ${database}`);
const url=new URL(adminUrl);url.pathname='/'+database;
const connection=async()=>{const c=new pg.Client({connectionString:url.toString()});await c.connect();return c;};
const setup=await connection();const adapter=c=>({query:(sql,args)=>c.query(sql,args),exec:sql=>c.query(sql)});
let a,b;
try {
 await testDatabase(adapter(setup));await seedTransactions(adapter(setup));const {cash}=await prepareCatalog(adapter(setup));
 await call(adapter(setup),'adjust_stock',store,id(20),id(12),10,1,'Physical Count',id(999));
 await setup.query('RESET ROLE');await setup.query(`insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key='sales.create'`,[id(2),store]);
 a=await connection();b=await connection();await setActor(adapter(a),id(1));await setActor(adapter(b),id(2));
 const pidA=(await a.query('select pg_backend_pid() pid')).rows[0].pid,pidB=(await b.query('select pg_backend_pid() pid')).rows[0].pid;assert.notEqual(pidA,pidB);
 await a.query('BEGIN');const first=await call(adapter(a),'complete_sale',store,saleInput(cash,900));
 const competing=call(adapter(b),'complete_sale',store,saleInput(cash,901)).then(value=>({value}),error=>({error}));
 // Observe the actual competing lock rather than assuming the second client
 // has reached PostgreSQL after an arbitrary 150 ms on a busy Windows host.
 let blocked=false;const deadline=Date.now()+5000;
 while(Date.now()<deadline){
  blocked=Boolean((await setup.query('select $2=any(pg_blocking_pids($1)) blocked',[pidB,pidA])).rows[0].blocked);
  if(blocked)break;await setup.query('select pg_sleep(0.02)');
 }
 assert.equal(blocked,true,'The competing sale must block on the first transaction before it commits');
 await a.query('COMMIT');const second=await competing;assert.match(second.error?.message ?? '',/Insufficient stock/);
 await setActor(adapter(setup),id(1));const products=await call(adapter(setup),'get_pos_products',store);assert.equal(products.find(p=>p.id===id(20)).quantity,0);
 const page=await call(adapter(setup),'list_sales',store,{});assert.equal(page.total,1);assert.equal(page.rows[0].id,first.id);
 await setup.query('RESET ROLE');assert.equal((await setup.query(`select count(*)::int n from public.stock_movements where movement_type='SALE'`)).rows[0].n,1);
 assert.equal((await setup.query('select count(*)::int n from public.payments')).rows[0].n,1);
 console.log(`PASS real PostgreSQL simultaneous last-unit sale: distinct backends ${pidA}/${pidB}, one committed, one rejected, stock 0, one invoice/payment/movement`);
 // Both concurrent clients retry the winner's exact request as the same actor.
 await setActor(adapter(b),id(1));
 const repeat=await Promise.all([call(adapter(a),'complete_sale',store,saleInput(cash,900)),call(adapter(b),'complete_sale',store,saleInput(cash,900))]);assert(repeat.every(s=>s.id===first.id));
 console.log('PASS real PostgreSQL concurrent retry returns the same committed invoice without duplicate effects');
} finally {await Promise.all([a?.end(),b?.end(),setup.end()]);await admin.end();}

