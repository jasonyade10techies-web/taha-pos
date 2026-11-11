import assert from "node:assert/strict";
import { testDatabase } from "./check-migrations.mjs";
const db = await testDatabase();
const store = "10000000-0000-4000-8000-000000000001";
const id = (n) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  employee = id(2),
  outsider = id(3);
let checks = 0;
async function actor(uid, role = "authenticated") {
  await db.exec("RESET ROLE");
  await db.query(
    `select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false),set_config('request.headers','{}',false)`,
    [uid ?? "", role],
  );
  await db.exec(`SET ROLE ${role}`);
}
const value = async (sql, args = []) =>
  (await db.query(sql, args)).rows[0]?.result;
const rpc = async (name, args) =>
  value(
    `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as result`,
    args,
  );
const check = async (label, fn) => {
  await fn();
  checks++;
  console.log("PASS " + label);
};
const rejected = async (
  name,
  args,
  pattern = /denied|permission|sign-in|administration/i,
) => assert.rejects(rpc(name, args), pattern);
let product, copy, rack, shelf, box, dest, supplier;
const payload = () => ({
  name: "Samsung Galaxy A15 Charging Board",
  category: "Parts",
  brand: "Samsung",
  compatible_model: "Galaxy A15",
  quality_grade: "Grade A",
  color_variant: "Black",
  selling_price: 1450,
  minimum_selling_price: 1300,
  aliases: ["a15 charging patti"],
  low_stock_level: 12,
  initial_quantity: 0,
  default_location_id: box?.id,
});
const receipt = (rid, lines) => ({
  id: rid,
  supplier_id: supplier.id,
  reference: "PHASE3A TEST",
  date: "2026-10-03",
  lines,
});
try {
  await db.exec(`insert into auth.users(id,email) values('${owner}','owner@example.invalid'),('${employee}','employee@example.invalid'),('${outsider}','outsider@example.invalid');
    insert into public.profiles(id,full_name,email,role,status) values('${owner}','Test Owner','owner@example.invalid','owner','active'),('${employee}','Hamza','employee@example.invalid','employee','active');
    insert into public.store_memberships(profile_id,store_id) values('${owner}','${store}'),('${employee}','${store}');`);
  await actor(owner);
  await check(
    "create Rack → Shelf → Box and a separate destination",
    async () => {
      rack = await rpc("save_location", [
        store,
        { id: id(10), name: "Rack 12", kind: "rack" },
      ]);
      shelf = await rpc("save_location", [
        store,
        { id: id(11), name: "Shelf B", kind: "shelf", parent_id: rack.id },
      ]);
      box = await rpc("save_location", [
        store,
        { id: id(12), name: "Box 04", kind: "box", parent_id: shelf.id },
      ]);
      dest = await rpc("save_location", [
        store,
        { id: id(13), name: "Box 05", kind: "box", parent_id: shelf.id },
      ]);
      assert.match(box.internal_code, /^TM-L-\d{6}$/);
      await rejected(
        "save_location",
        [
          store,
          { id: id(14), name: "Invalid", kind: "box", parent_id: rack.id },
        ],
        /shelf|hierarchy/i,
      );
      await rejected(
        "save_location",
        [
          store,
          {
            id: shelf.id,
            name: "Loop",
            kind: "shelf",
            parent_id: box.id,
            expected_updated_at: shelf.updated_at,
          },
        ],
        /permanent/i,
      );
    },
  );
  await check(
    "product create/edit/custom master values and immutable generated identity",
    async () => {
      product = await rpc("save_product", [
        store,
        { ...payload(), id: id(20), purchase_cost: 900 },
      ]);
      assert.equal(product.internal_code, "TM-P-000001");
      const code = product.internal_code;
      product = await rpc("save_product", [
        store,
        {
          ...payload(),
          id: product.id,
          expected_updated_at: product.updated_at,
          quality_grade: "Shop Premium",
        },
      ]);
      assert.equal(product.internal_code, code);
      assert.equal(
        await value(
          `select count(*)::int as result from public.catalog_values where value='Shop Premium'`,
        ),
        1,
      );
      await rejected(
        "save_product",
        [
          store,
          { ...payload(), id: product.id, expected_updated_at: "2000-01-01" },
        ],
        /changed/i,
      );
      assert.doesNotMatch(JSON.stringify(product), /purchase_cost|profit/);
    },
  );
  await check(
    "atomic receipt creates 10 units and protected latest cost",
    async () => {
      supplier = await rpc("save_supplier", [
        store,
        { id: id(30), name: "Test Supplier" },
      ]);
      await rpc("save_stock_receipt", [
        store,
        receipt(id(40), [
          {
            product_id: product.id,
            location_id: box.id,
            quantity: 10,
            purchase_cost: 925,
          },
        ]),
        true,
      ]);
      assert.equal(
        Number(
          await value(
            "select quantity as result from public.stock_balances where product_id=$1 and location_id=$2",
            [product.id, box.id],
          ),
        ),
        10,
      );
      assert.equal((await rpc("get_pos_products", [store]))[0].quantity, 10);
      assert.equal(
        (await rpc("get_product_financials", [store]))[0].purchase_cost,
        925,
      );
      await rejected(
        "save_stock_receipt",
        [
          store,
          receipt(id(40), [
            { product_id: product.id, location_id: box.id, quantity: 10 },
          ]),
          true,
        ],
        /already/i,
      );
    },
  );
  await check(
    "invalid second receipt line rolls back ALL lines, costs and receipt",
    async () => {
      await rejected(
        "save_stock_receipt",
        [
          store,
          receipt(id(41), [
            {
              product_id: product.id,
              location_id: box.id,
              quantity: 2,
              purchase_cost: 999,
            },
            { product_id: product.id, location_id: dest.id, quantity: -1 },
          ]),
          true,
        ],
        /positive/i,
      );
      assert.equal((await rpc("get_pos_products", [store]))[0].quantity, 10);
      assert.equal(
        (await rpc("get_product_financials", [store]))[0].purchase_cost,
        925,
      );
      assert.equal(
        await value(
          "select count(*)::int as result from public.stock_receipts where id=$1",
          [id(41)],
        ),
        0,
      );
    },
  );
  await check(
    "paired transfer leaves source 5 / destination 5 / total 10",
    async () => {
      await rpc("transfer_stock", [
        store,
        product.id,
        box.id,
        dest.id,
        5,
        id(50),
      ]);
      const rows = (
        await db.query(
          "select location_id,quantity from public.stock_balances where product_id=$1 order by location_id",
          [product.id],
        )
      ).rows;
      assert.deepEqual(
        rows.map((x) => Number(x.quantity)),
        [5, 5],
      );
      assert.equal((await rpc("get_pos_products", [store]))[0].quantity, 10);
      assert.equal(
        await value(
          "select count(*)::int as result from public.stock_movements where transfer_group_id=$1",
          [id(50)],
        ),
        2,
      );
      await rejected(
        "transfer_stock",
        [store, product.id, box.id, dest.id, 1, id(50)],
        /already/i,
      );
    },
  );
  await check(
    "server rejects stale client stock assumptions and invalid transfers",
    async () => {
      await rejected(
        "transfer_stock",
        [store, product.id, box.id, dest.id, 6, id(51)],
        /insufficient/i,
      );
      await rejected(
        "transfer_stock",
        [store, product.id, box.id, box.id, 1, id(52)],
        /invalid/i,
      );
      await rejected(
        "transfer_stock",
        [store, product.id, box.id, dest.id, 0, id(53)],
        /invalid/i,
      );
      assert.equal((await rpc("get_pos_products", [store]))[0].quantity, 10);
    },
  );
  await check(
    "adjustment is audited, compares current quantity, rejects negative/stale values",
    async () => {
      await rejected(
        "adjust_stock",
        [store, product.id, box.id, 4, 3, "Physical Count", id(60)],
        /changed/i,
      );
      await rejected(
        "adjust_stock",
        [store, product.id, box.id, 5, -1, "Missing", id(61)],
        /invalid/i,
      );
      await rpc("adjust_stock", [
        store,
        product.id,
        box.id,
        5,
        4,
        "Physical Count",
        id(62),
      ]);
      assert.equal((await rpc("get_pos_products", [store]))[0].quantity, 9);
      assert.equal(
        await value(
          `select count(*)::int as result from public.audit_logs where action='stock.adjusted'`,
        ),
        1,
      );
    },
  );
  await check(
    "duplicate copies metadata but no movements/costs and has a fresh code",
    async () => {
      copy = await rpc("duplicate_product", [store, product.id]);
      assert.notEqual(copy.id, product.id);
      assert.notEqual(copy.internal_code, product.internal_code);
      assert.equal(
        (await rpc("get_pos_products", [store])).find((p) => p.id === copy.id)
          .quantity,
        0,
      );
      assert.equal(
        await value(
          "select count(*)::int as result from public.product_financials where product_id=$1",
          [copy.id],
        ),
        0,
      );
      await rpc("archive_product", [store, copy.id]);
      assert.equal((await rpc("get_pos_products", [store])).length, 1);
    },
  );
  await check(
    "opening stock is an ADJUSTMENT and location rename preserves code",
    async () => {
      const opened = await rpc("save_product", [
        store,
        { ...payload(), id: id(21), name: "Opening Test", initial_quantity: 3 },
      ]);
      assert.equal(
        await value(
          "select movement_type as result from public.stock_movements where product_id=$1",
          [opened.id],
        ),
        "ADJUSTMENT",
      );
      const renamed = await rpc("save_location", [
        store,
        {
          id: dest.id,
          name: "Box Renamed",
          kind: "box",
          parent_id: shelf.id,
          expected_updated_at: dest.updated_at,
        },
      ]);
      assert.equal(renamed.internal_code, dest.internal_code);
      dest = renamed;
      await rejected("archive_location", [store, box.id], /stock/i);
      await rejected("archive_location", [store, shelf.id], /children/i);
      const empty = await rpc("save_location", [
        store,
        { id: id(15), name: "Empty", kind: "box", parent_id: shelf.id },
      ]);
      await rpc("archive_location", [store, empty.id]);
      await rejected(
        "save_stock_receipt",
        [
          store,
          receipt(id(42), [
            { product_id: product.id, location_id: empty.id, quantity: 1 },
          ]),
          true,
        ],
        /active box/i,
      );
    },
  );
  await check(
    "anonymous and authenticated nonmembers fail direct API operations",
    async () => {
      await actor(null, "anon");
      await rejected("get_pos_products", [store]);
      await rejected("transfer_stock", [
        store,
        product.id,
        box.id,
        dest.id,
        1,
        id(80),
      ]);
      await actor(outsider);
      assert.equal(
        await value("select count(*)::int as result from public.products"),
        0,
      );
      await rejected("get_pos_products", [store]);
    },
  );
  await check(
    "employee inventory.view receives safe catalog and stock but no cost/profit",
    async () => {
      await actor(owner);
      await rpc("set_employee_permission", [
        employee,
        store,
        "inventory.view",
        true,
      ]);
      await actor(employee);
      const rows = await rpc("get_pos_products", [store]);
      assert.equal(rows.find((p) => p.id === product.id).quantity, 9);
      assert.doesNotMatch(
        JSON.stringify(rows),
        /purchase_cost|profit|valuation|margin|925/,
      );
      assert.equal(
        await value(
          "select count(*)::int as result from public.product_financials",
        ),
        0,
      );
      assert.equal(
        await value(
          "select count(*)::int as result from public.stock_receipt_costs",
        ),
        0,
      );
      await rejected("get_product_financials", [store]);
      await rejected("get_profit_summary", [store]);
      await rejected("save_product", [
        store,
        {
          ...payload(),
          id: product.id,
          expected_updated_at: product.updated_at,
        },
      ]);
      await rejected("save_stock_receipt", [
        store,
        receipt(id(43), [
          { product_id: product.id, location_id: box.id, quantity: 1 },
        ]),
        true,
      ]);
      await rejected("transfer_stock", [
        store,
        product.id,
        box.id,
        dest.id,
        1,
        id(81),
      ]);
      await rejected("adjust_stock", [
        store,
        product.id,
        box.id,
        4,
        3,
        "Other",
        id(82),
      ]);
      await assert.rejects(
        db.query(`update public.products set name='Forged' where id=$1`, [
          product.id,
        ]),
        /permission/i,
      );
    },
  );
  await check(
    "receiving permission alone cannot submit protected costs",
    async () => {
      await actor(owner);
      await rpc("set_employee_permission", [
        employee,
        store,
        "inventory.receive",
        true,
      ]);
      await actor(employee);
      await rejected("save_stock_receipt", [
        store,
        receipt(id(44), [
          {
            product_id: product.id,
            location_id: box.id,
            quantity: 1,
            purchase_cost: 123,
          },
        ]),
        true,
      ]);
      assert.equal(
        (await rpc("get_pos_products", [store])).find(
          (p) => p.id === product.id,
        ).quantity,
        9,
      );
      await rpc("save_stock_receipt", [
        store,
        receipt(id(45), [
          { product_id: product.id, location_id: box.id, quantity: 1 },
        ]),
        true,
      ]);
      assert.equal(
        (await rpc("get_pos_products", [store])).find(
          (p) => p.id === product.id,
        ).quantity,
        10,
      );
      await actor(owner);
      assert.equal(
        (await rpc("get_product_financials", [store])).find(
          (p) => p.product_id === product.id,
        ).purchase_cost,
        925,
      );
    },
  );
  await check(
    "private image policies allow only scoped upload/read and unreferenced delete",
    async () => {
      const path = `${store}/${product.id}/${id(90)}.webp`;
      await db.query(
        `insert into storage.objects(bucket_id,name) values('product-images',$1)`,
        [path],
      );
      product = await rpc("save_product", [
        store,
        {
          ...payload(),
          id: product.id,
          expected_updated_at: product.updated_at,
          primary_image_url: path,
        },
      ]);
      await actor(employee);
      assert.equal(
        await value("select count(*)::int as result from storage.objects"),
        1,
      );
      await assert.rejects(
        db.query(
          `insert into storage.objects(bucket_id,name) values('product-images',$1)`,
          [`${store}/${product.id}/${id(91)}.webp`],
        ),
        /row.level/i,
      );
      await actor(outsider);
      assert.equal(
        await value("select count(*)::int as result from storage.objects"),
        0,
      );
      await actor(owner);
      await db.query(
        "delete from storage.objects where name=$1 returning name",
        [path],
      );
      assert.equal(
        await value("select count(*)::int as result from storage.objects"),
        1,
      );
      product = await rpc("save_product", [
        store,
        {
          ...payload(),
          id: product.id,
          expected_updated_at: product.updated_at,
          primary_image_url: null,
        },
      ]);
      await db.query(
        "delete from storage.objects where name=$1 returning name",
        [path],
      );
      assert.equal(
        await value("select count(*)::int as result from storage.objects"),
        0,
      );
      assert.equal(
        await value(
          `select public.can_access_product_image('private/secret.pdf',true) as result`,
        ),
        false,
      );
    },
  );
  await check(
    "permission batch applies atomically without role-only escalation",
    async () => {
      await rpc("set_employee_permissions", [
        store,
        employee,
        ["inventory.view", "sales.create"],
      ]);
      await actor(employee);
      const context = await rpc("get_session_context", []);
      assert.deepEqual(context.permissions, ["inventory.view", "sales.create"]);
      await rejected("set_employee_permissions", [
        store,
        employee,
        ["profit.view"],
      ]);
      await actor(owner);
      await rejected(
        "set_employee_permissions",
        [store, employee, ["not.real"]],
        /unknown/i,
      );
      await actor(employee);
      assert.deepEqual((await rpc("get_session_context", [])).permissions, [
        "inventory.view",
        "sales.create",
      ]);
    },
  );
  console.log(
    `${checks} Phase 3A PostgreSQL workflow/security checks passed. Isolated PostgreSQL/Auth/Storage fixtures; not hosted authentication, HTTP storage or multi-connection concurrency.`,
  );
} catch (error) {
  console.error("Phase 3A check failed:", error.message, error.where ?? "");
  process.exitCode = 1;
} finally {
  await db.close();
}
