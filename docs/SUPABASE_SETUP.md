# Phase 3B Supabase setup

The adapters, SQL and UI are implemented. No hosted project URL/public key or real account was supplied. This workspace is **not connected to a hosted project**. Tests use isolated PostgreSQL and intercepted Auth/Storage HTTP. No Phase 2 sample records are uploaded automatically.

## Project and environment

Use a dedicated Supabase project. These migrations revoke broad client grants in the public schema; do not run them against a database shared with unrelated apps.

Copy `.env.example` to ignored `.env.local` and enter actual values from your project:

```dotenv
VITE_DATA_PROVIDER=supabase
VITE_USE_MOCK_AUTH=false
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_GOOGLE_ENABLED=false
```

Use the public `sb_publishable_...` key. A legacy anon JWT is supported via `VITE_SUPABASE_ANON_KEY` instead. Never put service-role, `sb_secret_...`, passwords or PINs in Vite variables. Recognizable privileged client keys are rejected before bundling. Restart Vite after changes; rebuild for production. Missing configuration opens login/configuration and grants no mock identity.

For local development, explicitly select `VITE_DATA_PROVIDER=local` and `VITE_USE_MOCK_AUTH=true`, then restart. The committed `.env.development` already selects these defaults. Provider changes do not upload, clear or convert IndexedDB records.

## Apply migrations

Apply whole files in order using the trusted Supabase SQL editor, or an installed Supabase CLI (`supabase link --project-ref YOUR_ACTUAL_REF`, then `supabase db push`). If earlier files are already applied, apply only unapplied files; do not rerun migration history.

1. `202610020001_core_foundation.sql`
2. `202610020002_authorization_and_safe_queries.sql`
3. `202610020003_counter_pin_and_audit.sql`
4. `202610020004_trusted_provisioning.sql`
5. `202610030001_catalog_and_stock_workflows.sql`
6. `202610030002_product_storage_and_realtime.sql`
7. `202610030003_counter_pin_hardening.sql`
8. `202610030004_transaction_schema.sql`
9. `202610030005_transaction_configuration.sql`
10. `202610030006_sale_engine.sql`
11. `202610030007_credit_returns_and_test.sql`
12. `202610030008_transaction_reads_and_reports.sql`
13. `202610030009_device_sale_support.sql`
14. `202610030010_transaction_hardening.sql`
15. `202610030011_payment_history_consistency.sql`
16. `202610030012_profit_completeness.sql`
17. `202610030013_transaction_reporting_and_store_defaults.sql`

They seed only Taha Mobiles / Main Branch and permission definitions. They create the private `product-images` bucket (2 MB, WebP) and policies. The app converts PNG/JPEG/WebP uploads to WebP. The existing standard `supabase_realtime` publication gains only `products`, `locations`, `stock_movements`. For a custom publication setup, enable these three tables explicitly; never publish financial or private PIN tables. Keep the `private` schema out of exposed Data API schemas.

## Bootstrap the owner

Disable public signups in Supabase Auth. Create and confirm an internal email/password account in trusted Supabase administration. Copy its Auth UUID. In the trusted SQL editor, replace the UUID and name placeholders:

```sql
begin;
select set_config('request.jwt.claim.role', 'service_role', true);
select public.provision_profile(
  'REPLACE_WITH_EXISTING_AUTH_USER_UUID'::uuid,
  'YOUR_ACTUAL_OWNER_NAME', 'owner',
  '10000000-0000-4000-8000-000000000001'::uuid
);
commit;
```

Claim-setting belongs only in the trusted SQL editor. Client requests cannot set database claims. No private API key belongs in the frontend. Sign in at `/login`; identity/branch come from application tables. Active owners have all permissions. Managers/employees start without automatic permission grants.

## Employees and counter PINs

Create/confirm each employee's Auth account in trusted Supabase administration first. As owner, use **Employees → Add Employee** with that existing Auth UUID and profile details. The RPC verifies Auth identity and derives email from Auth. It cannot create a public signup or bootstrap an owner.

Save explicit branch grants in the Permissions tab. A selling employee normally needs `sales.create` and `inventory.view`. Receiving/transfer/adjustment permissions are separate. Cost access requires `costs.view_purchase_cost`; profit requires `profit.view` independently. Give staff administrators `employees.view` along with the relevant `employees.manage`/`employees.permissions` grants. Owner/own-role changes require trusted administration; managers cannot delegate permissions they lack.

Assign a real six-digit PIN through the employee profile form. The server hashes with bcrypt cost 12; hashes never leave the private schema. `123456` is rejected by server provisioning and verification. There is no Supabase or production fallback. Do not commit PINs or paste them into SQL history/screenshots.

For a shared counter, create a separate Auth account with **no profiles row**. Register its Auth UUID using `register_counter_terminal(auth_user_id, store_id, name)` from an owner/trusted-service session. Sign in with that account; `/counter` lists eligible employee cards. PIN verification yields a memory-only capability bound to the terminal JWT and attached to database requests. Switching/reloading locks the counter. Five failed attempts lock verification for 15 minutes; capabilities expire after 12 hours. Management administration requires an individual account, even when an owner unlocks a counter.

## Optional Google login

Email/password works independently. Google is disabled until configured. Enable Google in Supabase and enter the OAuth client ID/secret only in provider/Supabase administration. Use your project's exact Supabase Auth callback URL as Google's authorized redirect URI.

Allow these Supabase return URLs only where used:

- `http://127.0.0.1:1420/auth/callback` for development.
- `http://127.0.0.1:4173/auth/callback` for production preview.
- Your trusted browser deployment origin with `/auth/callback`.
- `taha-pos://auth/callback` for the packaged Windows app.

Set `VITE_SUPABASE_GOOGLE_ENABLED=true`, then restart/rebuild. Existing PKCE/deep-link handlers remain intact. OAuth still requires a provisioned active profile/membership. Native OAuth was not tested this phase.

Native CSP permits standard HTTPS `*.supabase.co` APIs/product images and Google profile images. Custom/self-hosted domains require exact API/image origins in CSP and the exact OAuth authorize URL in the opener scope.

## Required hosted acceptance check

Use identifiable test records in a dedicated test project or empty new shop database. Do not reset real inventory to test.

1. Owner login; create Rack 12 → Shelf B → Box 04 and a second box.
2. Create **Samsung Galaxy A15 Charging Board**, selling PKR 1,450, minimum PKR 1,300, alias `a15 charging patti`, threshold 5, Box 04.
3. Receive 10 units with a supplier/reference and authorized purchase cost. Verify Products, location detail and POS show 10.
4. In a separate employee/incognito session, search the alias. Verify price, minimum, location and stock; inspect responses for absence of costs/profit.
5. Owner transfers 5 to the second box. Verify source 5, destination 5, total 10. Employee's open screen should update by Realtime or the 15-second fallback.
6. Check low stock, authorized adjustment, stale-balance rejection, and invalid multi-line receipt rollback.
7. Try restricted direct API edits/receiving/transfers/financial reads. Verify denial for anonymous users, nonmembers and employees without each permission.
8. Upload/replace/remove an image; check table/detail/POS. Archived products retain history/images; duplicates share their image until edited. Referenced images cannot be deleted.
9. Verify logout/reload, inactive access denial, permission revocation, terminal switching/lockout and optional Google redirects.

The exact receive-10/transfer-5 flow passes locally through actual adapters and checked-in PostgreSQL RPC/RLS. This does not prove hosted Auth/Storage/WebSocket delivery or multi-connection locking. Complete hosted checks before declaring the shop live.

## Scope and limits

Supabase mode implements catalog, locations, receiving, transfers, adjustments, users/permissions and the Phase 3B server-authoritative transaction engine. Dashboard sales KPIs, Reports, checkout, credit, returns and out-for-test use protected RPCs. Hosted credentials and hosted acceptance are still pending. No local mutation pretends to change hosted stock; offline writes/sync are not implemented.

Stock derives from append-only movements and a security-invoker balance view. Each catalog/location/inventory mutation locks its store row and revalidates inside the transaction. Invalid receipt lines roll back all movements/costs/audit. Transfer/adjustment request IDs reject duplicates; product/location edits check `updated_at` conflicts.

Signed image URLs last 15 minutes; issued URLs remain valid until expiry. SQL/Storage cannot share a transaction: cleanup is best effort, so interrupted uploads may need trusted periodic orphan cleanup. Referenced images remain protected. Movement/audit UI shows the latest 1,000 records; catalog/location/balance/receipt reads paginate. No native compilation, automatic demo import, stock reservation or full offline sync was added.

Official references: [Postgres functions](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage policies](https://supabase.com/docs/guides/storage/security/access-control), [private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals).
