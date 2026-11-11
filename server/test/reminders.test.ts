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

test('Stage5 due metadata and manual reminders remain current, scoped and auditable', { timeout: 300000 }, async t => {
  const url = new URL(process.env.TAHA_TEST_POSTGRES_URL ?? 'postgresql://taha_phase5c@127.0.0.1:55459/postgres'); assert.equal(url.port, '55459'); assert.equal(url.pathname, '/postgres');
  const admin = new pg.Client({ connectionString: url.toString() }), database = 'taha_reminders_' + Date.now() + '_' + Math.floor(Math.random() * 100000); let db: pg.Client | undefined; await admin.connect();
  try {
    await admin.query('create database ' + database); url.pathname = '/' + database; db = new pg.Client({ connectionString: url.toString() }); await db.connect(); await migrate(db);
    const store = '10000000-0000-4000-8000-000000000001', owner = randomUUID(), employee = randomUUID(), foreign = randomUUID(); await db.query("insert into public.stores(id,name,branch_name) values($1,'Other','Other')", [foreign]);
    for (const [id, role] of [[owner, 'owner'], [employee, 'employee']]) { await db.query('insert into auth.users(id,email) values($1,$2)', [id, id + '@test.local']); await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,$2,'Reminder Staff',$3,'active')", [id, id + '@test.local', role]); await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)', [id, store]); }
    const actor = async (id: string, sql: string, args: unknown[] = []) => { await db!.query('begin'); try { await db!.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [id]); await db!.query('set local role authenticated'); const result = await db!.query(sql, args); await db!.query('commit'); return result.rows[0]?.value; } catch (error) { await db!.query('rollback'); throw error; } };
    const grant = async (keys: string[]) => { await db!.query('delete from public.employee_permissions where profile_id=$1', [employee]); await db!.query('insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key=any($3)', [employee, store, keys]); };
    const settings = async (patch: Record<string, unknown>) => { const original = await actor(owner, 'select public.get_business_settings($1) value', [store]); await actor(owner, 'select public.save_business_settings($1,$2) value', [store, { ...original, ...patch }]); };
    const customerInput = (id = randomUUID(), more: Record<string, unknown> = {}) => ({ id, name: 'Ahmed Customer', type: 'Individual', phone: '03001234567', creditEnabled: true, enforceCreditLimit: false, creditLimit: 5000, ...more });
    const saveCustomer = (input: unknown, who = owner) => actor(who, 'select public.save_customer($1,$2) value', [store, input]);
    const makeCustomer = async (more: Record<string, unknown> = {}) => { const body = customerInput(randomUUID(), more); await saveCustomer(body); return body; };
    const reminders = (customerId?: string, who = owner, branch = store) => actor(who, 'select public.reminder_obligations($1,$2) value', [branch, customerId ?? null]);
    const history = (input: unknown, who = owner) => actor(who, 'select public.record_reminder_history($1,$2) value', [store, input]);
    const cash = (await db.query("select id from public.payment_methods where store_id=$1 and kind='Cash'", [store])).rows[0].id;
    const saleBody = (customerId: string, more: Record<string, unknown> = {}) => ({ idempotencyKey: randomUUID(), cartId: randomUUID(), customerId, lines: [{ productId: 'custom:' + randomUUID(), quantity: 1, unitPrice: 1750, customService: { name: 'Y20 panel replacement', sellingPrice: 1750, minimumSellingPrice: 0 } }], payments: [{ methodId: 'credit', amount: 1750 }], ...more });
    const complete = (input: unknown) => actor(owner, 'select public.complete_sale($1,$2) value', [store, input]);
    const collect = (customerId: string, amount: number) => actor(owner, 'select public.receive_credit_payment($1,$2) value', [store, { idempotencyKey: randomUUID(), customerId, methodId: cash, amount }]);
    await t.test('due enforcement is optional, account default applies and timezone-safe sale due survives idempotent completion', async () => {
      const customer = await makeCustomer(); const plain = await complete(saleBody(customer.id)); assert.equal(plain.creditDueAt ?? null, null);
      await settings({ creditDueRequired: true, remindersEnabled: true, reminderWarningDays: 3 }); const body = saleBody(customer.id); await assert.rejects(complete(body), /due/i);
      for (const creditDueAt of ['2026-02-30T12:00:00+05:00', '2026-10-17T18:30:00', '2026-10-17', 'bad', 123]) await assert.rejects(complete({ ...saleBody(customer.id), creditDueAt }));
      const withDue = { ...saleBody(customer.id), creditDueAt: '2026-10-17T18:30:00+05:00' }, sold = await complete(withDue); assert.equal(new Date(sold.creditDueAt).toISOString(), '2026-10-17T13:30:00.000Z'); assert.deepEqual(await complete(withDue), sold);
      await assert.rejects(complete({ ...withDue, creditDueAt: '2026-10-18T18:30:00+05:00' }), /reused/i);
      await saveCustomer({ ...customer, dueAt: '2026-10-18T19:00:00+05:00' }); const inherited = await complete(saleBody(customer.id)); assert.equal(new Date(inherited.creditDueAt).toISOString(), '2026-10-18T14:00:00.000Z');
      assert.equal(Number((await db!.query('select credit_limit from public.credit_accounts where customer_id=$1', [customer.id])).rows[0].credit_limit), 5000); await settings({ creditDueRequired: false });
    });
    await t.test('customer WhatsApp contact normalization and permission gates preserve independent credit configuration', async () => {
      const customer = await makeCustomer({ whatsappSameAsPhone: false, whatsappNumber: '+92 311-7654321', dueAt: '2026-10-20T18:00:00+05:00', reminderEnabled: true });
      const read = async () => (await actor(owner, 'select public.transaction_data($1,$2,$3) value', [store, 'customers', { id: customer.id }]))[0]; assert.equal((await read()).whatsappNumber, '923117654321'); assert.equal((await read()).whatsappSameAsPhone, false);
      await grant(['customers.view']); await assert.rejects(saveCustomer({ ...customer, whatsappNumber: '923001234567' }, employee), /permission|Access denied/i);
      await grant(['customers.view', 'customers.edit']); await saveCustomer({ ...customer, whatsappNumber: '0300 1112233' }, employee); assert.equal((await read()).whatsappNumber, '923001112233');
      await assert.rejects(saveCustomer({ ...customer, dueAt: '2026-11-01T12:00:00+05:00' }, employee), /permission|Access denied/i);
      await assert.rejects(saveCustomer({ ...customer, reminderEnabled: false }, employee), /permission|Access denied/i);
      await saveCustomer({ ...customer, whatsappSameAsPhone: true }, owner); assert.equal((await read()).whatsappNumber, '923001234567');
      for (const whatsappNumber of ['abc03001234567', '123', 'https://example.com', '0300<script>']) await assert.rejects(saveCustomer({ ...customer, whatsappSameAsPhone: false, whatsappNumber }));
    });
    await t.test('invoice obligations use exact ledger allocations after collection, reversal and partial return; unallocated debt stays account-level', async () => {
      const customer = await makeCustomer(), first = await complete(saleBody(customer.id, { creditDueAt: '2026-10-18T12:00:00+05:00' })), second = await complete(saleBody(customer.id));
      const payment = await collect(customer.id, 1000); let rows = await reminders(customer.id); assert.equal(rows.find((r: any) => r.saleId === first.id).amount, 750); assert.equal(rows.find((r: any) => r.saleId === second.id).amount, 1750);
      await actor(owner, 'select public.reverse_payment($1,$2) value', [store, { idempotencyKey: randomUUID(), paymentId: payment.id, reason: 'Corrected collection' }]); rows = await reminders(customer.id); assert.equal(rows.find((r: any) => r.saleId === first.id).amount, 1750);
      await db!.query("insert into public.credit_ledger_entries(store_id,customer_id,reference,description,debit,employee_id) values($1,$2,'UNALLOCATED','Historical debt without an invoice allocation',200,$3)", [store, customer.id, owner]); rows = await reminders(customer.id); const legacy = rows.find((r: any) => r.id === 'credit-account:' + customer.id); assert.equal(legacy.amount, 3700); assert.equal(legacy.saleId, undefined); assert.equal(legacy.reference, 'Account balance'); assert.equal(rows.length, 1);
      await actor(owner, 'select public.return_sale_item($1,$2) value', [store, { idempotencyKey: randomUUID(), saleId: first.id, productId: first.lines[0].productId, quantity: 1, destination: 'Do Not Restore Stock', receiptConfirmed: true, manualRefundConfirmed: true, reason: 'Service cancelled' }]); rows = await reminders(customer.id); assert(!rows.some((r: any) => r.saleId === first.id)); assert.equal(rows[0].amount, 1950); assert.equal(rows[0].id, 'credit-account:' + customer.id);
      const partialCustomer = await makeCustomer(), partialBody = saleBody(partialCustomer.id); partialBody.lines[0].quantity = 2; partialBody.lines[0].unitPrice = 1000; partialBody.lines[0].customService.sellingPrice = 1000; partialBody.payments[0].amount = 2000;
      const partialSale = await complete(partialBody); await collect(partialCustomer.id, 500); await actor(owner, 'select public.return_sale_item($1,$2) value', [store, { idempotencyKey: randomUUID(), saleId: partialSale.id, productId: partialSale.lines[0].productId, quantity: 1, destination: 'Do Not Restore Stock', receiptConfirmed: true, manualRefundConfirmed: true, reason: 'Partial service refund' }]); assert.equal((await reminders(partialCustomer.id))[0].amount, 500);
      await collect(partialCustomer.id, 500); assert.deepEqual(await reminders(partialCustomer.id), []);
    });
    let testCustomer: any, testOut: any;
    await t.test('test obligations stay quantity-only and preserve legacy date precision alongside explicit ISO deadlines', async () => {
      testCustomer = await makeCustomer(); const rack = randomUUID(), shelf = randomUUID(), box = randomUUID(), product = randomUUID(); for (const [id, kind, parent] of [[rack, 'rack', null], [shelf, 'shelf', rack], [box, 'box', shelf]]) await db!.query('insert into public.locations(id,store_id,name,kind,parent_location_id) values($1,$2,$3,$3,$4)', [id, store, kind, parent]); await db!.query("insert into public.products(id,store_id,name,category,selling_price,minimum_selling_price) values($1,$2,'Test Panel','Parts',100,0)", [product, store]); await db!.query("insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,actor_profile_id) values($1,$2,$3,10,'RECEIVE',$4)", [store, product, box, owner]);
      const body = (dueDate: string) => ({ idempotencyKey: randomUUID(), customerId: testCustomer.id, productId: product, locationId: box, quantity: 1, takenDate: '2026-01-01', dueDate });
      testOut = await actor(owner, 'select public.save_test_out($1,$2) value', [store, body('2026-12-01')]); let rows = await reminders(testCustomer.id); assert.equal(rows[0].kind, 'test'); assert.equal(rows[0].dueAt, '2026-12-01'); assert.equal(rows[0].quantity, 1); assert.equal(rows[0].amount, undefined);
      const exact = await actor(owner, 'select public.save_test_out($1,$2) value', [store, body('2026-12-01T18:45:22+05:00')]); rows = await reminders(testCustomer.id); assert.equal(new Date(rows.find((r: any) => r.testId === exact.id).dueAt).toISOString(), '2026-12-01T13:45:22.000Z');
      await assert.rejects(actor(owner, 'select public.update_test_out($1,$2) value', [store, { idempotencyKey: randomUUID(), id: exact.id, action: 'extend', dueDate: '2026-12-01T17:00:00+05:00' }]), /deadline|extend/i);
      await actor(owner, 'select public.update_test_out($1,$2) value', [store, { idempotencyKey: randomUUID(), id: exact.id, action: 'extend', dueDate: '2026-12-02T19:00:00+05:00' }]); assert.equal(new Date((await reminders(testCustomer.id)).find((r: any) => r.testId === exact.id).dueAt).toISOString(), '2026-12-02T14:00:00.000Z');
      await actor(owner, 'select public.update_test_out($1,$2) value', [store, { idempotencyKey: randomUUID(), id: exact.id, action: 'return', locationId: box }]); assert(!(await reminders(testCustomer.id)).some((r: any) => r.testId === exact.id));
    });
    await t.test('historical unallocated credits never overstate an invoice obligation or invent a payment allocation', async () => {
      const customer = await makeCustomer(); await complete(saleBody(customer.id));
      await db!.query("insert into public.credit_ledger_entries(store_id,customer_id,reference,description,credit,employee_id) values($1,$2,'UNALLOCATED-CREDIT','Historical credit without invoice allocation',500,$3)", [store, customer.id, owner]);
      const rows = await reminders(customer.id); assert.equal(rows.length, 1); assert.equal(rows[0].id, 'credit-account:' + customer.id); assert.equal(rows[0].amount, 1250); assert.equal(rows[0].saleId, undefined); assert.equal(rows[0].reference, 'Account balance');
    });
    await t.test('manual preparation rechecks current balance/deadline/quantity and append-only history never implies delivery', async () => {
      const customer = await makeCustomer(); await complete(saleBody(customer.id, { creditDueAt: '2026-10-18T12:00:00+05:00' })); const obligation = (await reminders(customer.id))[0];
      const body = { idempotencyKey: randomUUID(), obligationId: obligation.id, kind: 'credit', action: 'prepared', message: 'Please review the account balance.', expectedAmount: 1750, expectedDueAt: obligation.dueAt };
      const beforeHistory = (await db!.query('select coalesce(max(revision),0)::text n from app_private.sync_changes where store_id=$1', [store])).rows[0].n;
      const event = await history(body); assert.equal(event.type, 'reminder-prepared'); assert.equal(event.amount, 1750); assert.equal(event.category, 'Credit'); assert.deepEqual(await history(body), event);
      assert((await db!.query('select * from app_private.sync_changes where store_id=$1 and revision>$2', [store, beforeHistory])).rows.some(r => r.resource === 'customers' && r.entity_id === customer.id), 'A reminder history write must invalidate its customer without disclosing the message');
      await assert.rejects(history({ ...body, message: 'Different text' }), /reused/i); await collect(customer.id, 250); await assert.rejects(history({ ...body, idempotencyKey: randomUUID(), action: 'whatsapp-opened' }), /balance.*changed/i);
      const opened = await history({ ...body, idempotencyKey: randomUUID(), action: 'whatsapp-opened', expectedAmount: 1500 }); assert.equal(opened.type, 'reminder-whatsapp-opened'); assert(!JSON.stringify(opened).match(/delivered|"sent"/i));
      const contacted = await history({ ...body, idempotencyKey: randomUUID(), action: 'contacted', expectedAmount: 1500 }); assert.equal(contacted.type, 'reminder-contacted');
      await assert.rejects(history({ ...body, idempotencyKey: randomUUID(), action: 'sent', expectedAmount: 1500 })); await assert.rejects(history({ ...body, idempotencyKey: randomUUID(), expectedDueAt: null, expectedAmount: 1500 }), /deadline.*changed/i);
      await assert.rejects(db!.query('delete from private.reminder_history where id=$1', [event.entityId]), /append-only/); assert.equal((await db!.query("select relrowsecurity from pg_class where oid='private.reminder_history'::regclass")).rows[0].relrowsecurity, true);
      const timeline = await actor(owner, 'select public.customer_activity($1,$2,$3) value', [store, customer.id, {}]); assert(timeline.rows.some((row: any) => row.id === event.id));
      await grant(['customers.view']); assert.equal((await reminders(customer.id, employee)).length, 0); assert(!(await actor(employee, 'select public.customer_activity($1,$2,$3) value', [store, customer.id, {}])).rows.some((row: any) => row.type?.startsWith('reminder'))); await assert.rejects(history({ ...body, idempotencyKey: randomUUID() }, employee));
      const test = (await reminders(testCustomer.id)).find((r: any) => r.testId === testOut.id); await assert.rejects(history({ idempotencyKey: randomUUID(), obligationId: test.id, kind: 'test', action: 'prepared', expectedQuantity: 2, expectedDueAt: test.dueAt }), /quantity.*changed/i);
      await actor(owner, 'select public.update_test_out($1,$2) value', [store, { idempotencyKey: randomUUID(), id: testOut.id, action: 'extend', dueDate: '2026-12-03T18:00:00+05:00' }]); await assert.rejects(history({ idempotencyKey: randomUUID(), obligationId: test.id, kind: 'test', action: 'prepared', expectedQuantity: 1, expectedDueAt: test.dueAt }), /deadline.*changed/i);
    });
    await t.test('alerts deduplicate from current obligations and honor global/customer policies without a send side effect', async () => {
      const customer = await makeCustomer({ reminderEnabled: true }); await complete(saleBody(customer.id, { creditDueAt: '2020-01-01T12:00:00+05:00' }));
      const first = await actor(owner, 'select public.reminder_alerts($1,$2) value', [store, customer.id]), second = await actor(owner, 'select public.reminder_alerts($1,$2) value', [store, customer.id]); assert.equal(first.length, 1); assert.deepEqual(first, second); assert.equal(first[0].status, 'Overdue'); assert(first[0].id);
      await saveCustomer({ ...customer, reminderEnabled: false }); assert.equal((await actor(owner, 'select public.reminder_alerts($1,$2) value', [store, customer.id])).length, 0); await saveCustomer({ ...customer, reminderEnabled: true }); await settings({ remindersEnabled: false }); assert.equal((await actor(owner, 'select public.reminder_alerts($1,$2) value', [store, customer.id])).length, 0); await settings({ remindersEnabled: true });
      await assert.rejects(reminders(undefined, employee, foreign));
    });
    await t.test('settings, malformed metadata, invalid contacts and private history stay fail-closed', async () => {
      for (const patch of [{ creditDueRequired: 'true' }, { remindersEnabled: null }, { reminderWarningDays: -1 }, { reminderWarningDays: 1.5 }, { reminderWarningDays: 366 }]) await assert.rejects(settings(patch));
      const current = await actor(owner, 'select public.get_business_settings($1) value', [store]); await assert.rejects(actor(employee, 'select public.save_business_settings($1,$2) value', [store, current]));
      const customer = await makeCustomer({ phone: 'Unrecorded phone' }); await complete(saleBody(customer.id)); const obligation = (await reminders(customer.id))[0]; assert.equal(obligation.whatsappNumber, '');
      await assert.rejects(history({ idempotencyKey: randomUUID(), obligationId: obligation.id, kind: 'credit', action: 'whatsapp-opened', expectedAmount: 1750 }), /valid WhatsApp/i);
      await assert.rejects(history({ idempotencyKey: randomUUID(), obligationId: obligation.id, kind: 'credit', action: 'prepared', expectedAmount: 1750, message: 'x'.repeat(4001) }));
      await assert.rejects(history({ idempotencyKey: randomUUID(), obligationId: obligation.id, kind: 'credit', action: 'prepared', deliveredAt: new Date().toISOString() }));
      await assert.rejects(actor(employee, 'select * from private.reminder_history'));
      await grant(['customers.view', 'credit.receive_payment']); assert(!(await reminders(undefined, employee)).some((r: any) => r.kind === 'test'));
      await grant(['inventory.transfer']); assert.deepEqual(await reminders(undefined, employee), []);
      await grant(['customers.view', 'inventory.transfer']); assert((await reminders(undefined, employee)).every((r: any) => r.kind === 'test'));
    });
    await t.test('parallel preparation is idempotent and a payment committed during preview blocks the stale action', async () => {
      const customer = await makeCustomer(); await complete(saleBody(customer.id)); const obligation = (await reminders(customer.id))[0]; const body = { idempotencyKey: randomUUID(), obligationId: obligation.id, kind: 'credit', action: 'prepared', expectedAmount: 1750, expectedDueAt: null, message: 'Parallel manual preview' };
      const run = async (input: unknown) => { const client = new pg.Client({ connectionString: url.toString() }); await client.connect(); try { await client.query('begin'); await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [owner]); await client.query('set local role authenticated'); const result = (await client.query('select public.record_reminder_history($1,$2) value', [store, input])).rows[0].value; await client.query('commit'); return result; } catch (error) { await client.query('rollback'); throw error; } finally { await client.end(); } };
      const results = await Promise.all([run(body), run(body)]); assert.deepEqual(results[0], results[1]); assert.equal((await db!.query("select count(*)::int n from public.audit_logs where action='reminder.prepared' and entity_id=$1", [results[0].entityId])).rows[0].n, 1);
      const payer = new pg.Client({ connectionString: url.toString() }); await payer.connect();
      try {
        await payer.query('begin'); await payer.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [owner]); await payer.query('set local role authenticated'); await payer.query('select public.receive_credit_payment($1,$2)', [store, { idempotencyKey: randomUUID(), customerId: customer.id, methodId: cash, amount: 250 }]);
        const pending = assert.rejects(run({ ...body, idempotencyKey: randomUUID(), action: 'whatsapp-opened' }), /balance.*changed/i); await payer.query('commit'); await pending;
      } finally { await payer.end(); }
      assert.equal((await reminders(customer.id))[0].amount, 1500); assert.deepEqual(await history(body), results[0]);
    });
    await t.test('an account deadline applies to previously undated invoice debt without rewriting its sale snapshot', async () => {
      const customer = await makeCustomer(), sold = await complete(saleBody(customer.id)); const initial = (await reminders(customer.id))[0]; assert.equal(initial.dueAt, undefined);
      await saveCustomer({ ...customer, dueAt: '2026-11-03T17:00:00+05:00' }); const updated = (await reminders(customer.id))[0]; assert.equal(new Date(updated.dueAt).toISOString(), '2026-11-03T12:00:00.000Z');
      assert.equal((await db!.query('select credit_due_at from public.sales where id=$1', [sold.id])).rows[0].credit_due_at, null);
      await assert.rejects(history({ idempotencyKey: randomUUID(), obligationId: initial.id, kind: 'credit', action: 'prepared', expectedAmount: initial.amount, expectedDueAt: null }), /deadline.*changed/i);
    });
    await t.test('real HTTP reminders/history enforce source/contact permissions and return current snapshots', async () => {
      const runtime = new URL(url), role = 'taha_remind_' + Date.now() + '_' + Math.floor(Math.random() * 100000); runtime.username = role; runtime.password = randomUUID(); await runtimeRole(db!, runtime.toString()); const password = 'Stage5 fixture password 2026!', hash = await hashPassword(password); await db!.query('insert into app_private.accounts(user_id,email,password_hash) values($1,$2,$3)', [employee, employee + '@test.local', hash]); await grant(['customers.view', 'credit.receive_payment']);
      process.env.DATABASE_URL = runtime.toString(); process.env.JWT_SECRET = 'stage5-fixture-only-secret-more-than-thirty-two-bytes'; process.env.NODE_ENV = 'test'; process.env.PORT = '0'; process.env.FRONTEND_ORIGIN = 'http://localhost:5173'; process.env.STORAGE_ROOT = await mkdtemp(path.join(os.tmpdir(), 'taha-reminders-')); let app: INestApplication | undefined;
      try {
        const { createApp } = await import('../src/main'); app = await createApp(); await app.listen(0, '127.0.0.1'); const base = await app.getUrl(); const request = async (route: string, method = 'GET', body?: unknown, token?: string) => { const response = await fetch(base + '/api/v1' + route, { method, headers: { Origin: 'http://localhost:5173', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: response.status, value: await response.json() as any }; };
        const token = (await request('/auth/login', 'POST', { email: employee + '@test.local', password })).value.accessToken as string, customer = await makeCustomer(), sold = await complete(saleBody(customer.id)); const read = await request(`/stores/${store}/reminders?customerId=${customer.id}`, 'GET', undefined, token); assert.equal(read.status, 200, JSON.stringify(read.value)); assert.equal(read.value[0].saleId, sold.id); assert.equal(read.value[0].whatsappNumber, '923001234567'); assert(!read.value.some((r: any) => r.kind === 'test'));
        const saved = await request(`/stores/${store}/reminders/history`, 'POST', { idempotencyKey: randomUUID(), obligationId: read.value[0].id, kind: 'credit', action: 'prepared', expectedAmount: 1750, expectedDueAt: null, message: 'Manual preview only.' }, token); assert.equal(saved.status, 201, JSON.stringify(saved.value)); assert.equal(saved.value.type, 'reminder-prepared');
        await grant(['customers.view']); assert.deepEqual((await request(`/stores/${store}/reminders?customerId=${customer.id}`, 'GET', undefined, token)).value, []); assert.equal((await request(`/stores/${foreign}/reminders`, 'GET', undefined, token)).status, 403); assert.equal((await request(`/stores/${store}/reminders`)).status, 401);
      } finally { await app?.close(); await db!.query('drop owned by "' + role + '"'); await admin.query('drop role "' + role + '"'); }
    });
  } finally { await db?.end(); await admin.query('drop database if exists ' + database); await admin.end(); }
});
