import type { Page, Route } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
// Hosted HTTP/Auth/Storage are intercepted. SQL runs the actual checked-in migrations.
export const branch = "10000000-0000-4000-8000-000000000001";
export const owner = "40000000-0000-4000-8000-000000000001";
export const employee = "40000000-0000-4000-8000-000000000002";
export const calls: { identity: string; path: string; body: unknown }[] = [];
let queue = Promise.resolve();
const rpcArgs: Record<string, string[]> = {
  get_transaction_result:["p_store_id","p_operation","p_request_id"],
  complete_sale:["p_store_id","p_input"],get_sale:["p_store_id","p_id"],list_sales:["p_store_id","p_filter"],transaction_data:["p_store_id","p_kind","p_filter"],
  get_business_settings:["p_store_id"],save_business_settings:["p_store_id","p_input"],get_customer_balance:["p_store_id","p_customer_id"],
  save_customer:["p_store_id","p_input"],save_payment_method:["p_store_id","p_input"],save_coupon:["p_store_id","p_input"],quote_coupon:["p_store_id","p_code","p_lines","p_customer_id"],
  list_transaction_approvers:["p_store_id","p_permission"],approve_transaction:["p_store_id","p_manager_id","p_pin","p_purpose","p_payload"],
  receive_credit_payment:["p_store_id","p_input"],reverse_payment:["p_store_id","p_input"],return_sale_item:["p_store_id","p_input"],void_sale:["p_store_id","p_input"],save_test_out:["p_store_id","p_input"],update_test_out:["p_store_id","p_input"],
  get_transaction_report:["p_store_id","p_from","p_to"],get_employee_report:["p_store_id","p_from","p_to"],get_dashboard_transactions:["p_store_id"],device_data:["p_store_id","p_input"],
  get_session_context: [],
  get_pos_products: ["p_store_id"],
  get_product_financials: ["p_store_id"],
  get_profit_summary: ["p_store_id"],
  get_employees: ["p_store_id"],
  save_product: ["p_store_id", "p_input"],
  duplicate_product: ["p_store_id", "p_id"],
  archive_product: ["p_store_id", "p_id"],
  save_location: ["p_store_id", "p_input"],
  archive_location: ["p_store_id", "p_id"],
  save_supplier: ["p_store_id", "p_input"],
  save_stock_receipt: ["p_store_id", "p_input", "p_receive"],
  transfer_stock: [
    "p_store_id",
    "p_product_id",
    "p_source",
    "p_destination",
    "p_quantity",
    "p_request_id",
  ],
  adjust_stock: [
    "p_store_id",
    "p_product_id",
    "p_location_id",
    "p_expected",
    "p_new_quantity",
    "p_reason",
    "p_request_id",
  ],
  save_employee: ["p_store_id", "p_input"],
  set_employee_permissions: ["p_store_id", "p_profile_id", "p_permissions"],
  update_my_profile: ["p_full_name", "p_phone"],
  set_employee_pin: ["p_profile_id", "p_store_id", "p_pin"],
  log_client_event: ["p_action", "p_version"],
};
const tables = new Set([
  "products",
  "locations",
  "stock_balances",
  "stock_movements",
  "suppliers",
  "catalog_values",
  "stock_receipts",
  "stock_receipt_lines",
  "stock_receipt_costs",
  "product_financials",
  "audit_logs",
  "profiles",
]);
export async function attachBackend(page: Page, db: PGlite, identity = owner) {
  const user = {
    id: identity,
    email:
      identity === owner ? "owner@example.invalid" : "employee@example.invalid",
    role: "authenticated",
    aud: "authenticated",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const jwt = [
    "eyJhbGciOiJIUzI1NiJ9",
    Buffer.from(
      JSON.stringify({
        sub: identity,
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "fixture-only",
  ].join(".");
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const json = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    const requestHeaders = route.request().headers();
    const body = requestHeaders["content-type"]?.includes("application/json")
      ? (route.request().postDataJSON() ?? {})
      : {};
    calls.push({ identity, path, body });
    if (path === "/auth/v1/token")
      return json({
        access_token: jwt,
        refresh_token: "fixture-refresh",
        token_type: "bearer",
        expires_in: 3600,
        user,
      });
    if (path === "/auth/v1/user") return json(user);
    if (path === "/auth/v1/logout") return json({});
    const operation = async () => {
      try {
        await db.exec("RESET ROLE");
        await db.query(
          "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false),set_config('request.headers','{}',false)",
          [identity],
        );
        await db.exec("SET ROLE authenticated");
        if (path.startsWith("/rest/v1/rpc/")) {
          const name = path.split("/").pop()!;
          const args = rpcArgs[name];
          if (!args)
            return json(
              { code: "42501", message: "Unsupported fixture RPC" },
              403,
            );
          const result = await db.query<{ result: unknown }>(
            `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as result`,
            args.map((k) => body[k]),
          );
          return json(result.rows[0]?.result ?? null);
        }
        if (path.startsWith("/rest/v1/")) {
          const table = path.split("/").pop()!;
          if (!tables.has(table))
            return json(
              { code: "42501", message: "Unsupported fixture table" },
              403,
            );
          const select = url.searchParams.get("select") ?? "*";
          if (select !== "*" && !/^[a-z_,]+$/.test(select))
            throw new Error("Invalid fixture select");
          const params: unknown[] = [];
          const conditions: string[] = [];
          for (const [key, value] of url.searchParams)
            if (value.startsWith("eq.") && /^[a-z_]+$/.test(key)) {
              params.push(value.slice(3));
              conditions.push(`${key}=$${params.length}`);
            }
          let sql =
            `select ${select} from public.${table}` +
            (conditions.length ? " where " + conditions.join(" and ") : "");
          const order = url.searchParams.get("order");
          if (
            order &&
            /^[a-z_]+\.(asc|desc)(,[a-z_]+\.(asc|desc))*$/.test(order)
          )
            sql +=
              " order by " +
              order
                .split(",")
                .map((x) => x.replace(".", " "))
                .join(",");
          const limit = url.searchParams.get("limit"),
            offset = url.searchParams.get("offset");
          if (limit && /^\d+$/.test(limit)) sql += " limit " + limit;
          if (offset && /^\d+$/.test(offset)) sql += " offset " + offset;
          const rows = (await db.query(sql, params)).rows;
          const single = route
            .request()
            .headers()
            .accept?.includes("object+json");
          return json(single ? (rows[0] ?? null) : rows);
        }
        if (/^\/storage\/v1\/object\/sign\/(product-images|business-assets)$/.test(path)) {
          const bucket=path.split("/").pop()!;
          const urls = [];
          for (const p of body.paths) {
            const exists = (
              await db.query(
                "select name from storage.objects where bucket_id=$1 and name=$2",
                [bucket, p],
              )
            ).rows.length;
            urls.push(
              exists
                ? {
                    path: p,
                    signedURL: `/object/sign/${bucket}/${p}?token=test-image`,
                  }
                : { path: p, error: "Denied" },
            );
          }
          return json(urls);
        }
        if (
          /^\/storage\/v1\/object\/(product-images|business-assets)\//.test(path) &&
          route.request().method() === "POST"
        ) {
          const bucket=path.split("/")[4];
          const name = path.slice(`/storage/v1/object/${bucket}/`.length);
          await db.query(
            "insert into storage.objects(bucket_id,name) values($1,$2)",
            [bucket,name],
          );
          return json({ Key: bucket+"/" + name });
        }
        if (
          path === "/storage/v1/object/product-images" &&
          route.request().method() === "DELETE"
        ) {
          for (const name of body.prefixes)
            await db.query(
              "delete from storage.objects where bucket_id='product-images' and name=$1 returning name",
              [name],
            );
          return json([]);
        }
        return json({ code: "42501", message: "Unsupported endpoint" }, 403);
      } catch (error) {
        const e = error as { code?: string; message: string };
        return json(
          { code: e.code ?? "42501", message: e.message },
          e.code === "42501" ? 403 : 400,
        );
      }
    };
    // Scope each request's Auth claims and SQL together; PGlite has one connection.
    if (
      /^\/storage\/v1\/object\/sign\/(product-images|business-assets)\//.test(path) &&
      url.searchParams.has("token")
    )
      return image(route);
    queue = queue
      .catch(() => undefined)
      .then(operation)
      .then(() => undefined)
      .catch(() => undefined);
    await queue;
  });
}
function image(route: Route) {
  return route.fulfill({
    contentType: "image/png",
    body: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=",
      "base64",
    ),
  });
}
export async function login(page: Page) {
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("fixture@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
}
