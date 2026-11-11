import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { migrate, runtimeRole } from '../scripts/migrate';
import { hashPassword } from '../src/auth/crypto';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';

test('Stage3 customer activity derives real scoped events and append-only internal notes', { timeout: 300000 }, async t => {
  const url = new URL(process.env.TAHA_TEST_POSTGRES_URL ?? 'postgresql://taha_phase5c@127.0.0.1:55459/postgres');
  assert.equal(url.port, '55459'); assert.equal(url.pathname, '/postgres'); assert(['localhost', '127.0.0.1'].includes(url.hostname));
  const admin = new pg.Client({ connectionString: url.toString() }), database = 'taha_activity_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
  let db: pg.Client | undefined; await admin.connect();
  try {
    await admin.query('create database ' + database); url.pathname = '/' + database; db = new pg.Client({ connectionString: url.toString() }); await db.connect(); await migrate(db);
    const store = '10000000-0000-4000-8000-000000000001', otherStore = randomUUID(), owner = randomUUID(), employee = randomUUID(), customer = randomUUID(), otherCustomer = randomUUID();
    await db.query("insert into public.stores(id,name,branch_name) values($1,'Other','Other')", [otherStore]);
    for (const [id, role] of [[owner, 'owner'], [employee, 'employee']]) { await db.query('insert into auth.users(id,email) values($1,$2)', [id, id + '@test.local']); await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,$2,'Activity Staff',$3,'active')", [id, id + '@test.local', role]); await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)', [id, store]); }
    for (const [id, branch] of [[customer, store], [otherCustomer, otherStore]]) await db.query("insert into public.customers(id,store_id,name,type,phone) values($1,$2,'Ali Raza','Individual','03001234567')", [id, branch]);
    await db.query('insert into public.credit_accounts(customer_id,store_id,enabled,enforce_limit) values($1,$2,true,false)', [customer, store]);
    const actor = async (id: string, sql: string, args: unknown[] = []) => { await db!.query('begin'); try { await db!.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [id]); await db!.query('set local role authenticated'); const result = await db!.query(sql, args); await db!.query('commit'); return result.rows[0]?.value; } catch (error) { await db!.query('rollback'); throw error; } };
    const grant = async (keys: string[]) => { await db!.query('delete from public.employee_permissions where profile_id=$1', [employee]); await db!.query('insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key=any($3)', [employee, store, keys]); };
    const timeline = async (filter: Record<string, unknown> = {}, who = owner, id = customer, branch = store) => actor(who, 'select public.customer_activity($1,$2,$3) value', [branch, id, filter]);
    const note = async (input: unknown, who = owner, id = customer) => actor(who, 'select public.add_customer_note($1,$2,$3) value', [store, id, input]);
    const cash = (await db.query("select id from public.payment_methods where store_id=$1 and kind='Cash'", [store])).rows[0].id;
    let creditSale: any, collection: any, returned: any, testOut: any;
    await t.test('credit sale, partial collection and return show real records with whole-ledger running balances', async () => {
      creditSale = await actor(owner, 'select public.complete_sale($1,$2) value', [store, { idempotencyKey: randomUUID(), cartId: randomUUID(), customerId: customer, lines: [{ productId: 'custom:' + randomUUID(), quantity: 1, unitPrice: 1750, customService: { name: 'Vivo Y20 Panel Replacement', sellingPrice: 1750, minimumSellingPrice: 0 } }], payments: [{ methodId: 'credit', amount: 1750 }] }]);
      collection = await actor(owner, 'select public.receive_credit_payment($1,$2) value', [store, { idempotencyKey: randomUUID(), customerId: customer, methodId: cash, amount: 1000 }]);
      const page = await timeline(); assert.equal(page.outstanding, 750); assert.equal(page.rows.filter((e: any) => e.type === 'sale').length, 1);
      assert.equal(page.rows.find((e: any) => e.entityId === collection.id).amount, 1000); assert.equal(page.rows.find((e: any) => e.entityId === collection.id).balance, 750);
      const credit = page.rows.find((e: any) => e.category === 'Credit' && e.title === 'Credit Given'); assert.equal(credit.balance, 1750); assert.equal(credit.saleId, creditSale.id); assert.equal(credit.reference, creditSale.invoice);
      const sales = await timeline({ category: 'Sales', limit: 1 }); assert.equal(sales.total, 1); assert.equal(sales.outstanding, 750); assert.equal(sales.rows[0].amount, 1750); assert(sales.rows[0].description.includes('Vivo Y20 Panel Replacement'));
      returned = await actor(owner, 'select public.return_sale_item($1,$2) value', [store, { idempotencyKey: randomUUID(), saleId: creditSale.id, productId: creditSale.lines[0].productId, quantity: 1, destination: 'Do Not Restore Stock', reason: 'Customer changed plan', receiptConfirmed: true, manualRefundConfirmed: true }]);
      const updated = await timeline(); assert.equal(updated.outstanding, 0); const returns = await timeline({ category: 'Returns' }); assert.equal(returns.rows[0].entityId, returned.id); assert.equal(returns.rows[0].saleId, creditSale.id); assert.equal(returns.rows[0].amount, 1750); assert.equal(returns.rows[0].condition, 'Do Not Restore Stock');
      assert(updated.rows.some((e: any) => e.type === 'refund' && e.amount === 1000)); assert(!JSON.stringify(updated).match(/purchase_cost|purchaseCost|minimumPrice|proof_path|approvalToken/));
    });
    await t.test('payment reversal and credit adjustments use their real timestamps and never count debt collection as another sale', async () => {
      await db!.query("insert into public.credit_ledger_entries(store_id,customer_id,reference,description,debit,employee_id,created_at) values($1,$2,'OPEN-DEBT','Recorded opening debt',2000,$3,'2026-01-01T00:00:01Z')", [store, customer, owner]);
      const payment = await actor(owner, 'select public.receive_credit_payment($1,$2) value', [store, { idempotencyKey: randomUUID(), customerId: customer, methodId: cash, amount: 500 }]);
      const reversal = await actor(owner, 'select public.reverse_payment($1,$2) value', [store, { idempotencyKey: randomUUID(), paymentId: payment.id, reason: 'Cash collection corrected' }]);
      const page = await timeline(); assert.equal(page.outstanding, 2000); assert.equal(page.rows.filter((e: any) => e.type === 'sale').length, 1); const event = page.rows.find((e: any) => e.entityId === reversal.id); assert.equal(event.type, 'reversal'); assert.equal(event.amount, 500); assert.equal(new Date(event.createdAt).toISOString(), new Date(reversal.createdAt).toISOString());
      assert(page.rows.some((e: any) => e.reference === 'OPEN-DEBT' && e.balance === 2000));
    });
    await t.test('notes are authorized, append-only, default-deny, audited and idempotent with exact stored actor/time', async () => {
      const body = { idempotencyKey: randomUUID(), text: '  Customer expects to pay on Friday.  ' }; await grant(['customers.view']); await assert.rejects(note(body, employee), /Access denied|permission/i);
      await grant(['customers.view', 'customers.edit']); const saved = await note(body, employee); assert.equal(saved.type, 'note'); assert.equal(saved.category, 'Notes'); assert.equal(saved.description, body.text.trim()); assert.equal(saved.employeeId, employee); assert.equal(saved.reference, 'Internal note'); assert.deepEqual(await note(body, employee), saved);
      await assert.rejects(note({ ...body, text: 'Changed values' }, employee), /reused/i); await assert.rejects(note({ ...body, idempotencyKey: randomUUID(), createdAt: '2000-01-01' }, employee));
      for (const text of ['', '  ', 'a'.repeat(2001), null, 23]) await assert.rejects(note({ idempotencyKey: randomUUID(), text }, employee));
      const count = (await db!.query("select count(*)::int n from public.audit_logs where entity_id=$1 and action='customer.note_added'", [saved.entityId])).rows[0].n; assert.equal(count, 1);
      const stored = (await db!.query('select * from private.customer_notes where id=$1', [saved.entityId])).rows[0]; assert.equal(new Date(stored.created_at).toISOString(), new Date(saved.createdAt).toISOString());
      await assert.rejects(db!.query("update private.customer_notes set text='Changed' where id=$1", [saved.entityId]), /append-only/); await assert.rejects(db!.query('delete from private.customer_notes where id=$1', [saved.entityId]), /append-only/);
      assert.equal((await db!.query("select relrowsecurity from pg_class where oid='private.customer_notes'::regclass")).rows[0].relrowsecurity, true); await assert.rejects(actor(employee, 'select * from private.customer_notes'));
    });
    await t.test('per-source permissions omit unauthorized sales/credit/payments/tests and cross-branch customers', async () => {
      await grant(['customers.view']); const limited = await timeline({}, employee); assert.equal(limited.outstanding, undefined); assert(limited.rows.every((e: any) => e.category === 'Notes')); assert(!JSON.stringify(limited).includes(creditSale.invoice));
      await grant(['customers.view', 'returns.create']); const returns = await timeline({}, employee); assert(returns.rows.some((e: any) => e.category === 'Returns')); assert(!returns.rows.some((e: any) => ['Sales', 'Credit', 'Payments'].includes(e.category)));
      await grant(['credit.receive_payment']); const credit = await timeline({}, employee); assert.equal(credit.outstanding, 2000); assert(!credit.rows.some((e: any) => e.category === 'Sales')); assert(credit.rows.some((e: any) => e.type === 'payment'));
      await grant(['customers.view', 'sales.view']); const sales = await timeline({}, employee); assert(sales.rows.some((e: any) => e.category === 'Sales')); assert.equal(sales.outstanding, undefined); assert(sales.rows.every((e: any) => e.balance === undefined));
      await assert.rejects(timeline({}, employee, otherCustomer)); await assert.rejects(timeline({}, employee, otherCustomer, otherStore)); await assert.rejects(note({ idempotencyKey: randomUUID(), text: 'Foreign' }, owner, otherCustomer));
      await grant([]); await assert.rejects(timeline({}, employee), /Access denied|permission/i);
    });
    await t.test('test item sent/returned/conversion events use actual timestamps and never fabricate unrecorded transitions', async () => {
      const rack = randomUUID(), shelf = randomUUID(), box = randomUUID(), product = randomUUID();
      for (const [id, kind, parent] of [[rack, 'rack', null], [shelf, 'shelf', rack], [box, 'box', shelf]]) await db!.query('insert into public.locations(id,store_id,name,kind,parent_location_id) values($1,$2,$3,$3,$4)', [id, store, kind, parent]);
      await db!.query("insert into public.products(id,store_id,name,category,selling_price,minimum_selling_price) values($1,$2,'Test Panel','Parts',100,0)", [product, store]); await db!.query("insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,actor_profile_id) values($1,$2,$3,5,'RECEIVE',$4)", [store, product, box, owner]);
      const body = () => ({ idempotencyKey: randomUUID(), customerId: customer, productId: product, locationId: box, quantity: 1, takenDate: '2026-01-01', dueDate: '2026-12-31' }); testOut = await actor(owner, 'select public.save_test_out($1,$2) value', [store, body()]);
      await actor(owner, 'select public.update_test_out($1,$2) value', [store, { idempotencyKey: randomUUID(), id: testOut.id, action: 'return', locationId: box }]);
      const actual = (await db!.query('select created_at,closed_at from public.out_for_test where id=$1', [testOut.id])).rows[0], events = await timeline({ category: 'Test Items' });
      assert.equal(new Date(events.rows.find((e: any) => e.type === 'test').createdAt).toISOString(), actual.created_at.toISOString()); const back = events.rows.find((e: any) => e.type === 'test-returned'); assert(back); assert.equal(new Date(back.createdAt).toISOString(), actual.closed_at.toISOString()); assert.equal(back.quantity, 1);
      const converting = await actor(owner, 'select public.save_test_out($1,$2) value', [store, body()]); const sold = await actor(owner, 'select public.complete_sale($1,$2) value', [store, { idempotencyKey: randomUUID(), cartId: randomUUID(), customerId: customer, sourceTestId: converting.id, lines: [{ productId: product, quantity: 1, unitPrice: 100 }], payments: [{ methodId: cash, amount: 100 }], cashReceived: 100 }]);
      const converted = (await timeline({ category: 'Test Items' })).rows.find((e: any) => e.type === 'test-converted'); assert.equal(converted.saleId, sold.id); assert.equal(new Date(converted.createdAt).toISOString(), new Date(sold.createdAt).toISOString());
      const missing = await actor(owner, 'select public.save_test_out($1,$2) value', [store, body()]); await db!.query("update public.out_for_test set status='RETURNED' where id=$1", [missing.id]); assert(!(await timeline({ category: 'Test Items' })).rows.some((e: any) => e.entityId === missing.id && e.type === 'test-returned'));
    });
    await t.test('date/order/filter pagination keeps total and balance independent with deterministic ordering', async () => {
      const all = await timeline({ order: 'oldest', limit: 100 }); assert.equal(all.rows[0].reference, 'OPEN-DEBT');
      const first = await timeline({ order: 'oldest', limit: 2 }), next = await timeline({ order: 'oldest', limit: 2, offset: 2 }); assert.equal(first.total, all.total); assert.deepEqual([...first.rows, ...next.rows].map((e: any) => e.id), all.rows.slice(0, 4).map((e: any) => e.id)); assert.equal(next.outstanding, 2000);
      const day = await timeline({ from: '2026-01-01', to: '2026-01-01' }); assert.equal(day.total, 1); assert.equal(day.rows[0].reference, 'OPEN-DEBT'); assert.equal(day.outstanding, 2000);
      for (const filter of [{ category: 'Other' }, { order: 'random' }, { limit: 0 }, { offset: -1 }, { limit: 1.5 }, { from: '2026-02-30' }, { from: '2026-10-15', to: '2026-10-01' }, { arbitrary: true }]) await assert.rejects(timeline(filter));
    });
    await t.test('unconfirmed payment records stay excluded and return-only/customer-only viewers do not inherit payment details', async () => {
      const before = await timeline({ category: 'Payments' });
      for (const status of ['Pending', 'Rejected']) await db!.query("insert into public.payments(store_id,code,customer_id,method_id,amount,kind,status,method_name,method_kind,employee_id) values($1,$2,$3,$4,123,'collection',$5,'Cash','Cash',$6)", [store, 'UNCONFIRMED-' + randomUUID(), customer, cash, status, owner]);
      const after = await timeline({ category: 'Payments' }); assert.equal(after.total, before.total); assert(!JSON.stringify(after).includes('UNCONFIRMED'));
      await grant(['customers.view', 'returns.create']); const limited = await timeline({ category: 'Payments' }, employee); assert.equal(limited.total, 0); assert.equal(limited.outstanding, undefined);
      await grant(['customers.view', 'payments.reverse']); const payments = await timeline({}, employee); assert(payments.rows.some((e: any) => e.category === 'Payments')); assert(!payments.rows.some((e: any) => ['Sales', 'Credit', 'Returns', 'Test Items'].includes(e.category))); assert(payments.rows.every((e: any) => e.balance === undefined));
    });
    await t.test('shop-date filtering respects midnight in Karachi and ledger ties remain deterministic', async () => {
      const other = randomUUID(); await db!.query("insert into public.customers(id,store_id,name,type) values($1,$2,'Timezone Fixture','Individual')", [other, store]);
      for (const [id, stamp, debit] of [['10000000-0000-4000-8000-000000000001', '2026-01-01T18:59:59.999Z', 100], ['10000000-0000-4000-8000-000000000002', '2026-01-01T19:00:00.001Z', 200], ['10000000-0000-4000-8000-000000000003', '2026-01-01T19:00:00.001Z', 300]]) await db!.query("insert into public.credit_ledger_entries(id,store_id,customer_id,reference,description,debit,employee_id,created_at) values($1,$2,$3,'DATE-BOUNDARY','Recorded adjustment',$4,$5,$6)", [id, store, other, debit, owner, stamp]);
      const firstDay = await timeline({ category: 'Credit', from: '2026-01-01', to: '2026-01-01' }, owner, other); assert.equal(firstDay.total, 1); assert.equal(firstDay.outstanding, 600); assert.equal(firstDay.rows[0].balance, 100);
      const nextDay = await timeline({ category: 'Credit', from: '2026-01-02', to: '2026-01-02', order: 'oldest' }, owner, other); assert.deepEqual(nextDay.rows.map((e: any) => e.balance), [300, 600]);
      const paged = await timeline({ category: 'Credit', from: '2026-01-02', to: '2026-01-02', order: 'oldest', offset: 1, limit: 1 }, owner, other); assert.equal(paged.total, 2); assert.equal(paged.rows[0].balance, 600); assert.equal(paged.outstanding, 600);
    });
    await t.test('concurrent note requests create one immutable event and cannot reuse a key for another customer', async () => {
      const body = { idempotencyKey: randomUUID(), text: 'Concurrent internal note' };
      const run = async () => { const client = new pg.Client({ connectionString: url.toString() }); await client.connect(); try { await client.query('begin'); await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [owner]); await client.query('set local role authenticated'); const result = (await client.query('select public.add_customer_note($1,$2,$3) value', [store, customer, body])).rows[0].value; await client.query('commit'); return result; } catch (error) { await client.query('rollback'); throw error; } finally { await client.end(); } };
      const results = await Promise.all([run(), run()]); assert.deepEqual(results[0], results[1]); assert.equal((await db!.query('select count(*)::int n from private.customer_notes where id=$1', [results[0].entityId])).rows[0].n, 1);
      const other = randomUUID(); await db!.query("insert into public.customers(id,store_id,name,type) values($1,$2,'Other customer','Individual')", [other, store]); await assert.rejects(note(body, owner, other), /reused/i);
    });
    await t.test('real HTTP activity and notes enforce the runtime account boundary', async () => {
      const runtime = new URL(url), role = 'taha_activity_' + Date.now() + '_' + Math.floor(Math.random() * 100000); runtime.username = role; runtime.password = randomUUID(); await runtimeRole(db!, runtime.toString());
      const password = 'Stage3 fixture password 2026!', hash = await hashPassword(password); await db!.query('insert into app_private.accounts(user_id,email,password_hash) values($1,$2,$3)', [employee, employee + '@test.local', hash]); await grant(['customers.view', 'customers.edit']);
      process.env.DATABASE_URL = runtime.toString(); process.env.JWT_SECRET = 'stage3-fixture-only-secret-more-than-thirty-two-bytes'; process.env.NODE_ENV = 'test'; process.env.PORT = '0'; process.env.FRONTEND_ORIGIN = 'http://localhost:5173'; process.env.STORAGE_ROOT = await mkdtemp(path.join(os.tmpdir(), 'taha-activity-'));
      let app: INestApplication | undefined;
      try {
        const { createApp } = await import('../src/main'); app = await createApp(); await app.listen(0, '127.0.0.1'); const base = await app.getUrl();
        const request = async (route: string, method = 'GET', body?: unknown, token?: string) => { const response = await fetch(base + '/api/v1' + route, { method, headers: { Origin: 'http://localhost:5173', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: response.status, value: await response.json() as any }; };
        const login = await request('/auth/login', 'POST', { email: employee + '@test.local', password }), token = login.value.accessToken as string; assert.equal(login.status, 201);
        const cursor = (await request(`/stores/${store}/sync/changes?after=0`, 'GET', undefined, token)).value.cursor;
        const body = { idempotencyKey: randomUUID(), text: 'Customer said Friday; internal note only.' }, saved = await request(`/stores/${store}/customers/${customer}/notes`, 'POST', body, token); assert.equal(saved.status, 201, JSON.stringify(saved.value)); assert.equal(saved.value.employeeId, employee); assert.equal(saved.value.type, 'note');
        const changes = await request(`/stores/${store}/sync/changes?after=${cursor}`, 'GET', undefined, token); assert.equal(changes.status, 200); assert(changes.value.changes.some((change: any) => change.resource === 'customers' && change.id === customer), 'A private note must invalidate its customer through authorized HTTPS polling'); assert(!JSON.stringify(changes.value).includes(body.text));
        assert.deepEqual((await request(`/stores/${store}/customers/${customer}/notes`, 'POST', body, token)).value, saved.value);
        const read = await request(`/stores/${store}/customers/${customer}/activity?category=Notes&order=oldest&limit=1&offset=0`, 'GET', undefined, token); assert.equal(read.status, 200, JSON.stringify(read.value)); assert(read.value.total >= 2); assert.equal(read.value.rows.length, 1); assert.equal(read.value.outstanding, undefined);
        assert.equal((await request(`/stores/${otherStore}/customers/${otherCustomer}/activity`, 'GET', undefined, token)).status, 403); assert.equal((await request(`/stores/${store}/customers/${customer}/activity`)).status, 401);
        await grant(['customers.view']); assert.equal((await request(`/stores/${store}/customers/${customer}/notes`, 'POST', { ...body, idempotencyKey: randomUUID() }, token)).status, 403);
      } finally { await app?.close(); await db!.query('drop owned by "' + role + '"'); await admin.query('drop role "' + role + '"'); }
    });
  } finally { await db?.end(); await admin.query('drop database if exists ' + database); await admin.end(); }
});
