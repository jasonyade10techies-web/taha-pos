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

test('Stage1 smart services use atomic, protected and idempotent material accounting', { timeout: 300000 }, async t => {
  const url = new URL(process.env.TAHA_TEST_POSTGRES_URL ?? 'postgresql://taha_phase5c@127.0.0.1:55459/postgres');
  assert.equal(url.port, '55459'); assert.equal(url.pathname, '/postgres');
  assert(['localhost', '127.0.0.1'].includes(url.hostname));
  const admin = new pg.Client({ connectionString: url.toString() });
  const database = 'taha_services_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
  let db: pg.Client | undefined;
  await admin.connect();
  try {
    await admin.query('create database ' + database); url.pathname = '/' + database;
    db = new pg.Client({ connectionString: url.toString() }); await db.connect(); await migrate(db);
    const store = '10000000-0000-4000-8000-000000000001', owner = randomUUID(), employee = randomUUID(), other = randomUUID();
    await db.query("insert into public.stores(id,name,branch_name) values($1,'Other','Other')", [other]);
    for (const [id, role] of [[owner, 'owner'], [employee, 'employee']]) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [id, id + '@test.local']);
      await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,$2,'Services Test',$3,'active')", [id, id + '@test.local', role]);
      await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)', [id, store]);
    }
    const actor = async (id: string, sql: string, args: unknown[] = []) => {
      await db!.query('begin');
      try {
        await db!.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [id]);
        await db!.query('set local role authenticated'); const result = await db!.query(sql, args); await db!.query('commit'); return result;
      } catch (error) { await db!.query('rollback'); throw error; }
    };
    const grant = async (keys: string[]) => db!.query('insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key=any($3) on conflict(profile_id,store_id,permission_id) do update set enabled=true', [employee, store, keys]);
    await grant(['sales.create', 'sales.view', 'services.create_custom', 'services.save_catalog']);
    const panel = randomUUID(), unknown = randomUUID(), foreign = randomUUID(), serviceProduct = randomUUID();
    for (const [id, branch, category, name] of [[panel, store, 'Parts', 'Vivo Y20 Panel'], [unknown, store, 'Parts', 'Unknown Panel'], [foreign, other, 'Parts', 'Foreign Panel'], [serviceProduct, store, 'Services', 'Software']]) {
      await db.query('insert into public.products(id,store_id,name,category,selling_price,minimum_selling_price) values($1,$2,$3,$4,1750,0)', [id, branch, name, category]);
    }
    await db.query('insert into public.product_financials(product_id,store_id,purchase_cost) values($1,$2,1000)', [panel, store]);
    const rack = randomUUID(), shelf = randomUUID(), box = randomUUID(), box2 = randomUUID();
    for (const [id, kind, parent] of [[rack, 'rack', null], [shelf, 'shelf', rack], [box, 'box', shelf], [box2, 'box', shelf]]) {
      await db.query('insert into public.locations(id,store_id,name,kind,parent_location_id) values($1,$2,$3,$4,$5)', [id, store, kind, kind, parent]);
    }
    for (const id of [panel, unknown]) await db.query("insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,actor_profile_id) values($1,$2,$3,36,'RECEIVE',$4)", [store, id, box, owner]);
    const cash = (await db.query("select id from public.payment_methods where store_id=$1 and kind='Cash'", [store])).rows[0].id;
    const material = (productId = panel, quantity = 1) => ({ productId, quantity, allocations: [{ locationId: box, quantity }] });
    // Multi-part fixtures deliberately negotiate below the aggregate retail basis.
    const line = (part: unknown = material(), quantity = 1) => ({ productId: 'custom:' + randomUUID(), quantity, unitPrice: 1750, reason:'Negotiated combined material charge', customService: { name: 'Y20 panel replacement', sellingPrice: 1750, minimumSellingPrice: 0, ...(part === undefined ? {} : { material: part }) } });
    const sale = (lines = [line()]) => ({ idempotencyKey: randomUUID(), cartId: randomUUID(), lines, payments: [{ methodId: cash, amount: lines.reduce((n, item) => n + item.quantity * item.unitPrice, 0) }], cashReceived: lines.reduce((n, item) => n + item.quantity * item.unitPrice, 0) });
    const complete = async (body: unknown, id = owner) => (await actor(id, 'select public.complete_sale($1,$2) value', [store, body])).rows[0].value;
    const stock = async (id = panel) => Number((await db!.query('select sum(quantity) n from public.stock_movements where product_id=$1', [id])).rows[0].n);
    await t.test('Y20 at PKR1750 consumes one of36 and snapshots protected costs and safe linkage', async () => {
      const body = sale(), result = await complete(body);
      assert.equal(await stock(), 35); assert.equal(result.lines.length, 1); assert.equal(result.lines[0].service, true); assert.equal(result.lines[0].name, 'Y20 panel replacement');
      assert.equal(result.lines[0].material.productId, panel); assert.equal(result.lines[0].material.quantity, 1);
      const movement = (await db!.query("select * from public.stock_movements where reference_id=$1 and movement_type='REPAIR_USE'", [result.id])).rows;
      assert.equal(movement.length, 1); assert.equal(movement[0].quantity, -1); assert.equal(movement[0].reference_type, 'sale');
      assert.equal(Number((await db!.query('select purchase_cost from public.sale_item_financials where item_id=$1', [result.lines[0].id])).rows[0].purchase_cost), 1000);
      const receipt = (await db!.query('select app_private.customer_receipt($1,$2) value', [store, result.id])).rows[0].value;
      assert.equal(receipt.items[0].name, 'Y20 panel replacement'); assert(!JSON.stringify(receipt).includes('purchase')); assert(!JSON.stringify(receipt).includes(panel)); assert(!JSON.stringify(receipt).includes(box));
      assert.deepEqual(await complete(body), result); assert.equal(await stock(), 35);
      await assert.rejects(complete({ ...body, cashReceived: 9999 }), /reused/);
      const detail = (await actor(employee, 'select public.get_sale($1,$2) value', [store, result.id])).rows[0].value;
      assert.equal(detail.lines[0].material.productId, panel); assert(!JSON.stringify(detail).includes('purchase_cost'));
    });
    await t.test('private material snapshots have default-deny RLS even if table access is accidentally granted', async () => {
      assert.equal((await db!.query("select relrowsecurity from pg_class where oid='private.service_materials'::regclass")).rows[0].relrowsecurity, true);
      assert.equal((await db!.query("select count(*)::int n from pg_policy where polrelid='private.service_materials'::regclass")).rows[0].n, 0);
      assert.equal((await db!.query('select count(*)::int n from private.service_materials')).rows[0].n, 1);
      await db!.query('begin');
      try {
        await db!.query('grant usage on schema private to authenticated; grant select on private.service_materials to authenticated');
        await db!.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [employee]);
        await db!.query('set local role authenticated');
        assert.deepEqual((await db!.query('select * from private.service_materials')).rows, []);
      } finally { await db!.query('rollback'); }
    });
    await t.test('material cost helper rejects malformed JSON and quantity bounds before immutable financial insertion', async () => {
      const row = (await db!.query('select product_id,input from private.custom_service_lines limit 1')).rows[0];
      const invalid = [null, [], 'part', { ...material(), quantity: '1' }, { ...material(), quantity: 0 }, { ...material(), quantity: -1 }, { ...material(), quantity: 1.5 }, { ...material(), quantity: 1000000 }, { ...material(), productId: 'bad-reference' }, { ...material(), productId: null }, { ...material(), purchaseCost: 0 }];
      try {
        for (const part of invalid) {
          await db!.query('update private.custom_service_lines set input=$1 where product_id=$2', [{ ...row.input, material: part }, row.product_id]);
          await assert.rejects(db!.query('select private.service_material_cost($1,$2)', [store, row.product_id]), (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === '22023'));
        }
      } finally { await db!.query('update private.custom_service_lines set input=$1 where product_id=$2', [row.input, row.product_id]); }
      for (const part of invalid) await assert.rejects(complete(sale([line(part)])), (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === '22023'));
      await db!.query('update public.product_financials set purchase_cost=999999999999.99 where product_id=$1', [panel]);
      try { await assert.rejects(complete(sale([line(material(panel, 2))])), /cost snapshot exceeds/i); }
      finally { await db!.query('update public.product_financials set purchase_cost=1000 where product_id=$1', [panel]); }
      assert.equal(await stock(), 35);
    });
    await t.test('service only never moves stock and line quantity multiplies material per service unit', async () => {
      const plain = line(); delete (plain.customService as { material?: unknown }).material;
      const result = await complete(sale([plain])); assert.equal(result.lines[0].material ?? null, null); assert.equal(await stock(), 35);
      const result2 = await complete(sale([line(material(panel, 2), 3)])); assert.equal(await stock(), 29); assert.equal(result2.lines[0].material.quantity, 6);
      assert.equal(Number((await db!.query('select purchase_cost from public.sale_item_financials where item_id=$1', [result2.lines[0].id])).rows[0].purchase_cost), 2000);
    });
    await t.test('unauthorized material use, foreign/service products and malformed allocations reject atomically', async () => {
      await assert.rejects(complete(sale(), employee), /permission|Access denied/i);
      await grant(['services.consume_inventory']);
      for (const part of [material(foreign), material(serviceProduct), { ...material(), quantity: 1.5 }, { ...material(), quantity: '1' }, { ...material(), allocations: [] }, { ...material(), allocations: [{ locationId: box, quantity: 2 }] }, { ...material(), allocations: [{ locationId: box, quantity: 1 }, { locationId: box, quantity: 1 }], quantity: 2 }, { ...material(), allocations: [{ locationId: box2, quantity: 1 }] }, { ...material(), allocations: [{ locationId: rack, quantity: 1 }] }, { ...material(), purchaseCost: 0 }]) {
        await assert.rejects(complete(sale([line(part)]), employee)); assert.equal(await stock(), 29);
      }
      await db!.query("update public.products set state='archived' where id=$1", [panel]); await assert.rejects(complete(sale())); await db!.query("update public.products set state='active' where id=$1", [panel]);
    });
    await t.test('unknown cost stays NULL and makes profit unavailable', async () => {
      const result = await complete(sale([line(material(unknown))]));
      assert.equal((await db!.query('select purchase_cost from public.sale_item_financials where item_id=$1', [result.lines[0].id])).rows[0].purchase_cost, null);
      const profit = (await actor(owner, 'select public.get_profit_summary($1) value', [store])).rows[0].value; assert.equal(profit.available, false);
    });
    await t.test('insufficient stock, bad second line and failed electronic payment roll back all effects', async () => {
      const counts = async () => (await db!.query('select (select count(*) from public.sales)::int sales,(select count(*) from public.payments)::int payments,(select count(*) from private.custom_service_lines)::int custom,(select count(*) from public.audit_logs)::int audits')).rows[0];
      const before = await counts();
      await assert.rejects(complete(sale([line(material(panel, 30))])), /Insufficient/);
      await assert.rejects(complete(sale([line(), { ...line(), productId: 'custom:' + randomUUID(), unitPrice: 0 }])));
      const digital = randomUUID(); await db!.query("insert into public.payment_methods(id,store_id,name,kind,requires_proof) values($1,$2,'Digital','Digital',true)", [digital, store]);
      const body = sale(); body.payments[0].methodId = digital; await assert.rejects(complete(body), /proof/i);
      assert.deepEqual(await counts(), before); assert.equal(await stock(), 29);
    });
    await t.test('normalized template saves reuse existing identity without granting edit/archive rights', async () => {
      const template = { name: ' Y20 Panel Replacement ', category: 'Repairs', sellingPrice: 1750, minimumSellingPrice: 0, active: true, notes: '' };
      const first = (await actor(employee, 'select public.save_repair_service($1,$2) value', [store, { ...template, id: randomUUID() }])).rows[0].value;
      const duplicate = (await actor(employee, 'select public.save_repair_service($1,$2) value', [store, { ...template, id: randomUUID(), name: 'y20   PANEL replacement', sellingPrice: 999 }])).rows[0].value;
      assert.equal(duplicate.id, first.id); assert.equal(duplicate.sellingPrice, 1750);
      await assert.rejects(actor(employee, 'select public.save_repair_service($1,$2)', [store, { ...template, id: first.id, active: false }]), /permission|Access denied/i);
      const edited = (await actor(owner, 'select public.save_repair_service($1,$2) value', [store, { ...template, id: first.id, minimumSellingPrice: 1500 }])).rows[0].value; assert.equal(edited.minimumSellingPrice, 1500);
    });
    await t.test('dedicated material locations require sale and consume grants and return only active eligible boxes', async () => {
      const rows = (await actor(employee, 'select public.service_material_locations($1,$2) value', [store, panel])).rows[0].value;
      assert.deepEqual(rows, [{ productId: panel, locationId: box, quantity: 29, path: 'rack → shelf → box' }]);
      assert(!JSON.stringify(rows).includes('cost'));
      await db!.query('update public.employee_permissions set enabled=false where profile_id=$1 and permission_id=(select id from public.permissions where key=$2)', [employee, 'services.consume_inventory']);
      await assert.rejects(actor(employee, 'select public.service_material_locations($1,$2)', [store, panel]), /permission|Access denied/i); await grant(['services.consume_inventory']);
      await assert.rejects(actor(owner, 'select public.service_material_locations($1,$2)', [store, foreign]));
      await db!.query('update public.locations set active=false where id=$1', [shelf]);
      assert.deepEqual((await actor(owner, 'select public.service_material_locations($1,$2) value', [store, panel])).rows[0].value, []);
      await db!.query('update public.locations set active=true where id=$1', [shelf]);
    });
    await t.test('material return keeps linkage, validates refunds and prevents void after return', async () => {
      const result = await complete(sale()); const before = await stock();
      await assert.rejects(actor(owner, 'select public.void_sale($1,$2)', [store, { saleId: result.id, idempotencyKey: randomUUID(), reason: 'Cancel', manualRefundConfirmed: false }]), /refund/i);
      const returned = (await actor(owner, 'select public.return_sale_item($1,$2) value', [store, { saleId: result.id, productId: result.lines[0].productId, idempotencyKey: randomUUID(), quantity: 1, destination: 'Do Not Restore Stock', reason: 'Return', receiptConfirmed: true, manualRefundConfirmed: true }])).rows[0].value;
      assert.equal(returned.material.productId, panel);assert.equal(returned.material.quantity,1);
      await assert.rejects(actor(owner, 'select public.void_sale($1,$2)', [store, { saleId: result.id, idempotencyKey: randomUUID(), reason: 'Cancel', manualRefundConfirmed: true }]), /unreturned/i);
      assert.equal(await stock(), before);
    });
    await t.test('mixed ordinary product and service checkout preserves stock allocation and service-only permissions', async () => {
      const ordinary = { productId: unknown, quantity: 1, unitPrice: 1750 };
      const custom = line(); delete (custom.customService as { material?: unknown }).material;
      await db!.query('update public.employee_permissions set enabled=false where profile_id=$1 and permission_id=(select id from public.permissions where key=$2)', [employee, 'services.consume_inventory']);
      const body = { ...sale([custom]), lines: [ordinary, custom], payments: [{ methodId: cash, amount: 3500 }], cashReceived: 3500 };
      const result = await complete(body, employee); assert.equal(result.lines.length, 2); assert.equal(await stock(unknown), 34); await grant(['services.consume_inventory']);
      const before = await stock(); await assert.rejects(complete(sale([line(), line(material(panel, 999))])), /Insufficient/); assert.equal(await stock(), before);
    });
    await t.test('spoofed service reference, used device and private snapshots reject access', async () => {
      await db!.query("insert into public.purchased_devices(product_id,store_id,status) values($1,$2,'In Stock')", [panel, store]);
      await assert.rejects(complete(sale()), /used devices/i);
      await assert.rejects(actor(owner, 'select public.service_material_locations($1,$2)', [store, panel]));
      await db!.query('delete from public.purchased_devices where product_id=$1', [panel]);
      const spoof = line(); spoof.productId = 'custom:' + panel; await assert.rejects(complete(sale([spoof])), /reference/i);
      await assert.rejects(actor(employee, 'select * from private.service_materials'), /permission denied/i);
      assert.equal((await actor(employee, 'select * from public.sale_item_financials')).rows.length, 0);
    });
    await t.test('separate concurrent connections serialize stock consumption and duplicate requests', async () => {
      const execute = async (body: unknown) => {
        const client = new pg.Client({ connectionString: url.toString() }); await client.connect();
        try {
          await client.query('begin'); await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [owner]); await client.query('set local role authenticated');
          const result = (await client.query('select public.complete_sale($1,$2) value', [store, body])).rows[0].value; await client.query('commit'); return result;
        } catch (error) { await client.query('rollback'); throw error; } finally { await client.end(); }
      };
      const results = await Promise.allSettled([execute(sale([line(material(panel, 20))])), execute(sale([line(material(panel, 20))]))]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(results.filter(r => r.status === 'rejected').length, 1); assert.equal(await stock(), 8);
      const body = sale(), repeated = await Promise.all([execute(body), execute(body)]); assert.deepEqual(repeated[0], repeated[1]); assert.equal(await stock(), 7);
    });
    await t.test('real HTTP checkout and locations enforce grants with a distinct unprivileged runtime role and customer receipt', async () => {
      const runtime = new URL(url), role = 'taha_svc_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
      runtime.username = role; runtime.password = randomUUID(); await runtimeRole(db!, runtime.toString());
      const password = 'Stage1 fixture password 2026!', hash = await hashPassword(password);
      await db!.query('insert into app_private.accounts(user_id,email,password_hash) values($1,$2,$3)', [employee, employee + '@test.local', hash]);
      process.env.DATABASE_URL = runtime.toString(); process.env.JWT_SECRET = 'stage1-fixture-only-secret-more-than-thirty-two-bytes'; process.env.NODE_ENV = 'test'; process.env.PORT = '0'; process.env.FRONTEND_ORIGIN = 'http://localhost:5173'; process.env.STORAGE_ROOT = await mkdtemp(path.join(os.tmpdir(), 'taha-services-'));
      let app: INestApplication | undefined;
      try {
        const { createApp } = await import('../src/main'); app = await createApp(); await app.listen(0, '127.0.0.1'); const base = await app.getUrl();
        const request = async (route: string, method = 'GET', body?: unknown, token?: string) => {
          const response = await fetch(base + '/api/v1' + route, { method, headers: { Origin: 'http://localhost:5173', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
          return { status: response.status, value: await response.json() as Record<string, any> };
        };
        const login = await request('/auth/login', 'POST', { email: employee + '@test.local', password }); assert.equal(login.status, 201); const token = login.value.accessToken as string;
        const flags = (await db!.query('select rolsuper,rolbypassrls from pg_roles where rolname=$1', [role])).rows[0]; assert.equal(flags.rolsuper, false); assert.equal(flags.rolbypassrls, false);
        const locations = await request(`/stores/${store}/services/material-locations/${panel}`, 'GET', undefined, token); assert.equal(locations.status, 200); assert.equal(locations.value[0].quantity, 7);
        await db!.query('update public.employee_permissions set enabled=false where profile_id=$1 and permission_id=(select id from public.permissions where key=$2)', [employee, 'services.consume_inventory']);
        assert.equal((await request(`/stores/${store}/services/material-locations/${panel}`, 'GET', undefined, token)).status, 403);
        const body = sale(); assert.equal((await request(`/stores/${store}/sales`, 'POST', body, token)).status, 403); assert.equal(await stock(), 7); await grant(['services.consume_inventory']);
        const result = await request(`/stores/${store}/sales`, 'POST', body, token); assert.equal(result.status, 201, JSON.stringify(result.value)); assert.equal(result.value.lines[0].material.productId, panel); assert.equal(await stock(), 6);
        const retry = await request(`/stores/${store}/sales`, 'POST', body, token); assert.equal(retry.value.id, result.value.id); assert.equal(await stock(), 6);
        const receipt = await fetch(base + new URL(result.value.receiptUrl as string).pathname); assert.equal(receipt.status, 200); const html = await receipt.text(); assert(html.includes('Y20 panel replacement')); assert(!html.includes(panel)); assert(!html.includes(box)); assert(!html.includes('purchase_cost'));
      } finally { await app?.close(); await db!.query('drop owned by "' + role + '"'); await admin.query('drop role "' + role + '"'); }
    });
  } finally { await db?.end(); await admin.query('drop database if exists ' + database); await admin.end(); }
});
