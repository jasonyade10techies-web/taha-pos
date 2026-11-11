import assert from 'node:assert/strict';
import { testDatabase } from './check-migrations.mjs';

const db = await testDatabase();
const id = (n) => `20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=id(1), manager=id(2), employee=id(3), inactive=id(4), terminal=id(5), outsider=id(6), terminal2=id(7);
const store='10000000-0000-4000-8000-000000000001', other='10000000-0000-4000-8000-000000000002';
const product=id(20), rack=id(30), shelf=id(31), box=id(32);
let checks=0;
async function check(label, action) { await action(); checks++; console.log(`PASS ${label}`); }
async function actor(uid, role='authenticated', token='') {
  await db.exec('RESET ROLE');
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false),set_config('request.headers',$3,false)`, [uid ?? '',role,JSON.stringify(token ? {'x-counter-session':token} : {})]);
  await db.exec(`SET ROLE ${role}`);
}
async function value(sql, params=[]) { return (await db.query(sql,params)).rows[0]?.result; }
async function denied(sql, params=[]) { await assert.rejects(db.query(sql,params), /denied|permission|eligible|delegation|counter|sign-in|Unsupported|administration|dedicated/i); }
async function grant(uid,key,branch=store,enabled=true) {
  await actor(owner); await db.query('SELECT public.set_employee_permission($1,$2,$3,$4)',[uid,branch,key,enabled]);
}
try {
  await db.exec(`INSERT INTO auth.users(id,email) VALUES ${[owner,manager,employee,inactive,terminal,outsider,terminal2].map((u,i)=>`('${u}','test${i}@example.invalid')`).join(',')};
    INSERT INTO public.profiles(id,full_name,email,role,status) VALUES
    ('${owner}','Ahmed Khan','owner@example.invalid','owner','active'),('${manager}','Manager','manager@example.invalid','manager','active'),
    ('${employee}','Hamza','employee@example.invalid','employee','active'),('${inactive}','Inactive','inactive@example.invalid','owner','inactive');
    INSERT INTO public.stores(id,name,branch_name) VALUES('${other}','Taha Mobiles','Test branch');
    INSERT INTO public.store_memberships(profile_id,store_id) VALUES('${owner}','${store}'),('${manager}','${store}'),('${employee}','${store}'),('${employee}','${other}');
    INSERT INTO public.products(id,store_id,name,category,selling_price,minimum_selling_price) VALUES('${product}','${store}','Test battery','Parts',2500,2200);
    INSERT INTO public.product_financials(product_id,store_id,purchase_cost) VALUES('${product}','${store}',1379);
    INSERT INTO public.locations(id,store_id,name,kind) VALUES('${rack}','${store}','Rack 12','rack');
    INSERT INTO public.locations(id,store_id,name,kind,parent_location_id) VALUES('${shelf}','${store}','Shelf B','shelf','${rack}'),('${box}','${store}','Box 04','box','${shelf}');
    INSERT INTO public.stock_movements(store_id,product_id,location_id,quantity,movement_type,actor_profile_id) VALUES
    ('${store}','${product}','${box}',12,'RECEIVE','${owner}'),('${store}','${product}','${box}',-2,'SALE','${employee}');`);
  await check('every business and private table has RLS', async () => {
    assert.equal(await value(`SELECT count(*)::int AS result FROM pg_tables t JOIN pg_class c ON c.relname=t.tablename JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname=t.schemaname WHERE t.schemaname IN ('public','private') AND NOT c.relrowsecurity`),0);
  });
  await check('automatic permanent codes and event-derived balance', async () => {
    assert.equal(await value('SELECT internal_code AS result FROM public.products WHERE id=$1',[product]),'TM-P-000001');
    assert.equal(Number(await value('SELECT quantity AS result FROM public.stock_balances WHERE product_id=$1',[product])),10);
    await assert.rejects(db.query('UPDATE public.products SET internal_code=$1 WHERE id=$2',['TM-P-999999',product]),/permanent|immutable/i);
    await assert.rejects(db.query('UPDATE public.locations SET internal_code=$1 WHERE id=$2',['TM-L-999999',box]),/permanent|immutable/i);
  });
  await check('location hierarchy and stock signs are constrained', async () => {
    await assert.rejects(db.query(`INSERT INTO public.locations(store_id,name,kind,parent_location_id) VALUES($1,'Invalid box','box',$2)`,[store,rack]),/parent|shelf/i);
    await assert.rejects(db.query(`INSERT INTO public.stock_movements(store_id,product_id,location_id,quantity,movement_type,actor_profile_id) VALUES($1,$2,$3,1,'SALE',$4)`,[store,product,box,employee]),/check constraint/i);
  });
  await check('movements and audit records are append-only', async () => {
    await assert.rejects(db.query('DELETE FROM public.stock_movements'),/append.only/i);
    await db.exec(`INSERT INTO public.audit_logs(store_id,action,entity_type) VALUES('${store}','test.event','test')`);
    await assert.rejects(db.query('DELETE FROM public.audit_logs'),/append.only/i);
  });
  await check('anonymous access and unprovisioned Auth users are denied', async () => {
    await actor(null,'anon'); await denied('SELECT * FROM public.products'); await denied('SELECT public.get_pos_products($1)',[store]);
    await actor(outsider); assert.equal(await value('SELECT public.current_profile_id() AS result'),null); assert.equal(await value('SELECT count(*)::int AS result FROM public.products'),0);
  });
  await check('manager role alone grants no product or financial access', async () => {
    await actor(manager); assert.equal(await value('SELECT public.has_permission($1,$2) AS result',['sales.create',store]),false);
    assert.equal(await value('SELECT count(*)::int AS result FROM public.product_financials'),0); await denied('SELECT public.get_pos_products($1)',[store]);
  });
  await check('employee grants permit safe POS data without protected values', async () => {
    await grant(employee,'sales.create'); await actor(employee);
    const products = await value('SELECT public.get_pos_products($1) AS result',[store]); assert.equal(products.length,1); assert.equal(products[0].quantity,10);
    assert.deepEqual(products[0].location,{rack:'Rack 12',shelf:'Shelf B',box:'Box 04'});
    assert.doesNotMatch(JSON.stringify(products),/purchase_cost|1379|profit|supplier|valuation|margin/);
    assert.equal(await value('SELECT count(*)::int AS result FROM public.product_financials'),0);
    await denied('SELECT public.get_product_financials($1)',[store]); await denied('SELECT public.get_profit_summary($1)',[store]);
  });
  await check('permissions are scoped to their branch', async () => {
    await actor(employee); await denied('SELECT public.get_pos_products($1)',[other]);
    assert.equal(await value('SELECT public.has_permission($1,$2) AS result',['sales.create',other]),false);
  });
  await check('cost and profit permissions are independent and can be revoked', async () => {
    await grant(employee,'costs.view_purchase_cost'); await actor(employee);
    assert.equal((await value('SELECT public.get_product_financials($1) AS result',[store]))[0].purchase_cost,1379);
    await denied('SELECT public.get_profit_summary($1)',[store]);
    await grant(employee,'costs.view_purchase_cost',store,false); await actor(employee); await denied('SELECT public.get_product_financials($1)',[store]);
  });
  await check('direct profile/permission/cost mutations cannot escalate access', async () => {
    await actor(employee); await denied(`UPDATE public.profiles SET role='owner' WHERE id=$1`,[employee]);
    await denied('UPDATE public.employee_permissions SET enabled=true'); await denied('UPDATE public.product_financials SET purchase_cost=0');
    await denied('SELECT public.provision_profile($1,$2,$3,$4)',[outsider,'Forged owner','owner',store]);
  });
  await check('owner has all known permissions and active-store reads', async () => {
    await actor(owner); assert.equal(await value('SELECT count(*)::int AS result FROM public.permissions WHERE public.has_permission(key,$1)',[store]),31);
    assert.equal(await value('SELECT count(*)::int AS result FROM public.product_financials'),1);
    assert.equal(await value('SELECT public.has_permission($1,$2) AS result',['inventory.view',other]),true);
  });
  await check('trusted provisioning preserves identity and account boundaries', async () => {
    await actor(owner); await db.query('SELECT public.provision_profile($1,$2,$3,$4)',[outsider,'Ali','employee',store]);
    await actor(outsider); const context=await value('SELECT public.get_session_context() AS result'); assert.equal(context.profile.role,'employee'); assert.equal(context.permissions.length,0);
    await db.query('SELECT public.update_my_profile($1,$2)',['Ali Updated','03000000000']);
    assert.equal((await value('SELECT public.get_session_context() AS result')).profile.full_name,'Ali Updated');
  });
  await check('delegation denies self escalation, owner changes and unheld grants', async () => {
    await grant(manager,'employees.permissions'); await grant(manager,'sales.view'); await actor(manager);
    await denied('SELECT public.set_employee_permission($1,$2,$3,true)',[manager,store,'sales.view']);
    await denied('SELECT public.set_employee_permission($1,$2,$3,true)',[owner,store,'sales.view']);
    await denied('SELECT public.set_employee_permission($1,$2,$3,true)',[employee,store,'profit.view']);
    await db.query('SELECT public.set_employee_permission($1,$2,$3,true)',[employee,store,'sales.view']);
  });
  await check('inactive profiles and disabled memberships lose access', async () => {
    await actor(inactive); assert.equal(await value('SELECT public.is_owner() AS result'),false);
    await db.exec('RESET ROLE'); await db.query('UPDATE public.store_memberships SET active=false WHERE profile_id=$1 AND store_id=$2',[employee,store]);
    await actor(employee); await denied('SELECT public.get_pos_products($1)',[store]);
    await db.exec('RESET ROLE'); await db.query('UPDATE public.store_memberships SET active=true WHERE profile_id=$1 AND store_id=$2',[employee,store]);
  });
  await check('terminal accounts are dedicated and PIN hashes stay private', async () => {
    await actor(owner); await denied('SELECT public.register_counter_terminal($1,$2,$3)',[owner,store,'Invalid']);
    await db.query('SELECT public.register_counter_terminal($1,$2,$3)',[terminal,store,'Counter 1']);
    await db.query('SELECT public.register_counter_terminal($1,$2,$3)',[terminal2,store,'Counter 2']);
    await assert.rejects(db.query('SELECT public.set_employee_pin($1,$2,$3)',[employee,store,'123456']), /non-demo|not permitted|Invalid PIN/i);
    await db.query('SELECT public.set_employee_pin($1,$2,$3)',[employee,store,'739182']);
    await db.exec('RESET ROLE'); const hash = await value('SELECT pin_hash AS result FROM private.employee_pin_credentials WHERE profile_id=$1',[employee]);
    assert.match(hash,/^\$2[abxy]\$12\$/); assert.notEqual(hash,'739182');
    await actor(employee); await denied('SELECT * FROM private.employee_pin_credentials'); await denied('SELECT public.list_counter_employees()');
  });
  await check('unlocked terminal requires secure PIN capability, never base-account privileges', async () => {
    await actor(terminal); const context=await value('SELECT public.get_session_context() AS result'); assert.equal(context.terminal,true); assert.equal(context.profile,null);
    await denied('SELECT public.get_pos_products($1)',[store]);
    const cards = await value('SELECT public.list_counter_employees() AS result'); assert.equal(cards[0].full_name,'Hamza'); assert.doesNotMatch(JSON.stringify(cards),/pin|hash|739182/);
    const result=await value('SELECT public.verify_counter_pin($1,$2) AS result',[employee,'739182']); assert.equal(result.ok,true); assert.match(result.token,/^[a-f0-9]{64}$/);
    await actor(terminal,'authenticated',result.token); assert.equal(await value('SELECT public.current_profile_id() AS result'),employee);
    assert.equal((await value('SELECT public.get_pos_products($1) AS result',[store])).length,1); await denied('SELECT public.get_product_financials($1)',[store]);
    await denied('SELECT public.set_employee_permission($1,$2,$3,true)',[employee,store,'profit.view']);
    await actor(terminal2,'authenticated',result.token); assert.equal(await value('SELECT public.current_profile_id() AS result'),null);
    await actor(terminal,'authenticated',result.token); await db.query('SELECT public.lock_counter_session()'); assert.equal(await value('SELECT public.current_profile_id() AS result'),null);
  });
  await check('expired, forged, and replaced PIN capabilities are rejected', async () => {
    await actor(terminal,'authenticated','f'.repeat(64)); assert.equal(await value('SELECT public.current_profile_id() AS result'),null);
    await actor(terminal); const first=await value('SELECT public.verify_counter_pin($1,$2) AS result',[employee,'739182']);
    const second=await value('SELECT public.verify_counter_pin($1,$2) AS result',[employee,'739182']);
    await actor(terminal,'authenticated',first.token); assert.equal(await value('SELECT public.current_profile_id() AS result'),null);
    await db.exec('RESET ROLE'); await db.query(`UPDATE private.counter_sessions SET expires_at=now()-interval '1 second' WHERE id=$1`,[second.session_id]);
    await actor(terminal,'authenticated',second.token); assert.equal(await value('SELECT public.current_profile_id() AS result'),null);
  });
  await check('owner PIN grants business access but cannot provision management identities', async () => {
    await actor(owner); await db.query('SELECT public.set_employee_pin($1,$2,$3)',[owner,store,'846291']);
    await actor(terminal2); const result=await value('SELECT public.verify_counter_pin($1,$2) AS result',[owner,'846291']);
    await actor(terminal2,'authenticated',result.token); assert.equal(await value('SELECT public.is_owner() AS result'),true);
    await denied('SELECT public.provision_profile($1,$2,$3,$4)',[outsider,'Ali','owner',store]);
    await denied('SELECT public.register_counter_terminal($1,$2,$3)',[outsider,store,'Invalid']);
    await denied('SELECT public.set_employee_permission($1,$2,$3,true)',[employee,store,'profit.view']);
    await db.query('SELECT public.lock_counter_session()');
  });
  await check('failed PIN attempts commit and lock the terminal after five failures', async () => {
    await actor(terminal);
    for (let i=0;i<5;i++) assert.equal((await value('SELECT public.verify_counter_pin($1,$2) AS result',[employee,'111111'])).ok,false);
    const locked=await value('SELECT public.verify_counter_pin($1,$2) AS result',[employee,'739182']); assert.equal(locked.ok,false); assert.ok(locked.retry_after>0);
    await db.exec('RESET ROLE'); assert.equal(await value('SELECT failures AS result FROM private.counter_pin_attempts WHERE terminal_id=(SELECT id FROM public.counter_terminals WHERE auth_user_id=$1)',[terminal]),5);
    assert.doesNotMatch(JSON.stringify((await db.query('SELECT metadata FROM public.audit_logs')).rows),/739182|111111|pin_hash|token_hash/);
  });
  await check('client audit helper uses server actor and an event allowlist', async () => {
    await actor(employee); await db.query('SELECT public.log_client_event($1,$2)',['client.session_started','0.2.0']);
    await denied('SELECT public.log_client_event($1,$2)',['sale.voided','forged']);
    const log=(await db.query(`SELECT actor_profile_id,metadata FROM public.audit_logs WHERE action='client.session_started'`)).rows;
    assert.equal(log.length,0); // No audit.view permission, even for the actor.
    await actor(owner); assert.equal(await value(`SELECT actor_profile_id AS result FROM public.audit_logs WHERE action='client.session_started'`),employee);
  });
  console.log(`${checks} PostgreSQL security/constraint checks passed. Auth claims are test fixtures; this is not hosted Supabase authentication.`);
} catch (error) { console.error('Security check failed:', error.message, error.detail ?? '', error.where ?? ''); process.exitCode=1; }
finally { await db.close(); }
