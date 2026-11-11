import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { migrate, runtimeRole } from '../scripts/migrate';
import { hashPassword } from '../src/auth/crypto';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import type { INestApplication } from '@nestjs/common';

test('Stage2 damaged stock and classified material returns remain transactional and scoped', { timeout: 300000 }, async t => {
  const url = new URL(process.env.TAHA_TEST_POSTGRES_URL ?? 'postgresql://taha_phase5c@127.0.0.1:55459/postgres');
  assert.equal(url.port, '55459'); assert.equal(url.pathname, '/postgres'); assert(['localhost', '127.0.0.1'].includes(url.hostname));
  const admin = new pg.Client({ connectionString: url.toString() }); const database = 'taha_damage_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
  let db: pg.Client | undefined;
  await admin.connect();
  try {
    await admin.query('create database ' + database); url.pathname = '/' + database; db = new pg.Client({ connectionString: url.toString() }); await db.connect(); await migrate(db);
    const store = '10000000-0000-4000-8000-000000000001', owner = randomUUID(), employee = randomUUID(), foreignStore = randomUUID();
    await db.query("insert into public.stores(id,name,branch_name) values($1,'Other','Other')", [foreignStore]);
    for (const [id, role] of [[owner, 'owner'], [employee, 'employee']]) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [id, id + '@test.local']); await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,$2,'Damage Test',$3,'active')", [id, id + '@test.local', role]); await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)', [id, store]);
    }
    await db.query("insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key in ('inventory.view','returns.create','returns.approve','sales.create','inventory.transfer')", [employee, store]);
    const actor = async (id: string, sql: string, args: unknown[] = []) => {
      await db!.query('begin'); try { await db!.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [id]); await db!.query('set local role authenticated'); const value = await db!.query(sql, args); await db!.query('commit'); return value.rows[0]?.value; } catch (error) { await db!.query('rollback'); throw error; }
    };
    const rack = randomUUID(), shelf = randomUUID(), available = randomUUID(), damaged = randomUUID(), quarantine2 = randomUUID();
    for (const [id, kind, parent, condition] of [[rack, 'rack', '', 'Available'], [shelf, 'shelf', rack, 'Available'], [available, 'box', shelf, 'Available'], [damaged, 'box', shelf, 'Damaged'], [quarantine2, 'box', shelf, 'Damaged']]) {
      await actor(owner, 'select public.save_location($1,$2) value', [store, { id, name: id === damaged ? 'Quarantine' : kind, kind, parent_id: parent, stockCondition: condition }]);
    }
    const cash = (await db.query("select id from public.payment_methods where store_id=$1 and kind='Cash'", [store])).rows[0].id;
    const fixture = async (quantity = 36, known = true) => {
      const product = randomUUID(); await db!.query("insert into public.products(id,store_id,name,category,selling_price,minimum_selling_price) values($1,$2,'Vivo Y20 Panel','Parts',1750,0)", [product, store]);
      if (known) await db!.query('insert into public.product_financials(product_id,store_id,purchase_cost) values($1,$2,1000)', [product, store]);
      await db!.query("insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,actor_profile_id) values($1,$2,$3,$4,'RECEIVE',$5)", [store, product, available, quantity, owner]); return product;
    };
    const sale = async (product: string, quantity = 1, materialUnits = 0) => actor(owner, 'select public.complete_sale($1,$2) value', [store, { idempotencyKey: randomUUID(), cartId: randomUUID(), lines: [{ productId: materialUnits ? 'custom:' + randomUUID() : product, quantity, unitPrice: 1750, reason: 'Negotiated combined material charge', ...(materialUnits ? { customService: { name: 'Y20 panel replacement', sellingPrice: 1750, minimumSellingPrice: 0, material: { productId: product, quantity: materialUnits, allocations: [{ locationId: available, quantity: materialUnits }] } } } : {}) }], payments: [{ methodId: cash, amount: quantity * 1750 }], cashReceived: quantity * 1750 }]);
    const returnBody = (sold: any, destination: string, quantity = 1, locationId = destination === 'Damaged' ? damaged : available) => ({ idempotencyKey: randomUUID(), saleId: sold.id, productId: sold.lines[0].productId, quantity, destination, locationId, reason: 'Panel returned', receiptConfirmed: true, manualRefundConfirmed: true });
    const returned = async (body: unknown) => actor(owner, 'select public.return_sale_item($1,$2) value', [store, body]);
    const overview = async (product: string) => (await actor(owner, 'select public.inventory_conditions($1,$2) value', [store, product]))[0];
    const lots = async (product: string) => actor(owner, 'select public.damaged_inventory($1,$2) value', [store, product]);
    const action = (lot: any, type: string, quantity: number, expectedQuantity: number, destinationId?: string) => ({ idempotencyKey: randomUUID(), lotId: lot.id, sourceLocationId: lot.locationId, quantity, expectedQuantity, action: type, destinationId, notes: 'Inspected panel', photos: [] });
    const act = async (body: unknown, who = owner) => actor(who, 'select public.damaged_inventory_action($1,$2) value', [store, body]);
    await t.test('quarantine boxes are explicit and reject receiving, available transfer, adjustment and archive with damaged balance', async () => {
      assert.equal((await db!.query('select stock_condition from public.locations where id=$1', [damaged])).rows[0].stock_condition, 'Damaged');
      const product = await fixture(); await assert.rejects(actor(owner, 'select public.transfer_stock($1,$2,$3,$4,1,$5) value', [store, product, available, damaged, randomUUID()]));
      await assert.rejects(actor(owner, 'select public.adjust_stock($1,$2,$3,0,1,$4,$5) value', [store, product, damaged, 'Opening Stock', randomUUID()]));
      const rows = await actor(employee, 'select public.condition_locations($1,$2) value', [store, 'Damaged']); assert.equal(rows.length, 2);
    });
    await t.test('ScenarioD keeps available35 and records damaged1 with sale/return/actor origins; retries never restore twice', async () => {
      const product = await fixture(), sold = await sale(product), body = returnBody(sold, 'Damaged'), result = await returned(body);
      const summary = await overview(product); assert.deepEqual(summary, { productId: product, available: 35, damaged: 1, outForTest: 0, totalPhysical: 36 });
      const rows = await lots(product); assert.equal(rows.length, 1); assert.equal(rows[0].quantity, 1); assert.equal(rows[0].returnId, result.id); assert.equal(rows[0].saleId, sold.id); assert.equal(rows[0].locationId, damaged); assert.equal(rows[0].employeeId, owner);
      assert.deepEqual(await returned(body), result); await assert.rejects(returned({ ...body, idempotencyKey: randomUUID() })); assert.equal((await overview(product)).damaged, 1);
      await assert.rejects(actor(owner, 'select public.archive_location($1,$2) value', [store, damaged]), /stock|balance/i);
      assert(!JSON.stringify(rows).includes('purchase_cost'));
    });
    await t.test('sellable/no-restoration returns and invalid damaged destinations remain atomic', async () => {
      const product = await fixture(), sold = await sale(product); await returned(returnBody(sold, 'Sellable Stock')); assert.equal((await overview(product)).available, 36);
      const second = await sale(product); await returned(returnBody(second, 'Do Not Restore Stock')); assert.equal((await overview(product)).totalPhysical, 35);
      const third = await sale(product), body = returnBody(third, 'Damaged'); await assert.rejects(returned({ ...body, locationId: '' }), /quarantine|damaged box/i); await assert.rejects(returned({ ...body, locationId: available }));
      assert.equal((await overview(product)).available, 34); assert.equal((await overview(product)).damaged, 0);
    });
    await t.test('damaged transfer/recover/write-off preserves physical totals and rejects stale, repeated or unauthorized mutations', async () => {
      const product = await fixture(), sold = await sale(product, 3); await returned(returnBody(sold, 'Damaged', 3)); let lot = (await lots(product))[0];
      const transfer = action(lot, 'transfer', 2, 3, quarantine2); await act(transfer, employee); await act(transfer, employee); assert.equal((await overview(product)).totalPhysical, 36);
      const beforePrivateChange = (await db!.query('select coalesce(max(revision),0)::text n from app_private.sync_changes where store_id=$1', [store])).rows[0].n;
      await act({ ...action(lot, 'note', 0, 1), notes: 'Private inspection note' }); const revision = (await db!.query('select * from app_private.sync_changes where store_id=$1 and revision>$2', [store, beforePrivateChange])).rows; assert(revision.some(r => r.resource === 'stock' && r.entity_id === product), 'A condition-only change must advance the product stock revision'); assert(!JSON.stringify(revision).includes('Private inspection note'));
      await assert.rejects(act(action(lot, 'recover', 1, 1, available), employee), /Access denied|permission/i);
      await assert.rejects(act(action(lot, 'recover', 1, 3, available)), /changed/i); await act(action(lot, 'recover', 1, 1, available));
      assert.equal((await overview(product)).available, 34); assert.equal((await overview(product)).damaged, 2);
      lot = (await lots(product)).find((row: any) => row.locationId === quarantine2); await act(action(lot, 'write-off', 1, 2)); assert.equal((await overview(product)).totalPhysical, 35);
      await assert.rejects(act({ ...action(lot, 'write-off', 1, 1), notes: '' }), /reason|notes/i);
      await assert.rejects(act(action(lot, 'transfer', 1, 1, available))); await assert.rejects(act(action(lot, 'recover', 1, 1, damaged)));
    });
    await t.test('material service returns restore the actual component by service-unit count; unknown costs stay NULL', async () => {
      const product = await fixture(36, false), sold = await sale(product, 2, 2); assert.equal((await overview(product)).available, 32);
      const result = await returned(returnBody(sold, 'Damaged')); assert.equal(result.material.productId, product); assert.equal(result.material.quantity, 2);
      assert.equal((await overview(product)).available, 32); assert.equal((await overview(product)).damaged, 2); assert.equal((await lots(product))[0].materialItemId, sold.lines[0].id);
      await returned(returnBody(sold, 'Sellable Stock')); assert.equal((await overview(product)).available, 34); await assert.rejects(returned(returnBody(sold, 'Sellable Stock')));
      assert.equal((await db!.query('select purchase_cost from public.sale_item_financials where item_id=$1', [sold.lines[0].id])).rows[0].purchase_cost, null);
      assert.equal((await actor(owner, 'select public.get_profit_summary($1) value', [store])).available, false);
    });
    await t.test('void restores physical material to original available boxes exactly once and refund failure rolls back', async () => {
      const product = await fixture(), sold = await sale(product, 2, 2); const body = { idempotencyKey: randomUUID(), saleId: sold.id, reason: 'Cancelled service', manualRefundConfirmed: true };
      await assert.rejects(actor(owner, 'select public.void_sale($1,$2) value', [store, { ...body, manualRefundConfirmed: false }])); assert.equal((await overview(product)).available, 32);
      const result = await actor(owner, 'select public.void_sale($1,$2) value', [store, body]); assert.equal(result.status, 'Voided'); assert.equal((await overview(product)).available, 36); assert.deepEqual(await actor(owner, 'select public.void_sale($1,$2) value', [store, body]), result); assert.equal((await overview(product)).available, 36);
    });
    await t.test('notes/photo references stay private scoped evidence and cannot spoof foreign stock or cost metadata', async () => {
      const product = await fixture(), sold = await sale(product); await returned(returnBody(sold, 'Damaged')); const lot = (await lots(product))[0];
      const photo = randomUUID(), image = store + '/damage/' + photo + '.webp'; await db!.query("insert into app_private.media(id,store_id,profile_id,uploaded_by,kind,path,mime_type,size) values($1,$2,$3,$3,'damage',$4,'image/webp',100)", [photo, store, owner, image]);
      const note = { ...action(lot, 'note', 0, 1), photos: [image], notes: 'Before inspection' }; await act(note); assert((await lots(product))[0].photos.includes(image)); assert.equal((await db!.query('select app_private.media_referenced($1) value', [photo])).rows[0].value, true);
      await assert.rejects(db!.query('update app_private.media set entity_id=$1 where id=$2', [randomUUID(), photo]), /evidence.*reassigned/i);
      await assert.rejects(db!.query('update app_private.media set deleted_at=now() where id=$1', [photo]), /evidence.*deleted/i);
      for (const photos of [['https://example.com/photo.webp'], [foreignStore + '/damage/' + randomUUID() + '.webp'], [image, image]]) await assert.rejects(act({ ...note, idempotencyKey: randomUUID(), photos }));
      await assert.rejects(act({ ...note, idempotencyKey: randomUUID(), purchaseCost: 0 })); await assert.rejects(act({ ...note, idempotencyKey: randomUUID(), lotId: randomUUID() }));
      await assert.rejects(actor(employee, 'select * from private.condition_movements')); assert.equal((await db!.query("select bool_and(relrowsecurity) enabled from pg_class where oid in ('private.condition_movements'::regclass,'private.damaged_lots'::regclass)")).rows[0].enabled, true);
    });
    await t.test('separate connection damaged mutations serialize expected balances and cannot race negative', async () => {
      const product = await fixture(), sold = await sale(product); await returned(returnBody(sold, 'Damaged')); const lot = (await lots(product))[0];
      const run = async (body: unknown) => { const client = new pg.Client({ connectionString: url.toString() }); await client.connect(); try { await client.query('begin'); await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [owner]); await client.query('set local role authenticated'); const result = (await client.query('select public.damaged_inventory_action($1,$2) value', [store, body])).rows[0].value; await client.query('commit'); return result; } catch (error) { await client.query('rollback'); throw error; } finally { await client.end(); } };
      const results = await Promise.allSettled([run(action(lot, 'recover', 1, 1, available)), run(action(lot, 'write-off', 1, 1))]); assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(results.filter(r => r.status === 'rejected').length, 1); assert.equal((await overview(product)).damaged, 0);
    });
    await t.test('out-for-test units retain separate physical totals and historical damaged records remain explicitly unlocated', async () => {
      const product = await fixture(), customer = randomUUID(); await db!.query("insert into public.customers(id,store_id,name,type) values($1,$2,'Ledger Fixture','Individual')", [customer, store]);
      const today = new Date().toISOString().slice(0, 10); await actor(owner, 'select public.save_test_out($1,$2) value', [store, { idempotencyKey: randomUUID(), productId: product, locationId: available, customerId: customer, quantity: 2, takenDate: today, dueDate: today }]);
      assert.deepEqual(await overview(product), { productId: product, available: 34, damaged: 0, outForTest: 2, totalPhysical: 36 });
      await assert.rejects(actor(owner, 'select public.save_test_out($1,$2) value', [store, { idempotencyKey: randomUUID(), productId: product, locationId: damaged, customerId: customer, quantity: 1, takenDate: today, dueDate: today }]));
      const sold = await sale(product), historical = randomUUID(); await db!.query("insert into public.returns(id,store_id,code,sale_id,item_id,quantity,reason,destination,amount,credit_reduction,manual_refund,employee_id) values($1,$2,$3,$4,$5,1,'Historical unlocated panel','Damaged',1750,0,1750,$6)", [historical, store, 'HIST-' + historical, sold.id, sold.lines[0].id, owner]);
      const row = (await lots(product))[0]; assert.equal(row.id, historical); assert.equal(row.locationId, ''); assert.equal(row.historical, true); assert.equal(row.quantityUnknown, true); assert.equal(row.quantity, 0); assert.equal(row.returnedQuantity, 1);
      assert.equal((await overview(product)).damaged, 0); await assert.rejects(act(action(row, 'write-off', 1, 1)), /historical/i);
    });
    await t.test('multi-box material returns restore correct component counts and foreign/inactive destinations reject', async () => {
      const product = await fixture(), extraBox = randomUUID(); await actor(owner, 'select public.save_location($1,$2) value', [store, { id: extraBox, kind: 'box', parent_id: shelf, name: 'Other available', stockCondition: 'Available' }]);
      await db!.query("insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,actor_profile_id) values($1,$2,$3,4,'RECEIVE',$4)", [store, product, extraBox, owner]);
      const body = { idempotencyKey: randomUUID(), cartId: randomUUID(), lines: [{ productId: 'custom:' + randomUUID(), quantity: 2, unitPrice: 1750, reason: 'Negotiated combined material charge', customService: { name: 'Two-location part fitting', sellingPrice: 1750, minimumSellingPrice: 0, material: { productId: product, quantity: 2, allocations: [{ locationId: available, quantity: 1 }, { locationId: extraBox, quantity: 1 }] } } }], payments: [{ methodId: cash, amount: 3500 }], cashReceived: 3500 };
      const sold = await actor(owner, 'select public.complete_sale($1,$2) value', [store, body]); await returned(returnBody(sold, 'Damaged')); assert.equal((await overview(product)).damaged, 2); assert.equal((await lots(product)).length, 2);
      await returned(returnBody(sold, 'Sellable Stock')); assert.equal((await overview(product)).available, 38); assert.equal((await overview(product)).totalPhysical, 40);
      const lot = (await lots(product))[0]; await assert.rejects(act(action(lot, 'transfer', 1, 1, randomUUID())));
      await db!.query('update public.locations set active=false where id=$1', [quarantine2]); await assert.rejects(act(action(lot, 'transfer', 1, 1, quarantine2))); await db!.query('update public.locations set active=true where id=$1', [quarantine2]);
      await assert.rejects(actor(employee, 'select public.damaged_inventory($1,$2) value', [foreignStore, product]), /Access denied/i);
      await assert.rejects(actor(employee, 'select public.damaged_inventory_action($1,$2) value', [foreignStore, action(lot, 'transfer', 1, 1, quarantine2)]), /Access denied/i);
    });
    await t.test('recovered damaged used devices become sellable again without changing cost snapshots', async () => {
      const product = await fixture(1); await db!.query("insert into public.purchased_devices(product_id,store_id,status) values($1,$2,'In Stock')", [product, store]);
      const sold = await sale(product); await returned(returnBody(sold, 'Damaged')); const lot = (await lots(product))[0]; await act(action(lot, 'recover', 1, 1, available));
      assert.equal((await db!.query('select status from public.purchased_devices where product_id=$1', [product])).rows[0].status, 'In Stock'); await sale(product); assert.equal((await overview(product)).available, 0);
    });
    await t.test('real HTTP damaged reads/actions/returns and attached photos enforce runtime permissions and branch isolation', async () => {
      const runtime = new URL(url), role = 'taha_damage_' + Date.now() + '_' + Math.floor(Math.random() * 100000); runtime.username = role; runtime.password = randomUUID(); await runtimeRole(db!, runtime.toString());
      const password = 'Stage2 fixture password 2026!', hash = await hashPassword(password);
      for (const profile of [owner, employee]) await db!.query('insert into app_private.accounts(user_id,email,password_hash) values($1,$2,$3)', [profile, profile + '@test.local', hash]);
      process.env.DATABASE_URL = runtime.toString(); process.env.JWT_SECRET = 'stage2-fixture-only-secret-more-than-thirty-two-bytes'; process.env.NODE_ENV = 'test'; process.env.PORT = '0'; process.env.FRONTEND_ORIGIN = 'http://localhost:5173'; process.env.STORAGE_ROOT = await mkdtemp(path.join(os.tmpdir(), 'taha-damaged-'));
      let app: INestApplication | undefined;
      try {
        const { createApp } = await import('../src/main'); app = await createApp(); await app.listen(0, '127.0.0.1'); const base = await app.getUrl();
        const request = async (route: string, method = 'GET', body?: unknown, token?: string) => {
          const response = await fetch(base + '/api/v1' + route, { method, headers: { Origin: 'http://localhost:5173', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
          return { status: response.status, value: await response.json() as any };
        };
        const ownerToken = (await request('/auth/login', 'POST', { email: owner + '@test.local', password })).value.accessToken as string;
        const employeeToken = (await request('/auth/login', 'POST', { email: employee + '@test.local', password })).value.accessToken as string;
        const product = await fixture(), sold = await sale(product);
        const image = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#ffc107' } }).png().toBuffer(); const form = new FormData(); form.set('kind', 'damage'); form.set('file', new Blob([image], { type: 'image/png' }), 'damage.png');
        const upload = await fetch(base + `/api/v1/stores/${store}/media`, { method: 'POST', headers: { Origin: 'http://localhost:5173', Authorization: 'Bearer ' + ownerToken }, body: form }); assert.equal(upload.status, 201); const photo = await upload.json() as any;
        const refund = await request(`/stores/${store}/returns`, 'POST', { ...returnBody(sold, 'Damaged'), photos: [photo.path] }, employeeToken); assert.equal(refund.status, 201, JSON.stringify(refund.value));
        const conditions = await request(`/stores/${store}/inventory/conditions?productId=${product}`, 'GET', undefined, employeeToken); assert.equal(conditions.status, 200); assert.equal(conditions.value[0].available, 35); assert.equal(conditions.value[0].damaged, 1);
        const damagedRows = await request(`/stores/${store}/inventory/damaged?productId=${product}`, 'GET', undefined, employeeToken); assert.equal(damagedRows.status, 200); const lot = damagedRows.value[0]; assert(lot.photos.includes(photo.path)); assert.equal(lot.employeeId, employee); assert(!JSON.stringify(damagedRows.value).includes('purchase_cost'));
        assert.equal((await request(`/stores/${store}/inventory/condition-locations?condition=Damaged`, 'GET', undefined, employeeToken)).value.length, 2);
        assert.equal((await request(`/stores/${store}/inventory/damaged/actions`, 'POST', action(lot, 'recover', 1, 1, available), employeeToken)).status, 403);
        assert.equal((await request(`/stores/${foreignStore}/inventory/damaged?productId=${product}`, 'GET', undefined, employeeToken)).status, 403);
        const metadata = await request(`/stores/${store}/media/${photo.id}`, 'PATCH', { entityId: randomUUID() }, ownerToken); assert.equal(metadata.status, 422, JSON.stringify(metadata.value));
        const deletion = await request(`/stores/${store}/media/${photo.id}`, 'DELETE', {}, ownerToken); assert.equal(deletion.status, 400);
        const body = action(lot, 'recover', 1, 1, available), recovered = await request(`/stores/${store}/inventory/damaged/actions`, 'POST', body, ownerToken); assert.equal(recovered.status, 201, JSON.stringify(recovered.value)); assert.equal((await overview(product)).available, 36);
        const retry = await request(`/stores/${store}/inventory/damaged/actions`, 'POST', body, ownerToken); assert.deepEqual(retry.value, recovered.value); assert.equal((await overview(product)).available, 36);
      } finally { await app?.close(); await db!.query('drop owned by "' + role + '"'); await admin.query('drop role "' + role + '"'); }
    });
  } finally { await db?.end(); await admin.query('drop database if exists ' + database); await admin.end(); }
});

