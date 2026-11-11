# Phase 3A implementation report

## Status

Implemented in the existing Taha POS project. Approved Dashboard/POS layout, navigation, theme system, gold/red branding, cart and all 26 local IndexedDB stores are preserved. No native build or advanced transactional backend was added.

**Hosted connection: pending.** Project: not supplied. Actual environment URL/public key/accounts: not configured. Supabase mode is implemented and tested with isolated PostgreSQL plus intercepted service HTTP. It must not be described as a connected production deployment.

## Authentication and users

- Existing Supabase email/password, optional Google PKCE, session initialization/refresh/auth-change handling, logout, profile loading and route guards are retained and integrated with provider selection.
- `/login` has no public signup. Unauthenticated routes redirect to login; denied direct URLs show Access Denied. Inactive/unassigned profiles cannot enter the business workspace.
- Remote employee list/detail show application profiles, role, status and explicit branch permissions. Owner can provision an existing trusted Auth UUID, edit eligible profiles, save permission batches, and assign server-hashed PINs. Email comes from Auth.
- Owner bootstrap and Auth user creation remain trusted administration. No frontend service-role credentials or role authorization from user metadata.
- Owner/employee UI login, provisioning, grants, PIN assignment and deactivation pass against fixtures. Real hosted accounts/Google/terminal behavior remain unverified.
- The demo PIN is restricted to local development; server assignment and verification reject it. PIN hashes and rate-limit/capability tables stay private. Individual management authentication is required for identity/permission/PIN administration.

## Products and locations

Remote create/edit/duplicate/archive, automatic permanent codes, custom brand/model/grade/color/category values, aliases, optional default box and opening-stock movements are implemented. Stale edits fail using `updated_at`. Duplicate copies metadata into a new ID/code with zero stock and no copied costs/history. Archive retains history.

Product images upload as compressed WebP into private scoped Storage. Table, detail and POS use signed URLs. Replace/remove cleans unreferenced objects; shared or archived references remain protected. Invalid images receive a friendly error. Browser image upload/replace/remove and explicit safe DTO mapping pass against Storage/SQL fixtures.

Existing Rack → Shelf → Box pages use real location repositories, permanent codes, rename and empty-location archive RPCs. Same-store hierarchy is constrained; stocked locations and active parents cannot be silently archived. Invalid loops and hierarchy changes are rejected.

## Stock and POS

Receiving supports supplier/reference/date, drafts, multiple product/box lines and separately protected purchase costs. A server RPC commits receipt, all lines, costs, RECEIVE movements and audit atomically. Invalid lines roll back everything. Users without the cost grant can receive quantities but cannot submit/read costs.

Transfers atomically create paired TRANSFER_OUT/TRANSFER_IN after checking permission, positive quantity, distinct active boxes and source availability. Adjustments require `inventory.adjust`, current balance, nonnegative count and a reason. Opening inventory produces audited ADJUSTMENT events. Store-row locks serialize mutations and close stale-balance/archive races; transfer/adjustment request IDs reject duplicate submission.

Stock/low-stock/location-detail read a database balance view. Dashboard inventory metrics are remote; sales/financial metrics display pending. POS preserves fuzzy name/brand/model/category/alias search, prices/minimums, thumbnail, stock/location and cart. Final live checkout is disabled until Phase 3B; no local sale deducts hosted stock. Customer display remains a reduced public snapshot without costs/minimums/stock/employee controls.

Realtime subscribes only to products, locations and stock movements, with cleanup and a 15-second polling fallback. PIN terminal requests use safe RPC polling because their memory-only capability is not forwarded by WebSocket. Separate owner/employee browser tests confirm stock refresh through polling; hosted Realtime delivery is unverified.

The exact tested flow creates Samsung Galaxy A15 Charging Board at Rack 12 → Shelf B → Box 04, receives 10, verifies Products/location/POS stock 10, transfers 5, verifies 5 + 5 = 10 in both sessions, then checks adjustment/low-stock behavior and employee cost denial. This uses actual adapters and PostgreSQL/RLS with intercepted Auth, not a real Supabase project.

## Schema and permissions

Three new migration files; the previous four remain unchanged:

- `202610030001_catalog_and_stock_workflows.sql`
- `202610030002_product_storage_and_realtime.sql`
- `202610030003_counter_pin_hardening.sql`

New public tables: `catalog_values`, `suppliers`, `stock_receipts`, `stock_receipt_lines`, `stock_receipt_costs`. Existing profiles/grants/products/financials/locations/movements/shifts/audit/counter structures are reused. All 20 business/private tables have RLS. `stock_balances` remains a security-invoker view. Private `product-images` bucket/policies are created by SQL.

New public functions: `save_product`, `duplicate_product`, `archive_product`, `save_location`, `archive_location`, `save_supplier`, `save_stock_receipt`, `transfer_stock`, `adjust_stock`, `get_employees`, `save_employee`, `set_employee_permissions`, `can_access_product_image`. Safe POS and secure PIN functions are extended. Private helpers perform permission/branch locking/box validation/catalog-value capture. Full existing table/function inventory is in `supabase/README.md`.

Permission enforcement requires active profile/membership plus explicit branch grant, with active owner access. Direct client writes cannot bypass authorized RPCs. Purchase costs live separately from products and receipt lines. Safe POS RPCs never query financial tables, including for owners. Costs/profit are independently gated, and financial/private tables are excluded from Realtime. Frontend guards are convenience; SQL/RLS enforce actual access.

SQL security tests deny anonymous/nonmember inventory, role-only access, direct profile/grant/cost escalation, unauthorized product edit/receipt/transfer/adjustment and unauthorized costs/profit. Owner operations and cost-blind authorized receiving pass. Movements/audit are append-only; audit records contain actor/reason/action without tokens/passwords/PINs or protected costs.

## Provider and project structure

`VITE_DATA_PROVIDER=local|supabase` selects repositories centrally. Local mode requires explicit mock Auth; Supabase never falls back to local identity/mutations. Missing release configuration fails closed. Remote query keys include provider, profile and store; switching identity clears cart/cache. No automatic demo upload or hidden authoritative IndexedDB duplicate exists in live mode.

Main additions/changes:

- `src/lib/supabase/{catalog-repositories,team-repositories,repositories,repository-utils,mappers,product-images}.ts`
- `src/lib/repositories/` contracts/provider composition and existing local adapters.
- `src/hooks/use-inventory-realtime.ts`, scoped repository query hooks.
- `src/features/inventory/stock-adjustment.tsx`, existing inventory page wiring.
- `src/features/employees/pin-assignment.tsx`, existing profile/permission page wiring.
- `src/types/database.ts`, strict domain/DTO additions.
- `supabase/migrations/` three new files.
- `tests/supabase.spec.ts`, `tests/supabase-fixture.ts`, `scripts/test-stock-backend.mjs`, separate live/local production smoke scripts.

## Validation

- `npm run build`: PASS, strict TypeScript + production Vite output in `dist`.
- `npm run build:demo`: PASS, separate local review output in `dist-demo`.
- `npm run lint`: PASS.
- `npm run validate:migrations`: PASS, all seven files apply in order.
- `npm run test:security`: PASS, 20 existing plus 14 new PostgreSQL checks.
- `npm run test:client-boundary`: PASS, privileged keys rejected before bundling without printing them.
- `npm run test:production`: PASS, fail-closed production login, no local/mock identity, safe public display, theme persistence, native CSP and simulated hash routing.
- `npm run test:production:local`: PASS, local IndexedDB/checkout/stock/customer display/theme/CSP/hash routing; no browser console/runtime errors.
- `npm run validate:tauri`: PASS, installed CLI JSON schema/icons/capability only. No native dev/build attempted.
- `npm test`: 47 passed in the full 48-test run; one existing offline-message assertion caught a copy regression. Restored the approved local wording and reran that test plus all four Supabase adapter tests: **5/5 passed**. All 44 existing and four new scenarios are verified across the full run and focused retest; there are no unresolved test failures.
- Hosted integration tests: NOT RUN, project values/accounts unavailable.

An initial full test run reused a stale Vite process with the old environment and was stopped. Restarting the development server loaded explicit local mode. The final run uses that fresh server and both provider configurations.

## Manual actions required

1. Select/create a dedicated Supabase project and provide its actual URL/public publishable key in ignored `.env.local` with Supabase mode and mock Auth disabled.
2. Apply unapplied migrations in documented order; disable public signups, create/confirm the owner Auth account and perform the trusted bootstrap. Create internal staff Auth accounts before provisioning them from Employees.
3. Complete the hosted receive-10/transfer-5/security/image/session acceptance check in `docs/SUPABASE_SETUP.md`.
4. Configure Google OAuth only if Google login is wanted. Register a dedicated terminal account only if shared PIN counter login is wanted.

No Rust install, service-role frontend key, automatic demo upload or huge SDK installation is required for browser Phase 3A validation.

## Known limits and next phase

Hosted Auth/Storage/Realtime/concurrent connections are not verified. SQL store locking is implemented/tested in single-connection PostgreSQL fixtures, not stress-tested against hosted concurrent clients. Storage/SQL are separate transactions; cleanup is best effort and orphan uploads may require trusted cleanup. Signed URLs remain valid for up to 15 minutes after issue. History UI caps movements/audit at the latest 1,000 records. Catalog and balances paginate. No full offline sync or native compilation was performed.

Implementation is prepared for **Phase 3B — real sales + payments + credit + returns + out-for-test**, after hosted Phase 3A acceptance. Next phase should implement idempotent atomic sale/stock transactions, secure approvals, payment/credit/return/test ledgers and protected historical cost snapshots, retaining the approved UI and local/offline architecture.
