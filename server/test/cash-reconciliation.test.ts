import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { migrate, runtimeRole } from "../scripts/migrate";
import { hashPassword } from "../src/auth/crypto";
import { offlineInvoice } from "../src/sync/sync.controller";
import type { INestApplication } from "@nestjs/common";
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import jwt from 'jsonwebtoken';
let db: pg.Client,
  admin: pg.Client,
  app: INestApplication,
  url: string,
  token: string,
  grant: string;
let databaseName = "";
const store = "10000000-0000-4000-8000-000000000001",
  owner = randomUUID(),
  terminal = randomUUID(),
  product = randomUUID(),
  cash = randomUUID();
async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch(url + "/api/v1" + path, {
    method,
    headers: {
      Origin: "tauri://localhost",
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data };
}
before(
  async () => {
    const parsed = new URL(
      process.env.TAHA_TEST_POSTGRES_URL ??
        "postgresql://taha_test@127.0.0.1:55439/postgres",
    );
    assert.equal(parsed.hostname, "127.0.0.1");
    admin = new pg.Client({ connectionString: parsed.toString() });
    await admin.connect();
    parsed.pathname = "/taha_cash_reconcile_" + Date.now();
    databaseName = parsed.pathname.slice(1);
    await admin.query(`create database ${parsed.pathname.slice(1)}`);
    db = new pg.Client({ connectionString: parsed.toString() });
    await db.connect();
    await migrate(db);
    const runtime = new URL(parsed);
    runtime.username = "taha_cash_reconcile_test";
    runtime.password = "isolated-runtime-password";
    await runtimeRole(db, runtime.toString());
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      owner,
      "owner@taha.test",
    ]);
    await db.query(
      "insert into public.profiles(id,full_name,email,role,status) values($1,'Ahmed Khan','owner@taha.test','owner','active')",
      [owner],
    );
    await db.query(
      "insert into public.store_memberships(profile_id,store_id) values($1,$2)",
      [owner, store],
    );
    await db.query(
      "insert into app_private.accounts(user_id,email,password_hash) values($1,$2,$3)",
      [
        owner,
        "owner@taha.test",
        await hashPassword("Secure test password 2026!"),
      ],
    );
    process.env.DATABASE_URL = runtime.toString();
    process.env.JWT_SECRET =
      "isolated-desktop-sync-secret-over-thirty-two-bytes";
    process.env.NODE_ENV = "test";
    process.env.FRONTEND_ORIGIN = "http://localhost:5173";
    process.env.PORT = "0";
    const { createApp } = await import("../src/main");
    app = await createApp();
    await app.listen(0, "127.0.0.1");
    url = await app.getUrl();
    token = (
      await api("/auth/login", "POST", {
        email: "owner@taha.test",
        password: "Secure test password 2026!",
      })
    ).data.accessToken;
    const created = await api(`/stores/${store}/products`, "POST", {
      id: product,
      name: "Battery test",
      category: "Services",
      selling_price: 1000,
      minimum_selling_price: 900,
      state: "active",
    });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    const payment = await api(`/stores/${store}/payment-methods`, "POST", {
      id: cash,
      name: "Cash",
      kind: "Cash",
      enabled: true,
      title: "",
      number: "",
      iban: "",
      qr: "",
      requiresProof: false,
    });
    assert.equal(payment.status, 201, JSON.stringify(payment.data));
    grant = (
      await api(`/stores/${store}/sync/offline-grant`, "POST", {
        terminalId: terminal,
      })
    ).data.token;
  },
  { timeout: 120000 },
);
after(async () => {
  await app?.close();
  await db?.end();
  if (admin && /^taha_cash_reconcile_\d+$/.test(databaseName))
    await admin.query("drop database if exists " + databaseName);
  await admin?.end();
});
function sale() {
  const key = randomUUID();
  return {
    grant,
    terminalId: terminal,
    createdAt: new Date().toISOString(),
    invoice: offlineInvoice(key),
    total: 1000,
    catalog: [{ id: product, price: 1000, minimum: 900 }],
    input: {
      cartId: randomUUID(),
      idempotencyKey: key,
      lines: [{ productId: product, quantity: 1, unitPrice: 1000 }],
      customerId: "",
      coupon: "",
      payments: [{ methodId: cash, amount: 1000, reference: "" }],
      cashReceived: 1200,
    },
  };
}
test("rejected offline cash remains immutable evidence and is refunded without a fictitious sale",async()=>{
 const body=sale();body.catalog[0].price=1100;
 const rejected=await api(`/stores/${store}/sync/sales`,'POST',body);
 assert.equal(rejected.status,409);
 const list=await api(`/stores/${store}/sync/exceptions`);
 assert.equal(list.status,200,JSON.stringify(list.data));
 const row=list.data.find((r:{id:string})=>r.id===body.input.idempotencyKey);
 assert.equal(row.state,'REVIEW');assert.equal(Number(row.collected),1000);
 assert.equal(Number(row.tendered),1200);assert.equal(Number(row.change_given),200);
 const refund=await api(`/stores/${store}/sync/exceptions/${row.id}/resolve`,'POST',{action:'refund',reason:'Customer received actual cash refund',cashReturned:1000});
 assert.equal(refund.status,201,JSON.stringify(refund.data));assert.equal(refund.data.state,'REFUNDED');
 assert.equal((await db.query('select count(*)::int n from public.sales')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from public.stock_movements')).rows[0].n,0);
 const again=await api(`/stores/${store}/sync/exceptions/${row.id}/resolve`,'POST',{action:'refund',reason:'Customer received actual cash refund',cashReturned:1000});
 assert.equal(again.status,201);assert.equal(again.data.state,'REFUNDED');
 const totals=await api(`/stores/${store}/sync/cash-summary`);
 assert.equal(Number(totals.data.collected),1000);assert.equal(Number(totals.data.refunded),1000);assert.equal(Number(totals.data.unposted),0);
 const altered=structuredClone(body);altered.total=999;
 assert([400,409].includes((await api(`/stores/${store}/sync/sales`,'POST',altered)).status));
});
async function employeeAccount(role='employee'){
 const id=randomUUID(),email=id+'@taha.test';
 await db.query('insert into auth.users(id,email) values($1,$2)',[id,email]);
 await db.query("insert into public.profiles(id,full_name,email,role,status) values($1,'Original Seller',$2,$3,'active')",[id,email,role]);
 await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)',[id,store]);
 await db.query("insert into app_private.accounts(user_id,email,password_hash) select $1,$2,password_hash from app_private.accounts where user_id=$3",[id,email,owner]);
 await db.query("insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key='sales.create'",[id,store]);
 const ownerToken=token;token=(await api('/auth/login','POST',{email,password:'Secure test password 2026!'})).data.accessToken;
 const employeeToken=token;const employeeGrant=(await api(`/stores/${store}/sync/offline-grant`,'POST',{terminalId:terminal})).data.token;token=ownerToken;
 return{id,token:employeeToken,grant:employeeGrant};
}
test('deactivated employee cash is recoverable by independently signed-in owner, preserving seller and capture time',async()=>{
 const e=await employeeAccount(),body=sale();body.grant=e.grant;
 await db.query("update public.profiles set status='inactive' where id=$1",[e.id]);
 assert.equal((await api(`/stores/${store}/sync/sales`,'POST',body)).status,409);
 const result=await api(`/stores/${store}/sync/exceptions/${body.input.idempotencyKey}/resolve`,'POST',{action:'retry',reason:'Original employee left; reconcile retained cash receipt'});
 assert.equal(result.status,201,JSON.stringify(result.data));assert.equal(result.data.sale.employeeId,e.id);assert.equal(result.data.sale.invoice,body.invoice);
 assert.equal(Date.parse(result.data.sale.createdAt),Date.parse(body.createdAt));
 const payment=(await db.query('select employee_id,created_at from public.payments where sale_id=$1',[result.data.sale.id])).rows[0];assert.equal(payment.employee_id,e.id);assert.equal(payment.created_at.getTime(),Date.parse(body.createdAt));
 const event=(await db.query("select actor_id from app_private.cash_capture_events where capture_id=$1 and state='POSTED'",[body.input.idempotencyKey])).rows[0];assert.equal(event.actor_id,owner);
 const ownerToken=token;token=e.token;assert.equal((await api(`/stores/${store}/sync/exceptions`)).status,401);token=ownerToken;
});
test('ordinary employee and manager without explicit permission cannot reconcile or inspect another seller cash',async()=>{
 const ownerToken=token;
 for(const role of ['employee','manager']){const e=await employeeAccount(role);token=e.token;
  if(role==='employee')await db.query("insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key='sync.reconcile_cash'",[e.id,store]);
  assert.equal((await api(`/stores/${store}/sync/exceptions`)).status,403);
  assert.equal((await api(`/stores/${store}/sync/exceptions/${randomUUID()}/resolve`,'POST',{action:'refund',reason:'Unauthorized attempt',cashReturned:1000})).status,403);
  token=ownerToken;
 }
});
test('authorized manager recovery requires a reason and never impersonates the departed employee',async()=>{
 const e=await employeeAccount(),manager=await employeeAccount('manager'),body=sale();body.grant=e.grant;
 await api(`/stores/${store}/sync/sales`,'POST',body);
 await db.query("insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key='sync.reconcile_cash'",[manager.id,store]);
 const ownerToken=token;token=manager.token;
 assert.equal((await api(`/stores/${store}/sync/exceptions/${body.input.idempotencyKey}/resolve`,'POST',{action:'retry',reason:''})).status,400);
 const result=await api(`/stores/${store}/sync/exceptions/${body.input.idempotencyKey}/resolve`,'POST',{action:'retry',reason:'Counter handover: original cash receipt checked'});
 assert.equal(result.status,201,JSON.stringify(result.data));assert.equal(result.data.sale.employeeId,e.id);
 token=ownerToken;
 const refundBody=sale();refundBody.grant=e.grant;await api(`/stores/${store}/sync/sales`,'POST',refundBody);
 await db.query("delete from public.employee_permissions where profile_id=$1 and permission_id=(select id from public.permissions where key='sales.create')",[manager.id]);
 token=manager.token;const refunded=await api(`/stores/${store}/sync/exceptions/${refundBody.input.idempotencyKey}/resolve`,'POST',{action:'refund',reason:'Actual cash refund verified after counter handover',cashReturned:1000});assert.equal(refunded.status,201,JSON.stringify(refunded.data));assert.equal(refunded.data.state,'REFUNDED');token=ownerToken;
});
test('insufficient stock retains cash for review; proper stock receipt then retry deducts once',async()=>{
 const pid=randomUUID(),rack=randomUUID(),shelf=randomUUID(),box=randomUUID();
 await db.query("insert into public.products(id,store_id,name,category,selling_price,minimum_selling_price) values($1,$2,'Offline Battery','Parts',1000,900)",[pid,store]);
 for(const [id,name,kind,parent] of [[rack,'Rack','rack',null],[shelf,'Shelf','shelf',rack],[box,'Box','box',shelf]])await db.query('insert into public.locations(id,store_id,name,kind,parent_location_id) values($1,$2,$3,$4,$5)',[id,store,name,kind,parent]);
 const body=sale();body.input.lines[0].productId=pid;body.catalog[0].id=pid;
 const rejected=await api(`/stores/${store}/sync/sales`,'POST',body);assert.equal(rejected.status,409,JSON.stringify(rejected.data));
 assert.match(rejected.data.message,/stock/i);
 assert.equal((await db.query('select count(*)::int n from public.sales where invoice=$1',[body.invoice])).rows[0].n,0);
 const decisionReason='Physical count still shows no available battery; retry checked by owner';
 const stillRejected=await api(`/stores/${store}/sync/exceptions/${body.input.idempotencyKey}/resolve`,'POST',{action:'retry',reason:decisionReason});assert.equal(stillRejected.status,409);
 const failedDecision=(await db.query("select details from app_private.cash_capture_events where capture_id=$1 and state='REVIEW' order by sequence desc limit 1",[body.input.idempotencyKey])).rows[0];assert.equal(failedDecision.details.decisionReason,decisionReason);
 assert.equal((await db.query("select count(*)::int n from public.audit_logs where entity_id=$1 and action='offline_cash.retry_failed' and metadata->>'reason'=$2",[body.input.idempotencyKey,decisionReason])).rows[0].n,1);
 await db.query('begin');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
 await db.query("select public.adjust_stock($1,$2,$3,0,2,'Opening Stock',$4)",[store,pid,box,randomUUID()]);await db.query('commit');
 const result=await api(`/stores/${store}/sync/exceptions/${body.input.idempotencyKey}/resolve`,'POST',{action:'retry',reason:'Stock count corrected through authorized opening adjustment'});assert.equal(result.status,201,JSON.stringify(result.data));
 await api(`/stores/${store}/sync/sales`,'POST',body);
 assert.equal((await db.query("select count(*)::int n from public.stock_movements where product_id=$1 and movement_type='SALE'",[pid])).rows[0].n,1);
 assert.equal(Number((await db.query('select sum(quantity) n from public.stock_movements where product_id=$1',[pid])).rows[0].n),1);
});
test('cash evidence and resolution decisions are append-only even for database writes',async()=>{
 await assert.rejects(db.query('update app_private.cash_captures set collected=1'),/append-only/i);
 await assert.rejects(db.query('delete from app_private.cash_capture_events'),/append-only/i);
});
test('simultaneous refund and posting never both commit; duplicate refund is a single cash event',async()=>{
 const body=sale();body.catalog[0].price=1100;await api(`/stores/${store}/sync/sales`,'POST',body);
 await db.query('update public.products set selling_price=1100 where id=$1',[product]);
 const results=await Promise.all([api(`/stores/${store}/sync/exceptions/${body.input.idempotencyKey}/resolve`,'POST',{action:'retry',reason:'Reconciled stock and price snapshot'}),api(`/stores/${store}/sync/exceptions/${body.input.idempotencyKey}/resolve`,'POST',{action:'refund',reason:'Actual cash handed back to customer',cashReturned:1000})]);
 assert.equal(results.filter(r=>r.status===201).length,1,JSON.stringify(results));
 const rows=(await db.query("select state,count(*)::int n from app_private.cash_capture_events where capture_id=$1 and state in ('POSTED','REFUNDED') group by state",[body.input.idempotencyKey])).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].n,1);
 await db.query('update public.products set selling_price=1000 where id=$1',[product]);
});
test('existing online sale has ordinary numbering and creates no offline cash evidence',async()=>{
 const body=sale();const before=Number((await db.query('select count(*) n from app_private.cash_captures')).rows[0].n);
 const result=await api(`/stores/${store}/sales`,'POST',body.input);assert.equal(result.status,201,JSON.stringify(result.data));assert(!result.data.invoice.startsWith('TM-INV-O-'));
 assert.equal(Number((await db.query('select count(*) n from app_private.cash_captures')).rows[0].n),before);
});
test("lost acknowledgment and concurrent retries return one stable invoice, payment and sale",async()=>{
 const body=sale();const responses=await Promise.all([api(`/stores/${store}/sync/sales`,'POST',body),api(`/stores/${store}/sync/sales`,'POST',body)]);
 for(const response of responses)assert.equal(response.status,201,JSON.stringify(response.data));
 assert.equal(responses[0].data.id,responses[1].data.id);
 assert.equal((await api(`/stores/${store}/sync/sales`,'POST',body)).data.id,responses[0].data.id);
 const result=(await db.query('select count(*)::int n from public.sales where invoice=$1',[body.invoice])).rows[0];assert.equal(result.n,1);
 assert.equal((await db.query('select count(*)::int n from public.payments where sale_id=$1',[responses[0].data.id])).rows[0].n,1);
 const denied=await api(`/stores/${store}/sync/exceptions/${body.input.idempotencyKey}/resolve`,'POST',{action:'refund',reason:'Already posted cannot use exception refund',cashReturned:1000});
 assert.equal(denied.status,409);
});
test('actual SQLite queued cash survives logout/restart, posts through HTTP, and recovers a lost server acknowledgment',async()=>{
 const file=join(mkdtempSync(join(tmpdir(),'taha-cash-integration-')),'counter.sqlite3');let local=new DatabaseSync(file);
 for(const f of ['001_desktop.sql','002_cash_evidence.sql'])local.exec(readFileSync(resolve('../src-tauri/migrations',f),'utf8'));
 const body=sale(),id=body.input.idempotencyKey,scope=`https://shop.test/api/v1|${store}|${owner}`;
 const receipt={id,invoice:body.invoice,employeeId:owner,employeeName:'Ahmed Khan',createdAt:body.createdAt,cashReceived:1200,change:200,total:1000,lines:[{name:'Battery',quantity:1,unitPrice:1000}]};
 const payload={...body,grant:undefined,receipt};
 local.exec('BEGIN IMMEDIATE');local.prepare('insert into outbox(id,scope,type,payload,idempotency_key,created_at) values(?,?,?,?,?,?)').run(id,scope,'CASH_SALE',JSON.stringify(payload),id,Date.now());local.prepare('insert into receipts values(?,?,?,?,?)').run(id,scope,body.invoice,JSON.stringify(receipt),Date.now());local.prepare(readFileSync(resolve('../src-tauri/sql/capture-cash.sql'),'utf8')).run(id);local.exec('COMMIT');
 local.exec("update outbox set status='SYNCING';delete from drafts");local.close();local=new DatabaseSync(file);local.exec("update outbox set status='PENDING' where status='SYNCING'");
 const restored=JSON.parse(local.prepare('select payload from outbox').get()!.payload as string);restored.grant=grant;
 const committed=await api(`/stores/${store}/sync/sales`,'POST',restored);assert.equal(committed.status,201,JSON.stringify(committed.data));
 // Discard the successful response as a dropped connection would; retry same immutable UUID.
 const retried=await api(`/stores/${store}/sync/sales`,'POST',restored);assert.equal(retried.data.id,committed.data.id);
 local.prepare("update outbox set status='SYNCED' where id=?").run(id);
 assert.equal(local.prepare('select collected_minor from cash_evidence').get()!.collected_minor,100000);
 assert.equal((await db.query('select count(*)::int n from public.sales where invoice=$1',[body.invoice])).rows[0].n,1);local.close();
});
test('shift closing separates retained cash, posted sales and real refunds without double counting',async()=>{
 const e=await employeeAccount(),shift=randomUUID(),body=sale();body.grant=e.grant;body.catalog[0].price=1100;
 await db.query("insert into public.shifts(id,store_id,employee_id,status,actual_start,opening_cash) values($1,$2,$3,'open',now()-interval '1 hour',100)",[shift,store,e.id]);
 await api(`/stores/${store}/sync/sales`,'POST',body);
 const flow=async()=>{await db.query('begin');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);const value=(await db.query('select public.shift_closing($1,$2) value',[store,shift])).rows[0].value;await db.query('commit');return value;};
 let cashFlow=await flow();assert.equal(Number(cashFlow.cashSales),0);assert.equal(Number(cashFlow.offlineCash.unposted),1000);assert.equal(Number(cashFlow.expected),1100);
 await api(`/stores/${store}/sync/exceptions/${body.input.idempotencyKey}/resolve`,'POST',{action:'refund',reason:'Actual refund from owner cash drawer',cashReturned:1000});
 cashFlow=await flow();assert.equal(Number(cashFlow.expected),1100,'Original seller handed over collected cash; owner paid refund from their drawer');assert.equal(Number(cashFlow.offlineCash.unposted),0);
 const report=await api(`/stores/${store}/reports?from=2026-10-15&to=2026-10-15`);
 // Verify the authoritative SQL contract independently of frontend report mapping.
 await db.query('begin');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
 const r=(await db.query("select public.get_transaction_report($1,(now() at time zone 'Asia/Karachi')::date,(now() at time zone 'Asia/Karachi')::date) value",[store])).rows[0].value;await db.query('commit');
 assert.equal(Number(r.offlineCash.physicalCash),Number(r.offlineCash.postedCash)+Number(r.offlineCash.unpostedCash)-Number(r.offlineCash.refunded));
 assert.equal(report.status,200,JSON.stringify(report.data));assert(report.data.offlineCash);
});
test('signing out revokes the employee session but retains paid evidence for independent owner recovery',async()=>{
 const e=await employeeAccount(),body=sale();body.grant=e.grant;const ownerToken=token;token=e.token;
 assert.equal((await api(`/stores/${store}/sync/cash-captures`,'POST',body)).status,201);
 assert.equal((await api('/auth/logout','POST')).status,201);
 assert.equal((await api(`/stores/${store}/sync/sales`,'POST',body)).status,401);token=ownerToken;
 const recovered=await api(`/stores/${store}/sync/exceptions/${body.input.idempotencyKey}/resolve`,'POST',{action:'retry',reason:'Owner verified receipt after employee signed out'});
 assert.equal(recovered.status,201,JSON.stringify(recovered.data));assert.equal(recovered.data.sale.employeeId,e.id);
});
test('late recovery after shift closing preserves the frozen count and exposes the late cash submission',async()=>{
 const e=await employeeAccount(),body=sale(),shift=randomUUID();body.grant=e.grant;
 await db.query("select pg_sleep(0.01)");
 await db.query("insert into public.shifts(id,store_id,employee_id,status,actual_start,actual_end,opening_cash,expected_cash,counted_cash,closing_cash_sales,closing_collections,closing_refunds,closing_reversals) values($1,$2,$3,'closed',now()-interval '1 hour',now(),100,100,100,0,0,0,0)",[shift,store,e.id]);
 await api(`/stores/${store}/sync/sales`,'POST',body);
 const result=await api(`/stores/${store}/sync/exceptions/${body.input.idempotencyKey}/resolve`,'POST',{action:'retry',reason:'Recover original receipt received after shift closed'});assert.equal(result.status,201,JSON.stringify(result.data));
 await db.query('begin');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);const flow=(await db.query('select public.shift_closing($1,$2) value',[store,shift])).rows[0].value;await db.query('commit');
 assert.equal(Number(flow.expected),100);assert.equal(flow.closingSnapshotPreserved,true);assert.equal(Number(flow.lateSubmittedCount),1);assert.equal(Number(flow.offlineCash.posted),1000);
});
test('server failure retains captured cash with retry status, then accepts the same invoice once',async()=>{
 const body=sale();await db.query(`create function app_private.test_cash_failure() returns trigger language plpgsql as $$begin if new.invoice='${body.invoice}' then raise exception 'Isolated server fault' using errcode='XX000';end if;return new;end $$;create trigger test_cash_failure before insert on public.sales for each row execute function app_private.test_cash_failure()`);
 try{assert.equal((await api(`/stores/${store}/sync/sales`,'POST',body)).status,500);assert.equal((await db.query('select state from app_private.cash_capture_state where id=$1',[body.input.idempotencyKey])).rows[0].state,'FAILED');}
 finally{await db.query('drop trigger test_cash_failure on public.sales;drop function app_private.test_cash_failure()');}
 const result=await api(`/stores/${store}/sync/sales`,'POST',body);assert.equal(result.status,201,JSON.stringify(result.data));assert.equal(result.data.invoice,body.invoice);
});
test('expired offline grant is evidence for its covered capture time, never an expired employee login token',async()=>{
 const body=sale(),now=Date.now();body.createdAt=new Date(now-90*60_000).toISOString();
 body.grant=jwt.sign({storeId:store,terminalId:terminal,profileId:owner,issuedAt:new Date(now-2*3600_000).toISOString(),expiresAt:new Date(now-3600_000).toISOString(),exp:Math.floor(now/1000)-3600},process.env.JWT_SECRET!,{algorithm:'HS256',issuer:'taha-pos',audience:'taha-offline-cash'});
 const result=await api(`/stores/${store}/sync/sales`,'POST',body);assert.equal(result.status,201,JSON.stringify(result.data));assert.equal(Date.parse(result.data.createdAt),Date.parse(body.createdAt));
 const actorToken=token;token=body.grant;assert.equal((await api(`/stores/${store}/sync/exceptions`)).status,401);token=actorToken;
});
