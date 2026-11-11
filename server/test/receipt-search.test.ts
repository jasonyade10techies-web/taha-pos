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

test('Stage4 receipt lookup safely searches real scoped invoices without choosing an ambiguous candidate', { timeout: 300000 }, async t => {
  const url = new URL(process.env.TAHA_TEST_POSTGRES_URL ?? 'postgresql://taha_phase5c@127.0.0.1:55459/postgres');
  assert.equal(url.port, '55459'); assert.equal(url.pathname, '/postgres'); assert(['localhost', '127.0.0.1'].includes(url.hostname));
  const admin = new pg.Client({ connectionString: url.toString() }), database = 'taha_receipts_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
  let db: pg.Client | undefined; await admin.connect();
  try {
    await admin.query('create database ' + database); url.pathname = '/' + database; db = new pg.Client({ connectionString: url.toString() }); await db.connect(); await migrate(db);
    const store = '10000000-0000-4000-8000-000000000001', otherStore = randomUUID(), owner = randomUUID(), employee = randomUUID(), cashier = randomUUID(), customer = randomUUID(), another = randomUUID();
    await db.query("insert into public.stores(id,name,branch_name) values($1,'Other','Other')", [otherStore]);
    for (const [id, role, name] of [[owner, 'owner', 'Ahmed Khan'], [employee, 'employee', 'Return Staff'], [cashier, 'employee', 'Hamza Counter']]) { await db.query('insert into auth.users(id,email) values($1,$2)', [id, id + '@test.local']); await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,$2,$3,$4,'active')", [id, id + '@test.local', name, role]); await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)', [id, store]); }
    for (const [id, name, phone] of [[customer, 'Ali Raza', '0300-1234567'], [another, 'Sara', '0311 7654321']]) await db.query("insert into public.customers(id,store_id,name,type,phone) values($1,$2,$3,'Individual',$4)", [id, store, name, phone]);
    const actor = async (id: string, sql: string, args: unknown[] = []) => { await db!.query('begin'); try { await db!.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [id]); await db!.query('set local role authenticated'); const result = await db!.query(sql, args); await db!.query('commit'); return result.rows[0]?.value; } catch (error) { await db!.query('rollback'); throw error; } };
    const grant = async (who: string, keys: string[]) => { await db!.query('delete from public.employee_permissions where profile_id=$1', [who]); await db!.query('insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key=any($3)', [who, store, keys]); };
    await grant(cashier, ['sales.create', 'services.create_custom']); await grant(employee, ['returns.create']);
    const cash = (await db.query("select id from public.payment_methods where store_id=$1 and kind='Cash'", [store])).rows[0].id;
    const list = (filter: Record<string, unknown> = {}, who = owner, branch = store) => actor(who, 'select public.list_sales($1,$2) value', [branch, filter]);
    const lookup = (filter: Record<string, unknown> = {}, who = owner, branch = store) => actor(who, 'select public.return_receipt_lookup($1,$2) value', [branch, filter]);
    const created: any[] = [];
    for (const [invoice, person, seller, name, stamp] of [['TM-INV-000123', customer, owner, 'Vivo Y20 Panel Replacement', '2026-10-14T18:59:59.999Z'], ['TM-INV-000223', customer, cashier, 'Software Installation', '2026-10-14T19:00:00.001Z'], ['TM-INV-000323', another, owner, '50%_panel \\ rack', '2026-10-14T19:00:00.001Z'], ['TM-INV-000999', another, owner, 'Battery fitting', '2026-10-13T09:00:00Z']]) {
      const sale = await actor(seller, 'select public.complete_sale($1,$2) value', [store, { idempotencyKey: randomUUID(), cartId: randomUUID(), customerId: person, lines: [{ productId: 'custom:' + randomUUID(), quantity: 2, unitPrice: 100, customService: { name, sellingPrice: 100, minimumSellingPrice: 0 } }], payments: [{ methodId: cash, amount: 200 }], cashReceived: 200 }]);
      await db.query('update public.sales set invoice=$1,created_at=$2 where id=$3', [invoice, stamp, sale.id]); created.push({ ...sale, invoice });
    }
    await db.query('update public.payments set proof_path=$1 where sale_id=$2', [store + '/proof/private-evidence.webp', created[0].id]);
    await t.test('invoice full/partial23, customer name/phone, item, cashier and Karachi receipt date return matching candidates', async () => {
      assert.equal((await list({ search: 'TM-INV-000123' })).rows[0].id, created[0].id); assert.equal((await list({ search: '23' })).total, 3);
      assert.equal((await list({ search: '000123' })).total, 1); assert.equal((await list({ search: 'Ali Raza' })).total, 2); assert.equal((await list({ search: '03001234567' })).total, 2); assert.equal((await list({ search: '0300 1234567' })).total, 2);
      assert.equal((await list({ search: '+92 300 1234567' })).total, 2); assert.equal((await list({ search: 'Y20 panel' })).total, 1); assert.equal((await list({ search: 'hamza counter' })).rows[0].id, created[1].id); assert.equal((await list({ search: '2026-10-15' })).total, 2);
      const ambiguous = await lookup({ search: '23' }, employee); assert.equal(ambiguous.rows.length, 3); assert.equal(ambiguous.total, 3); assert.equal((await lookup({ search: 'not found' }, employee)).total, 0);
    });
    await t.test('literal wildcard characters never become all-record searches and empty search stays a bounded page', async () => {
      for (const search of ['%', '_', '\\']) { const page = await list({ search }); assert.equal(page.total, 1); assert.equal(page.rows[0].id, created[2].id); }
      assert.equal((await lookup({ search: '  ', limit: 2 }, employee)).rows.length, 2); assert.equal((await lookup({ search: '50%_panel' })).total, 1);
    });
    await t.test('customer/cashier/payment/status/date filters and stable pagination use actual records', async () => {
      assert.equal((await list({ customer })).total, 2); assert.equal((await list({ employee: cashier })).total, 1); assert.equal((await list({ method: cash })).total, 4); assert.equal((await list({ method: 'credit' })).total, 0); assert.equal((await list({ status: 'Paid' })).total, 4);
      assert.equal((await list({ from: '2026-10-14', to: '2026-10-14' })).rows[0].id, created[0].id); assert.equal((await list({ from: '2026-10-15', to: '2026-10-15' })).total, 2);
      const all = await list({ search: '23', limit: 100 }), first = await list({ search: '23', limit: 1, page: 0 }), second = await list({ search: '23', limit: 1, page: 1 }); assert.equal(first.total, 3); assert.equal(first.page, 0); assert.equal(first.limit, 1); assert.equal(first.rows[0].id, all.rows[0].id); assert.equal(second.rows[0].id, all.rows[1].id); assert.notEqual(first.rows[0].id, second.rows[0].id);
      for (const filter of [{ from: '2026-02-30' }, { from: '2026-10-15', to: '2026-10-14' }, { limit: 0 }, { page: -1 }, { search: 'x'.repeat(201) }, { id: 'bad-id' }, { status: 'arbitrary' }, { unknownField: true }]) await assert.rejects(lookup(filter));
    });
    await t.test('returns-only id lookup preserves returned counts/material linkage while proof/approval/minimum/cost fields remain omitted', async () => {
      const sold = created[0];
      // The fixed historical timestamps above test Karachi date boundaries.
      // This independent return-permission case needs a receipt inside policy.
      await db!.query('update public.sales set created_at=now() where id=$1',[sold.id]);
      const result = await actor(owner, 'select public.return_sale_item($1,$2) value', [store, { idempotencyKey: randomUUID(), saleId: sold.id, productId: sold.lines[0].productId, quantity: 1, destination: 'Do Not Restore Stock', receiptConfirmed: true, manualRefundConfirmed: true, reason: 'Partial refund' }]);
      const page = await lookup({ id: sold.id }, employee); assert.equal(page.total, 1); assert.equal(page.rows[0].id, sold.id); assert.equal(page.rows[0].returned[sold.lines[0].productId], 1); assert.equal(page.rows[0].lines[0].returnedQuantity, 1); assert.equal(page.rows[0].lines[0].returnableQuantity, 1);
      assert(!JSON.stringify(page).match(/private-evidence|proof|approval|minimumPrice|purchase_cost|purchaseCost/i)); assert.equal(result.quantity, 1);
      const history=await actor(employee,'select public.transaction_data($1,$2,$3) value',[store,'returns',{saleId:sold.id,limit:1,page:999}]);assert.equal(history.length,1);assert.equal(history[0].id,result.id);
      const foreignHistory=await actor(employee,'select public.transaction_data($1,$2,$3) value',[store,'returns',{saleId:randomUUID()}]);assert.equal(foreignHistory.length,0);
      const detail = await actor(owner, 'select public.get_sale($1,$2) value', [store, sold.id]); assert(detail.payments.some((p: any) => p.proof?.includes('private-evidence')));
      const returnDetail = await actor(employee, 'select public.get_sale($1,$2) value', [store, sold.id]); assert(!JSON.stringify(returnDetail).includes('private-evidence'));
      const unchanged = (await db!.query('select count(*)::int n from public.sales')).rows[0].n; await lookup({ id: sold.id }, employee); assert.equal((await db!.query('select count(*)::int n from public.sales')).rows[0].n, unchanged);
    });
    await t.test('unauthorized/out-of-store lookups reject while same-store missing ids return an empty candidate page', async () => {
      await grant(employee, []); await assert.rejects(lookup({}, employee), /Access denied|permission/i); await grant(employee, ['returns.create']); await assert.rejects(lookup({}, employee, otherStore), /Access denied|permission/i);
      assert.equal((await lookup({ id: randomUUID() }, employee)).total, 0); const foreign = randomUUID(); await db!.query("insert into public.sales(id,store_id,invoice,customer_name,employee_id,employee_name,subtotal,discount,total,status) values($1,$2,'FOREIGN-RECEIPT','Other',$3,'Other',10,0,10,'Paid')", [foreign, otherStore, owner]); assert.equal((await lookup({ id: foreign }, employee)).total, 0);
      const safe = (await db!.query('select app_private.customer_receipt($1,$2) value', [store, created[0].id])).rows[0].value; assert(!JSON.stringify(safe).match(/private-evidence|proof|approval|purchase_cost|minimumPrice/i));
    });
    await t.test('lookup preserves physical material linkage and marks voided service lines unreturnable', async () => {
      const product = randomUUID(), rack = randomUUID(), shelf = randomUUID(), box = randomUUID();
      for (const [id, kind, parent] of [[rack, 'rack', null], [shelf, 'shelf', rack], [box, 'box', shelf]]) await db!.query('insert into public.locations(id,store_id,name,kind,parent_location_id) values($1,$2,$3,$3,$4)', [id, store, kind, parent]);
      await db!.query("insert into public.products(id,store_id,name,category,selling_price,minimum_selling_price) values($1,$2,'Lookup Component','Parts',200,0)", [product, store]); await db!.query('insert into public.product_financials(product_id,store_id,purchase_cost) values($1,$2,65)', [product, store]); await db!.query("insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,actor_profile_id) values($1,$2,$3,10,'RECEIVE',$4)", [store, product, box, owner]);
      const sold = await actor(owner, 'select public.complete_sale($1,$2) value', [store, { idempotencyKey: randomUUID(), cartId: randomUUID(), lines: [{ productId: 'custom:' + randomUUID(), quantity: 1, unitPrice: 200, customService: { name: 'Component fitting', sellingPrice: 200, minimumSellingPrice: 0, material: { productId: product, quantity: 1, allocations: [{ locationId: box, quantity: 1 }] } } }], payments: [{ methodId: cash, amount: 200 }], cashReceived: 200 }]);
      const before = (await lookup({ id: sold.id }, employee)).rows[0]; assert.equal(before.lines[0].material.productId, product); assert.equal(before.lines[0].material.quantity, 1); assert.equal(before.lines[0].returnableQuantity, 1); assert(!JSON.stringify(before).match(/purchase_cost|purchaseCost|minimumPrice/));
      await actor(owner, 'select public.void_sale($1,$2) value', [store, { idempotencyKey: randomUUID(), saleId: sold.id, reason: 'Fixture cancellation', manualRefundConfirmed: true }]); const after = (await lookup({ id: sold.id }, employee)).rows[0]; assert.equal(after.status, 'Voided'); assert.equal(after.lines[0].returnableQuantity, 0);
    });
    await t.test('method filters include real debt allocations and ignore pending payment claims', async () => {
      await db!.query('insert into public.credit_accounts(customer_id,store_id,enabled,enforce_limit) values($1,$2,true,false)', [customer, store]);
      const sold = await actor(owner, 'select public.complete_sale($1,$2) value', [store, { idempotencyKey: randomUUID(), cartId: randomUUID(), customerId: customer, lines: [{ productId: 'custom:' + randomUUID(), quantity: 1, unitPrice: 200, customService: { name: 'Credit service fixture', sellingPrice: 200, minimumSellingPrice: 0 } }], payments: [{ methodId: 'credit', amount: 200 }] }]);
      assert.equal((await lookup({ id: sold.id, method: cash })).total, 0); await actor(owner, 'select public.receive_credit_payment($1,$2) value', [store, { idempotencyKey: randomUUID(), customerId: customer, methodId: cash, amount: 100 }]); assert.equal((await lookup({ id: sold.id, method: cash })).total, 1); assert.equal((await lookup({ id: sold.id, method: 'credit' })).total, 1);
      const digital = randomUUID(); await db!.query("insert into public.payment_methods(id,store_id,name,kind) values($1,$2,'Fixture Digital','Digital')", [digital, store]); await db!.query("insert into public.payments(store_id,code,sale_id,customer_id,method_id,amount,kind,status,method_name,method_kind,employee_id) values($1,$2,$3,$4,$5,100,'sale','Pending','Fixture Digital','Digital',$6)", [store, 'PENDING-' + randomUUID(), sold.id, customer, digital, owner]); assert.equal((await lookup({ id: sold.id, method: digital })).total, 0);
    });
    await t.test('real HTTP return receipt lookup permits returns-only staff and preserves signed customer receipt separation', async () => {
      const runtime = new URL(url), role = 'taha_receipts_' + Date.now() + '_' + Math.floor(Math.random() * 100000); runtime.username = role; runtime.password = randomUUID(); await runtimeRole(db!, runtime.toString());
      const password = 'Stage4 fixture password 2026!', hash = await hashPassword(password); for (const profile of [employee, owner]) await db!.query('insert into app_private.accounts(user_id,email,password_hash) values($1,$2,$3)', [profile, profile + '@test.local', hash]);
      process.env.DATABASE_URL = runtime.toString(); process.env.JWT_SECRET = 'stage4-fixture-only-secret-more-than-thirty-two-bytes'; process.env.NODE_ENV = 'test'; process.env.PORT = '0'; process.env.FRONTEND_ORIGIN = 'http://localhost:5173'; process.env.STORAGE_ROOT = await mkdtemp(path.join(os.tmpdir(), 'taha-receipts-'));
      let app: INestApplication | undefined;
      try {
        const { createApp } = await import('../src/main'); app = await createApp(); await app.listen(0, '127.0.0.1'); const base = await app.getUrl();
        const request = async (route: string, method = 'GET', body?: unknown, token?: string) => { const response = await fetch(base + '/api/v1' + route, { method, headers: { Origin: 'http://localhost:5173', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: response.status, value: await response.json() as any }; };
        const token = (await request('/auth/login', 'POST', { email: employee + '@test.local', password })).value.accessToken as string;
        const search = await request(`/stores/${store}/returns/receipts?search=23`, 'GET', undefined, token); assert.equal(search.status, 200, JSON.stringify(search.value)); assert(search.value.total >= 3); for (const candidate of created.slice(0, 3)) assert(search.value.rows.some((row: any) => row.id === candidate.id)); assert(!JSON.stringify(search.value).match(/private-evidence|proof|approval|minimumPrice|purchase_cost/i));
        const selected = await request(`/stores/${store}/returns/receipts?id=${created[0].id}`, 'GET', undefined, token); assert.equal(selected.status, 200); assert.equal(selected.value.rows[0].id, created[0].id); assert(selected.value.rows[0].receiptUrl);
        const capability = new URL(selected.value.rows[0].receiptUrl).pathname.replace('/api/v1', ''), customerReceipt = await request(capability + '/data'); assert.equal(customerReceipt.status, 200); assert.equal(customerReceipt.value.invoice, 'TM-INV-000123'); assert(!JSON.stringify(customerReceipt.value).match(/private-evidence|proof|approval|stockAllocations|purchase_cost/i));
        assert.equal((await request(`/stores/${store}/returns/receipts`)).status, 401); assert.equal((await request(`/stores/${otherStore}/returns/receipts`, 'GET', undefined, token)).status, 403);
        assert.equal((await request(`/auth/session`, 'GET', undefined, capability.split('/').at(-1))).status, 401); await grant(employee, []); assert.equal((await request(`/stores/${store}/returns/receipts`, 'GET', undefined, token)).status, 403);
      } finally { await app?.close(); await db!.query('drop owned by "' + role + '"'); await admin.query('drop role "' + role + '"'); }
    });
  } finally { await db?.end(); await admin.query('drop database if exists ' + database); await admin.end(); }
});
