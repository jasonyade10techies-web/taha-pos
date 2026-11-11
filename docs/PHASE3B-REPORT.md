# TAHA POS — Phase 3B report

Phase 3B keeps the approved Dashboard, New Sale layout, sidebar, themes, customer display and local IndexedDB mode intact. It adds the real transaction boundary behind the existing screens; it does not start a public customer account or an offline sync engine.

## Implemented

- `complete_sale` is one PostgreSQL transaction. It rechecks the actor, branch, active products, current prices, minimum-price approvals, coupons, payment allocations, credit limits, stock and used-device state before writing the invoice, lines, payment records, credit ledger, stock movements and audit event.
- Cash records the applied amount and stores change separately. Digital methods support JazzCash, Easypaisa, bank/card entries, proof paths, verification and manager approval. Split cash/digital/credit allocations must equal the server total.
- Credit sales create receivables; `receive_credit_payment` applies old debt FIFO without stock or sales revenue. `reverse_payment` keeps the original payment and appends a reversal plus the required ledger correction.
- Returns support partial quantities, sellable/damaged/do-not-restore destinations, receipt and return-window checks, manager approval, manual refund acknowledgement and credit reduction. `void_sale` appends stock/financial corrections and keeps the original invoice.
- Out-for-test reserves stock without revenue and can return or convert atomically into a sale without a second deduction.
- Receipt data is an immutable transaction view. The 80mm preview/print path includes branch snapshot, invoice, cashier, lines, discounts, totals, payments, paid/outstanding, change and a safe invoice QR reference. Reprints read the same sale.
- Dashboard and Reports use server aggregates for sales, cash, digital, credit, collections, returns, discounts, employee activity and permission-gated profit. Unknown acquisition cost produces unavailable profit rather than an inflated zero-cost margin.
- The browser retry layer stores request IDs and SHA-256 payload fingerprints only. It reconstructs a completed result before retrying and prevents an initial checkout ID from being reused with different financial content.

## Migrations and database surface

The migration order is:

`202610030004_transaction_schema.sql`, `202610030005_transaction_configuration.sql`, `202610030006_sale_engine.sql`, `202610030007_credit_returns_and_test.sql`, `202610030008_transaction_reads_and_reports.sql`, `202610030009_device_sale_support.sql`, `202610030010_transaction_hardening.sql`, `202610030011_payment_history_consistency.sql`, `202610030012_profit_completeness.sql`, and `202610030013_transaction_reporting_and_store_defaults.sql` (in addition to the seven preserved Phase 1/3A files).

The new public tables are `business_settings`, `customers`, `credit_accounts`, `payment_methods`, `coupons`, `sales`, `sale_items`, `sale_item_financials`, `payments`, `credit_ledger_entries`, `coupon_redemptions`, `returns`, `out_for_test`, and `purchased_devices`. The new private tables are `transaction_requests`, `transaction_approvals`, and `approval_attempts`.

All business tables have RLS. Client table writes remain revoked; mutations use permission-checked `SECURITY DEFINER` functions with an empty search path. Owner access is derived from the application profile and membership, while manager/employee access requires explicit branch permissions. Financial cost snapshots are physically separate and nullable when acquisition cost is unknown. The new branch-default trigger creates its own settings and Cash method, and settings reads no longer fall back to another branch.

## Local and hosted modes

`VITE_DATA_PROVIDER=local` and `VITE_USE_MOCK_AUTH=true` keep the approved demo workflow, including its local-only demo approval. Supabase mode never silently falls back to the mock identity or IndexedDB. No Supabase URL, publishable key, Auth account, Storage bucket deployment or Google OAuth configuration was available for this implementation, so hosted authentication and hosted Storage/Realtime were not claimed as tested.

## Validation recorded

- `npm run test:transactions`: 25 SQL transaction/security checks passed, including rollback, idempotency, permission denial, digital proof/approval, credit, returns, test conversion, device sale, branch defaults and protected profit.
- `npm run test:security`: the existing security suite plus stock and transaction checks pass against all checked-in migrations.
- `npm run test:concurrency`: isolated PostgreSQL tests verify two backend connections racing for the last unit produce one committed sale and one clean insufficient-stock failure.
- `npm test`: **53 passed** across local prototype, mock-auth, responsive shell, Supabase authorization, transaction, catalog and private-image scenarios. The suite reported no browser page errors or console errors.
- `npm run build`: PASS (strict TypeScript + Vite production output); `npm run build:demo`: PASS.
- `npm run lint`: PASS; `npm run validate:migrations`: PASS; `npm run test:client-boundary`: PASS.
- `npm run test:production` and `npm run test:production:local`: PASS. These validate CSP, fail-closed live configuration, local IndexedDB/demo checkout, theme persistence and simulated hash routing; they are not native Tauri launches.

## Manual actions required

1. Create a dedicated Supabase project and supply its real project URL and publishable key in ignored `.env.local`.
2. Apply the seventeen migrations in order, disable public signup, create/confirm internal Auth accounts and provision profiles, branch memberships and explicit permissions.
3. Configure private Storage buckets/policies and Google OAuth only if that sign-in method is wanted, then run the hosted acceptance flow in `docs/SUPABASE_SETUP.md`.

## Next phase

Phase 3C should be the hosted Supabase pilot and operational hardening: hosted Auth/Storage/Realtime acceptance, user/permission provisioning, receipt/printer/scanner integration and monitored rollout. Offline synchronization and other hardware work should follow that pilot.
