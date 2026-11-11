# TAHA MOBILES Supabase schema

Seventeen versioned migrations are implemented for a dedicated Supabase project. No hosted project credentials were available; none has been applied remotely. All files apply successfully to isolated PostgreSQL fixtures. Follow [setup/owner bootstrap](../docs/SUPABASE_SETUP.md) before connecting.

## Migration order

1. `202610020001_core_foundation.sql` — permanent codes, core tables, timestamps, constraints, immutable movements/audit.
2. `202610020002_authorization_and_safe_queries.sql` — branch permissions, RLS, safe POS and separate financial functions.
3. `202610020003_counter_pin_and_audit.sql` — server bcrypt PINs, rate limits, terminal capabilities, controlled delegation/audit.
4. `202610020004_trusted_provisioning.sql` — internal profile/counter provisioning, self-profile and restrictive defaults.
5. `202610030001_catalog_and_stock_workflows.sql` — catalog values, suppliers, receipts/costs, authorized atomic CRUD/receiving/transfers/adjustment/users.
6. `202610030002_product_storage_and_realtime.sql` — private product-image bucket/policies and safe Realtime tables.
7. `202610030003_counter_pin_hardening.sql` — reject the Phase 2 demo PIN in server assignment and verification.
8. `202610030004_transaction_schema.sql` — sales, items, payments, customers, credit, returns, tests, devices and idempotency tables.
9. `202610030005_transaction_configuration.sql` — payment/coupon/customer/settings RPCs and transaction approval capability.
10. `202610030006_sale_engine.sql` — atomic sale completion, stock allocation, price floors, coupons and safe sale DTOs.
11. `202610030007_credit_returns_and_test.sql` — credit collection/reversal, returns, voids and out-for-test operations.
12. `202610030008_transaction_reads_and_reports.sql` — paginated transaction reads and permission-safe dashboard/report aggregates.
13. `202610030009_device_sale_support.sql` — used-device purchase/list/status and one-unit sale enforcement.
14. `202610030010_transaction_hardening.sql` — proof-path validation, approval binding, direct-write denial and immutable history hardening.
15. `202610030011_payment_history_consistency.sql` — payment status/ledger consistency and historical receipt calculations.
16. `202610030012_profit_completeness.sql` — unknown acquisition cost remains unavailable instead of being treated as zero.
17. `202610030013_transaction_reporting_and_store_defaults.sql` — branch-scoped defaults, settings updates and server-calculated employee reports.

First four files are preserved unchanged. Apply only unapplied migrations to an existing installation. Production seed is limited to Taha Mobiles / Main Branch (`10000000-0000-4000-8000-000000000001`) and 31 permission definitions. No Auth accounts, products, customers, PINs, sales or financial history are seeded. Test fixtures are isolated in `scripts/` and `tests/`.

The migrations revoke broad public-schema client grants: use a dedicated database, take a backup of existing deployments, and never expose `private` in Data API settings. Functions use qualified names and empty search paths; private helpers are unavailable to clients.

## Tables, view and storage

Public tables (31): the original catalog/auth tables plus `business_settings`, `customers`, `credit_accounts`, `payment_methods`, `coupons`, `sales`, `sale_items`, `sale_item_financials`, `payments`, `credit_ledger_entries`, `coupon_redemptions`, `returns`, `out_for_test`, and `purchased_devices`.

Private tables (6): the original PIN/session tables plus `transaction_requests`, `transaction_approvals`, and `approval_attempts`.

View: `stock_balances` — security-invoker product/location aggregate over signed movements.

Private Storage bucket: `product-images`; maximum 2 MB and WebP. Path is `store UUID/product UUID/random UUID.webp`. Select/insert/delete policies restrict catalog access by branch; replacement uses a fresh path without upsert. Readers can sign referenced images; catalog writers can clean unreferenced uploads. Referenced images cannot be deleted. Private PIN/financial tables are excluded from Realtime.

All 20 business/private tables have RLS. Business client INSERT/UPDATE/DELETE is denied; mutations must use authorized RPCs. Policies restrict reads by active membership and explicit grants. Append-only triggers deny movement/audit update/delete even when the caller has broader access.

## Public functions

Identity/authorization: `current_profile_id`, `is_owner`, `can_access_store`, `has_permission`, `get_session_context`.

Catalog/financial reads: `get_pos_products`, `get_product_financials`, `get_profit_summary`.

Catalog/location/supplier mutations: `save_product`, `duplicate_product`, `archive_product`, `save_location`, `archive_location`, `save_supplier`.

Stock: `save_stock_receipt`, `transfer_stock`, `adjust_stock`.

Users: `get_employees`, `save_employee`, `set_employee_permissions`, `set_employee_permission`, `provision_profile`, `update_my_profile`.

Counter: `register_counter_terminal`, `list_counter_employees`, `verify_counter_pin`, `lock_counter_session`, `set_employee_pin`.

Transactions: `complete_sale`, `receive_credit_payment`, `reverse_payment`, `return_sale_item`, `void_sale`, `save_test_out`, `update_test_out`, `approve_transaction`, `get_transaction_result`, `device_data`.

Other reads/configuration: `get_business_settings`, `save_business_settings`, `save_customer`, `save_payment_method`, `save_coupon`, `quote_coupon`, `get_customer_balance`, `get_sale`, `list_sales`, `transaction_data`, `get_transaction_report`, `get_employee_report`, `get_dashboard_transactions`, `log_client_event`, `can_access_product_image`.

Private helpers: `next_code`, `touch_updated_at`, `assign_permanent_code`, `validate_location_hierarchy`, `append_only`, `write_audit`, `require_permission`, `lock_store`, `require_box`, `remember_product_values`.

## Security boundaries

The application loads identity/permissions from profiles and branch grants, never user metadata. Managers/employees have no automatic access solely from their role. Active owners have all grants. Anonymous users and authenticated nonmembers cannot read inventory. Permission changes recheck server authorization; delegation rejects self escalation, owner modification and unheld grants.

`products` has no purchase cost/profit/valuation column. `get_pos_products` explicitly builds a nonfinancial DTO without ever querying protected tables, including for owners. `product_financials` and `stock_receipt_costs` require `costs.view_purchase_cost`; `get_profit_summary` independently requires `profit.view` and stays unavailable until Phase 3B. Receiving without cost permission may record quantities but cannot submit/read protected costs. Shared notes/audit metadata must never contain financial secrets.

Auth account creation remains trusted administration. Owner bootstrap uses `provision_profile` with an existing Auth UUID. Employees UI provisions existing Auth accounts and saves explicit grants. Counter base accounts have no individual profile or business privileges; server-hashed PIN verification produces a short-lived terminal-bound capability. Every protected RPC derives the actor from server context. Hashes/PINs never leave private storage, and the demo PIN is rejected by the server. Management administration requires individual sign-in.

## Atomic inventory rules

Products have no editable quantity column. Creation may write opening `ADJUSTMENT` with `inventory.adjust`. IDs/codes are permanent; duplicates receive new IDs/codes with zero stock and no copied financials/history. Categories/master values support custom entries. Product/location edits reject stale `updated_at`.

Rack → Shelf → Box and same-store references are constrained. Archive preserves history and cannot silently remove stocked locations or active children. Received receipts are immutable. All lines, protected costs, latest purchase cost, RECEIVE movements and audit events share one transaction. Bad lines roll back everything.

Each catalog/location/stock mutation locks its store row. Transfers recheck source balance while holding the lock and write both directions atomically; positive quantities, distinct active boxes, same branch and sufficient stock are required. Adjustments compare expected stock and require a reason. Request identifiers reject duplicate transfer/adjustment submission. Store-level serialization is deliberately simple for the current single shop; unrelated stores remain independent.

## Validation and deployment limitations

Run `npm run validate:migrations`, `npm run test:security`, `npm test`, `npm run test:client-boundary`. The SQL tests execute actual RLS/functions/constraints/crypto. Browser adapter tests execute SQL but intercept Auth/Storage HTTP. They do not validate a hosted project, real JWT signing, Storage service behavior, WebSocket delivery or multiple PostgreSQL connections. Perform the exact hosted receive-10/transfer-5 employee scenario in the setup guide.

Regenerate database types after deployment with `supabase gen types typescript --linked --schema public`, reconciling the checked-in JSON RPC/domain return types rather than deleting them. The current types compile against the installed SDK.

Sales, payment, credit, return and test mutations are server-authoritative RPCs. Each important write accepts a scoped idempotency key and stores only its request hash/result, so retries do not duplicate stock, invoices, payments or ledger entries. `complete_sale` locks the branch row, rechecks products/prices/stock and writes sale, payment, credit, stock and audit records atomically. Purchase cost lives in `sale_item_financials`, is nullable when unknown, and is never present in employee-facing DTOs. No full offline sync or automatic local demo migration exists. Storage cleanup is best effort outside the SQL transaction; issued image URLs last up to 15 minutes. Audit/movement UI reads are capped at the latest 1,000 records.
