import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { closingInput, repairInput, serviceInput, shiftInput, workflowId } from '../src/workflows/validation';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { migrate } from '../scripts/migrate';

const id = 'a0000000-0000-4000-8000-000000000001';
const shift = { id, employeeId: id, date: '2026-10-03', start: '09:00', end: '18:00', status: 'Open', openingCash: 10000, expectedCash: null, countedCash: null, difference: null, cashExpenses: 0 };
const repair = { id, customerId: '', customerName: 'Walk-in Customer', device: 'iPhone 13', problem: 'Screen flickers', technicianId: '', estimate: 3600, advance: 0, status: 'Received', photos: [] };

test('client cannot write financial closing history through general shift save', () => {
  assert.equal(shiftInput(shift).openingCash, 10000);
  for (const extra of [{ expectedCash: 999 }, { countedCash: 999 }, { difference: 1 }, { closedAt: '2026-10-03T01:00:00Z' }, { cashExpenses: 1 }, { status: 'Closed' }, { storeId: id }]) {
    assert.throws(() => shiftInput({ ...shift, ...extra }), BadRequestException);
  }
});
test('shift date validation rejects normalized calendar errors without internal exceptions', () => {
  for (const date of ['2026-02-30', '2026-99-03', '2026-1-1']) assert.throws(() => shiftInput({ ...shift, date }), BadRequestException);
  assert.throws(() => shiftInput({ ...shift, end: '08:00' }), BadRequestException);
  assert.throws(() => shiftInput({ ...shift, start: '24:00' }), BadRequestException);
});
test('cash reconciliation requires finite precise money and accepts only closing inputs', () => {
  assert.deepEqual(closingInput({ counted: 100.5, expenses: 0, notes: '  Counted twice  ' }), { counted: 100.5, expenses: 0, notes: 'Counted twice' });
  for (const counted of [NaN, Infinity, -1, 1.001, '100']) assert.throws(() => closingInput({ counted }), BadRequestException);
  assert.throws(() => closingInput({ counted: 10, expected: 10 }), BadRequestException);
});
test('repair intake cannot invent deposits or accept arbitrary sensitive JSON', () => {
  assert.equal(repairInput(repair).advance, 0);
  assert.throws(() => repairInput({ ...repair, advance: 2000 }), /unverified advance/);
  assert.throws(() => repairInput({ ...repair, purchaseCost: 500 }), BadRequestException);
  assert.throws(() => repairInput({ ...repair, status: 'Completed' }), BadRequestException);
  assert.throws(() => repairInput({ ...repair, technicianId: 'owner' }), BadRequestException);
});
test('repair photos must be private uploaded references, never external URLs or data URLs', () => {
  const path = id + '/repair/' + id + '.webp';
  assert.deepEqual(repairInput({ ...repair, photos: [path] }).photos, [path]);
  for (const photo of ['https://example.com/private.jpg', 'data:image/png;base64,AAAA', '../secrets.webp', id + '/proof/' + id + '.webp']) assert.throws(() => repairInput({ ...repair, photos: [photo] }), BadRequestException);
  assert.throws(() => repairInput({ ...repair, photos: [path, path] }), /selected twice/);
});
test('repair photo categories align with photos and permit only explicit intake labels', () => {
  const path = id + '/repair/' + id + '.webp';
  assert.equal('photoCategories' in repairInput({ ...repair, photos: [path] }), false);
  for (const label of ['Before', 'After', 'Damage', 'Customer-provided']) {
    assert.deepEqual(repairInput({ ...repair, photos: [path], photoCategories: [label] }).photoCategories, [label]);
  }
  for (const categories of [[], ['Before', 'After'], ['Secret'], [123], null]) assert.throws(() => repairInput({ ...repair, photos: [path], photoCategories: categories }), BadRequestException);
});
test('service catalog cannot store costs and minimum price cannot exceed sale price', () => {
  const value = { id, name: ' Screen fitting ', category: 'Repairs', sellingPrice: 1000, minimumSellingPrice: 800, active: true, notes: '' };
  assert.equal(serviceInput(value).name, 'Screen fitting');
  assert.throws(() => serviceInput({ ...value, purchaseCost: 200 }), BadRequestException);
  assert.throws(() => serviceInput({ ...value, minimumSellingPrice: 1001 }), BadRequestException);
  assert.throws(() => serviceInput({ ...value, active: 'true' }), BadRequestException);
});
test('record identifiers cannot inject SQL or substitute a cross-domain string', () => {
  assert.equal(workflowId(id), id);
  assert.equal(workflowId('', true), null);
  for (const value of [null, [], '1); DROP TABLE profiles', 'abc']) assert.throws(() => workflowId(value), BadRequestException);
});

// Windows database creation/deletion can be slow; assertion behavior is unchanged.
test('PostgreSQL repair permissions, catalog identity and cash closing remain authoritative', { timeout: 300000 }, async t => {
  const url = new URL(process.env.TAHA_TEST_POSTGRES_URL ?? 'postgresql://taha_test@127.0.0.1:55439/postgres');
  assert(['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname === '/postgres', 'Use the isolated local PostgreSQL fixture only.');
  const admin = new pg.Client({ connectionString: url.toString() });
  const databaseName = 'taha_workflows_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
  await admin.connect();
  let db: pg.Client | undefined;
  try {
    await admin.query('create database ' + databaseName);
    url.pathname = '/' + databaseName;
    db = new pg.Client({ connectionString: url.toString() });
    await db.connect();
    await migrate(db);
    const store = '10000000-0000-4000-8000-000000000001', owner = randomUUID(), employee = randomUUID(), otherStore = randomUUID(), foreignTechnician = randomUUID();
    await db.query("insert into public.stores(id,name,branch_name) values($1,'Taha Mobiles','Other Test Branch')", [otherStore]);
    for (const [profile, role, branch] of [[owner, 'owner', store], [employee, 'employee', store], [foreignTechnician, 'employee', otherStore]]) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [profile, profile + '@taha.test']);
      await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,$2,'Workflow Test',$3,'active')", [profile, profile + '@taha.test', role]);
      await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)', [profile, branch]);
    }
    const asActor = async (actor: string, sql: string, args: unknown[] = []) => {
      await db!.query('BEGIN');
      try {
        await db!.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [actor]);
        await db!.query('SET LOCAL ROLE authenticated');
        const result = await db!.query(sql, args);
        await db!.query('COMMIT');
        return result;
      } catch (error) { await db!.query('ROLLBACK'); throw error; }
    };
    await t.test('service catalog rows remain sellable and never move inventory', async () => {
      const serviceId = randomUUID();
      await assert.rejects(asActor(employee, 'select public.save_repair_service($1,$2)', [store, { ...serviceInput({ name: 'Screen fitting', category: 'Repairs', sellingPrice: 1000, minimumSellingPrice: 1000 }), id: serviceId }]), (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === '42501'));
      await asActor(owner, 'select public.save_repair_service($1,$2)', [store, { ...serviceInput({ name: 'Screen fitting', category: 'Repairs', sellingPrice: 1000, minimumSellingPrice: 1000 }), id: serviceId }]);
      const catalog = (await asActor(owner, 'select public.get_pos_products($1) value', [store])).rows[0].value;
      assert(catalog.some((p: { id: string }) => p.id === serviceId));
      const cash = (await db!.query("select id from public.payment_methods where store_id=$1 and kind='Cash' limit 1", [store])).rows[0].id;
      const result = (await asActor(owner, 'select public.complete_sale($1,$2) value', [store, { idempotencyKey: randomUUID(), cartId: randomUUID(), lines: [{ productId: serviceId, quantity: 1, unitPrice: 1000 }], payments: [{ methodId: cash, amount: 1000 }], cashReceived: 1000 }])).rows[0].value;
      assert.equal(result.lines[0].service, true);
      assert.deepEqual(result.lines[0].stockAllocations, []);
      assert.equal((await db!.query('select count(*)::int n from public.stock_movements where product_id=$1', [serviceId])).rows[0].n, 0);
      await db!.query('update public.product_financials set purchase_cost=50 where product_id=$1', [serviceId]);
      await asActor(owner, 'select public.save_repair_service($1,$2)', [store, { id: serviceId, name: 'Screen fitting updated', category: 'Repairs', sellingPrice: 1200, minimumSellingPrice: 1200, active: true, notes: '' }]);
      assert.equal(Number((await db!.query('select purchase_cost from public.product_financials where product_id=$1', [serviceId])).rows[0].purchase_cost), 50);
      const physicalId = randomUUID();
      await db!.query("insert into public.products(id,store_id,name,category,selling_price,minimum_selling_price) values($1,$2,'Battery','Parts',1000,900)", [physicalId, store]);
      await assert.rejects(asActor(owner, 'select public.save_repair_service($1,$2)', [store, { id: physicalId, name: 'Hijack', category: 'Repairs', sellingPrice: 1, minimumSellingPrice: 1 }]), /another catalog item/);
    });
    await t.test('repair intake denies unauthorized writes, cross-branch technicians and unverified advances', async () => {
      await assert.rejects(asActor(employee, 'select public.repair_job_data($1)', [store]), /Access denied/);
      await assert.rejects(asActor(owner, 'select public.save_repair_job($1,$2)', [store, { ...repairInput(repair), id: randomUUID(), technicianId: foreignTechnician }]), /active technician/);
      await assert.rejects(asActor(owner, 'select public.save_repair_job($1,$2)', [store, { ...repairInput(repair), id: randomUUID(), advance: 2000 }]), /Record repair payments/);
      const created = (await asActor(owner, 'select public.save_repair_job($1,$2) value', [store, { ...repairInput(repair), id: randomUUID(), technicianId: employee }])).rows[0].value;
      assert.equal(created.status, 'Received'); assert.equal(created.advance, 0); assert.match(created.code, /^TM-REP-/);
      await assert.rejects(asActor(owner, 'select public.save_repair_job($1,$2)', [store, { ...repairInput(created), status: 'Delivered' }]), /status change/);
      await assert.rejects(asActor(owner, 'select public.save_repair_job($1,$2)', [store, { ...repairInput(created), photos: [store + '/repair/' + randomUUID() + '.webp'], photoCategories: ['Before'] }]), /photos uploaded/);
    });
    await t.test('private repair photos preserve category order and reject mismatched or arbitrary labels', async () => {
      const mediaId = randomUUID(), photo = store + '/repair/' + mediaId + '.webp';
      await db!.query("insert into app_private.media(id,store_id,profile_id,uploaded_by,kind,path,mime_type,size) values($1,$2,$3,$3,'repair',$4,'image/webp',100)", [mediaId, store, owner, photo]);
      const legacy = (await asActor(owner, 'select public.save_repair_job($1,$2) value', [store, { ...repairInput(repair), id: randomUUID(), photos: [photo] }])).rows[0].value;
      assert.deepEqual(legacy.photoCategories, []);
      const body = repairInput({ ...legacy, photoCategories: ['Before'] });
      const saved = (await asActor(owner, 'select public.save_repair_job($1,$2) value', [store, body])).rows[0].value;
      assert.deepEqual(saved.photoCategories, ['Before']); assert.deepEqual(saved.photos, [photo]);
      const read = (await asActor(owner, 'select public.repair_job_data($1,$2) value', [store, saved.id])).rows[0].value;
      assert.deepEqual(read.photoCategories, ['Before']);
      for (const categories of [[], ['Before', 'After'], ['Secret']]) await assert.rejects(asActor(owner, 'select public.save_repair_job($1,$2)', [store, { ...body, photoCategories: categories }]), /photo categor/i);
    });
    await t.test('cash closing counts actual money events once and freezes reconciled history', async () => {
      const shiftId = randomUUID();
      await asActor(owner, 'select public.save_shift($1,$2)', [store, { ...shiftInput(shift), id: shiftId, employeeId: employee, openingCash: 1000 }]);
      await db!.query("update public.shifts set actual_start=now()-interval '1 hour' where id=$1", [shiftId]);
      const method = (await db!.query("select id from public.payment_methods where store_id=$1 and kind='Cash' limit 1", [store])).rows[0].id;
      const events = [['sale', 'Reversed', 1500, 'Cash'], ['collection', 'Confirmed', 200, 'Cash'], ['refund', 'Confirmed', 300, 'Cash'], ['reversal', 'Confirmed', 1500, 'Cash'], ['sale', 'Pending', 9999, 'Cash'], ['sale', 'Rejected', 8888, 'Cash'], ['sale', 'Confirmed', 777, 'Digital']];
      for (const [kind, status, amount, methodKind] of events) await db!.query("insert into public.payments(store_id,code,method_id,amount,kind,status,method_name,method_kind,employee_id,created_at) values($1,$2,$3,$4,$5,$6,'Test Cash',$7,$8,now()-interval '10 minutes')", [store, 'TM-WF-' + randomUUID(), method, amount, kind, status, methodKind, employee]);
      const flow = (await asActor(owner, 'select public.shift_closing($1,$2) value', [store, shiftId])).rows[0].value;
      assert.deepEqual(flow, { cashSales: 1500, collections: 200, refunds: 300, reversals: 1500, purchases: 0, expected: 900 });
      await assert.rejects(asActor(owner, 'select public.close_shift($1,$2,$3)', [store, shiftId, { counted: 500, expenses: 100, notes: '' }]), /Explain the cash difference/);
      const closeBody = { counted: 800, expenses: 100, notes: '' };
      const closed = (await asActor(owner, 'select public.close_shift($1,$2,$3) value', [store, shiftId, closeBody])).rows[0].value;
      assert.equal(closed.status, 'Closed'); assert.equal(closed.expectedCash, 800); assert.equal(closed.difference, 0);
      await asActor(owner, 'select public.close_shift($1,$2,$3)', [store, shiftId, closeBody]);
      assert.equal((await db!.query("select count(*)::int n from public.audit_logs where entity_id=$1 and action='shift.closed'", [shiftId])).rows[0].n, 1);
      await assert.rejects(asActor(owner, 'select public.close_shift($1,$2,$3)', [store, shiftId, { counted: 801, expenses: 100, notes: 'Rewrite' }]), /history cannot be changed/);
      await assert.rejects(db!.query('update public.shifts set expected_cash=500 where id=$1', [shiftId]), /history cannot be changed/);
      await assert.rejects(db!.query('delete from public.audit_logs where entity_id=$1', [shiftId]), /append-only/);
    });
    await t.test('later-shift reversals subtract cash without importing earlier receipts', async () => {
      const shiftId = randomUUID();
      await db!.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)', [foreignTechnician, store]);
      await asActor(owner, 'select public.save_shift($1,$2)', [store, { ...shiftInput(shift), id: shiftId, employeeId: foreignTechnician, openingCash: 1000 }]);
      await db!.query("update public.shifts set actual_start=now()-interval '5 minutes' where id=$1", [shiftId]);
      const method = (await db!.query("select id from public.payment_methods where store_id=$1 and kind='Cash' limit 1", [store])).rows[0].id;
      for (const [kind, status, time] of [['sale', 'Reversed', '1 hour'], ['reversal', 'Confirmed', '1 minute']]) await db!.query("insert into public.payments(store_id,code,method_id,amount,kind,status,method_name,method_kind,employee_id,created_at) values($1,$2,$3,500,$4,$5,'Cash','Cash',$6,now()-$7::interval)", [store, 'TM-WF-' + randomUUID(), method, kind, status, foreignTechnician, time]);
      const flow = (await asActor(owner, 'select public.shift_closing($1,$2) value', [store, shiftId])).rows[0].value;
      assert.equal(flow.cashSales, 0); assert.equal(flow.reversals, 500); assert.equal(flow.expected, 500);
      await assert.rejects(asActor(owner, 'select public.save_shift($1,$2)', [store, { id: randomUUID(), employeeId: employee, status: 'Scheduled', openingCash: 0 }]), /date and times/);
    });
  } finally {
    await db?.end();
    await admin.query('drop database if exists ' + databaseName);
    await admin.end();
  }
});
