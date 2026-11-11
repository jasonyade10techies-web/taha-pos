import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { migrate, runtimeRole } from "../scripts/migrate";
import { hashPassword } from "../src/auth/crypto";
import { offlineInvoice } from "../src/sync/sync.controller";
import type { INestApplication } from "@nestjs/common";
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
    parsed.pathname = "/taha_desktop_" + Date.now();
    databaseName = parsed.pathname.slice(1);
    await admin.query(`create database ${parsed.pathname.slice(1)}`);
    db = new pg.Client({ connectionString: parsed.toString() });
    await db.connect();
    await migrate(db);
    const runtime = new URL(parsed);
    runtime.username = "taha_desktop_test";
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
  if (admin && /^taha_desktop_\d+$/.test(databaseName))
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
test("actual frontend terminal identity is accepted by the HTTP offline-grant endpoint", async () => {
  const { useUiStore } = await import("../../src/stores/ui-store");
  const terminalId = useUiStore.getState().terminalId;
  const response = await api(`/stores/${store}/sync/offline-grant`, "POST", { terminalId });
  assert.equal(response.status, 201, "Frontend terminal identity must satisfy the server UUID contract");
  assert.equal(response.data.terminalId, terminalId);
  assert.match(terminalId, /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);
});
test("native offline cash keeps its invoice in sale, receipt and idempotency result", async () => {
  const body = sale(),
    one = await api(`/stores/${store}/sync/sales`, "POST", body);
  assert.equal(one.status, 201, JSON.stringify(one.data));
  assert.equal(one.data.invoice, body.invoice);
  assert.equal(one.data.change, 200);
  const two = await api(`/stores/${store}/sync/sales`, "POST", body);
  assert.equal(two.data.id, one.data.id);
  assert.equal(two.data.invoice, body.invoice);
  assert.equal(
    (await db.query("select count(*)::int n from public.sales")).rows[0].n,
    1,
  );
});
test("price conflict rolls back without financial or stock side effects", async () => {
  const body = sale();
  body.catalog[0].price = 1100;
  const before = (await db.query("select count(*)::int n from public.sales"))
    .rows[0].n;
  assert.equal(
    (await api(`/stores/${store}/sync/sales`, "POST", body)).status,
    409,
  );
  assert.equal(
    (await db.query("select count(*)::int n from public.sales")).rows[0].n,
    before,
  );
});
test("forged offline invoice and altered grant are rejected", async () => {
  const body = sale();
  body.invoice = "TM-INV-FORGED";
  assert.equal(
    (await api(`/stores/${store}/sync/sales`, "POST", body)).status,
    400,
  );
  body.invoice = offlineInvoice(body.input.idempotencyKey);
  body.grant += "bad";
  assert.equal(
    (await api(`/stores/${store}/sync/sales`, "POST", body)).status,
    403,
  );
});
test("offline credit and electronic allocations are refused", async () => {
  const body = sale();
  body.input.payments[0].methodId = "credit";
  assert.notEqual(
    (await api(`/stores/${store}/sync/sales`, "POST", body)).status,
    201,
  );
});
test("HTTPS revision stream is scoped, monotonic and contains no cost/profit values", async () => {
  const first = await api(`/stores/${store}/sync/changes?after=0`);
  assert.equal(first.status, 200);
  assert(first.data.changes.length);
  assert(
    !/purchase_cost|profit|password|secret|Bearer/.test(
      JSON.stringify(first.data),
    ),
  );
  const second = await api(
    `/stores/${store}/sync/changes?after=${first.data.cursor}`,
  );
  assert.equal(second.data.changes.length, 0);
  await db.query("update public.products set name=$1 where id=$2", [
    "Changed",
    product,
  ]);
  const third = await api(
    `/stores/${store}/sync/changes?after=${first.data.cursor}`,
  );
  assert(BigInt(third.data.cursor) > BigInt(first.data.cursor));
  assert(third.data.changes.some((r: { id: string }) => r.id === product));
  assert.equal(
    (await api(`/stores/${randomUUID()}/sync/changes?after=0`)).status,
    403,
  );
});
test("invoice UUID is deterministic and invalid references fail closed", () => {
  const id = randomUUID();
  assert.equal(offlineInvoice(id), offlineInvoice(id.toUpperCase()));
  assert.throws(() => offlineInvoice("bad"));
});
test("a reused cash idempotency key cannot post a different quantity", async () => {
  const body = sale();
  const first = await api(`/stores/${store}/sync/sales`, "POST", body);
  assert.equal(first.status, 201);
  body.input.lines[0].quantity = 2;
  const changed = await api(`/stores/${store}/sync/sales`, "POST", body);
  assert(
    [409, 422].includes(changed.status),
    "Changed idempotency payload must be rejected",
  );
  assert.equal(
    (
      await db.query("select count(*)::int n from public.sales where id=$1", [
        first.data.id,
      ])
    ).rows[0].n,
    1,
  );
});
test("tax conflicts roll back and revision deltas contain only the requested catalogue rows", async () => {
  const body = {
    ...sale(),
    tax: { rate: 99, mode: "Exclusive", appliesTo: "Products" },
  };
  const before = (await db.query("select count(*)::int n from public.sales"))
    .rows[0].n;
  assert.equal(
    (await api(`/stores/${store}/sync/sales`, "POST", body)).status,
    409,
  );
  assert.equal(
    (await db.query("select count(*)::int n from public.sales")).rows[0].n,
    before,
  );
  const rows = await api(`/stores/${store}/sync/catalog?ids=${product}`);
  assert.equal(rows.status, 200);
  assert.equal(rows.data.length, 1);
  assert.equal(rows.data[0].id, product);
  assert(!/purchase_cost|profit/.test(JSON.stringify(rows.data)));
});
test("durable image upload retries return one private file and changed content conflicts", async () => {
  const { default: sharp } = await import("sharp");
  const buffer = await sharp({
    create: { width: 12, height: 12, channels: 3, background: "#E53935" },
  })
    .png()
    .toBuffer();
  const uploadId = randomUUID();
  const upload = async (bytes: Buffer) => {
    const form = new FormData();
    form.set(
      "file",
      new Blob([new Uint8Array(bytes)], { type: "image/png" }),
      "photo.png",
    );
    form.set("kind", "product");
    form.set("staged", "true");
    form.set("uploadId", uploadId);
    const response = await fetch(url + `/api/v1/stores/${store}/media`, {
      method: "POST",
      headers: {
        Origin: "tauri://localhost",
        Authorization: "Bearer " + token,
      },
      body: form,
    });
    return { status: response.status, data: await response.json() };
  };
  const first = await upload(buffer);
  assert.equal(first.status, 201, JSON.stringify(first.data));
  const second = await upload(buffer);
  assert.equal(second.status, 201);
  assert.equal(second.data.id, first.data.id);
  const different = await sharp({
    create: { width: 12, height: 12, channels: 3, background: "#FFC107" },
  })
    .png()
    .toBuffer();
  assert.equal((await upload(different)).status, 409);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from app_private.media_uploads where request_id=$1",
        [uploadId],
      )
    ).rows[0].n,
    1,
  );
});
