# Phase 5D.1 implementation and acceptance — current checkpoint

22 October 2026. **INTEGRATION QA IN PROGRESS. Do not treat this file as final phase sign-off.** Owner asked for current stage; this records a runnable delivery and the remaining work accurately.

## Current runnable delivery

- Main existing application: http://localhost:1423/dashboard.
- Ethernet observed at handoff:192.168.1.3; backend http://192.168.1.3:3001. The address changed from192.168.1.5 during checks. Backend was restarted to advertise the current URL; PostgreSQL was retained.
- APK: `artifacts/android/Taha-Staff-test-5D1.apk`, 0.5D.1-test/build8, debug signed, same package/certificate as build7.
- Downloads: `/api/v1/downloads/staff-test-5d1.apk` on3001 and `/staff-test-5d1.apk` on1423. Both HTTP200 and body SHA256 verified.
- APK SHA256:`3bda2a9351803e750969111a9774ace9ceddf4354a8f2fed34dda80d4876e9ae`. All55 packaged assets match current `dist-mobile`. Native unit tests23/23; Android build and lint passed. Physical device acceptance is pending.
- Saved owner development database migrated with six new versioned migrations. Existing applied migrations had no checksum changes. No records were reset or seeded. Before-migration custom backup: `.test-postgres/phase5d1-20261021/owner-dev-before-20261022.dump`,880286bytes,1065 TOC entries; SHA256 in its adjacent JSON. TOC/hash verified, not a full recovery drill.
- Existing shop now explicitly saved as Owner-only; read-back confirmed. No active shifts were present. Setup remains reviewable/resumable and website stays off. Employees, historical actors, transactions and device authorization are preserved.

## Implemented UI/workflows

1. Responsive customer account workspace: contact, balance/due/obligation/reminder column and one Timeline/Ledger history. Exact typed detail dialogs, complete running ledger, dated/undated/settled states, payment vs return/reversal separation, fresh manual reminder checks, safe existing-cart choice. Purchases links to the complete transaction list. Customer order/invoice selectors use styled controls.
2. Reversible owner/staff configuration and six-stage setup persisted through the API, with owner authorization and active-shift/unresolved-cash refusal. Daily employee/shift navigation/filter/switching hidden in owner-only presentation. New receipt cashier preference snapshots do not rewrite historic actors.
3. Dashboard KPI period links, human activity wording/source links, broad low-stock/customer targets, actual due/taken information, honest zero-period chart. Approved six-card and POS structure retained.
4. Compact stable POS customer/custom-service header, no duplicate quick-info row or header-height jump.
5. Transactions: full-row navigation with nested-control isolation, incoming-method grouping, custom dates, URL-backed filters and per-query scroll restoration, return-to-list action. Separate refund/payment records remain intact.
6. Returns:40/60 search/work layout; fully returned/voided receipts inspectable read-only; linked history details. New selected-invoice return reader bypasses the recent global list cap under the same source permissions.
7. Shared searchable selectors, canonical master IDs/normalization, custom calendars, nested quick supplier/product creation retaining receiving drafts, no duplicate opening/received stock.
8. Compact image-first Product Detail; adjacent availability/status, complete storage paths and reviewed transfers. Opaque private-media resolution uses the authenticated API session without requiring a separately signed-in phone bridge; unavailable old bytes receive an honest fallback.
9. Damaged opening/received inventory remains quarantined and excluded from sellable stock. Unknown purchase cost remains absent. Physical receiving excludes services and individually tracked phone categories. Existing financial/concurrency rules retained.
10. Dedicated mobile Sales, separate scoped draft/UUID/idempotency, catalog and explicit material/service flow, cash/electronic/credit/split payments, on-phone proof, white receipt/PDF and Android content-URI sharing. No desktop draft/display takeover. Backend conservatively blocks unsafe offline-counter overlap.
11. Regression testing exposed a cash-capture registration race between unique id/invoice constraints. Registration now serializes concurrent duplicate deliveries with a transaction advisory lock before insert. Original immutable cash evidence, authorization and posting logic remain intact.

## Fresh verification on22 October

| Check | Result/evidence |
|---|---|
| Full custom backend suite |159 passed,0failed,196.5seconds; `backend-final.log` |
| Targeted cash retry/receipt repair |24 passed,0failed; `backend-repairs.log` |
| Desktop Phase5D.1 workflows |6 passed,46.3seconds; `workflows-verified.log` |
| Customer workspace browser suite |6 passed,1.1minutes; `customer-recheck.log` |
| Inventory browser suite |11 passed,1.8minutes; `inventory-current.log` |
| Mobile UI/checkout mock suite |5 passed,47.3seconds; `mobile-current.log` |
| Real isolated API browser checks |3 passed,40.8seconds; `api-acceptance-verified.log` |
| SQLite tests |16 passed; `sqlite.log` |
| Frontend / backend builds |Passed; `frontend-final.log`, `server-final.log` |
| TypeScript / frontend and server lint |Passed at integrated checkpoints; repeat after final test/UI edits |
| Android |Build,23 native tests, lint and signature passed; two build logs |
| Live owner preview |Dashboard/customer/POS/setup rendered, no uncaught JS errors; `live-smoke.json` |
| LAN/downloads |Health + both APK bodies200 and exact hashes; `lan-downloads.json` |
| Full browser regression |163 tests started; not signed off. Older native-control/product-label/customer-tab selectors require updating. Preserve initial failures and rerun affected cases/full suite. See `browser-regression.log`. |

All logs above are under `.test-postgres/phase5d1-20261021/` unless stated otherwise. Earlier failing runs are retained separately. An initial broad backend run used the recovering wrong test instance; the final159/159 run explicitly targeted isolated55459. A dashboard helper typo was fixed before final backend/API acceptance. An old fixed-date return fixture expired legitimately after7days; the return-permission case now dates its own receipt within policy without changing production return rules. Early API browser failures included duplicate-heading/incorrect-tab selector and navigating before refresh completion; those harness problems were corrected, not hidden.

## Remaining work before final Phase5D.1 acceptance

- Finish/cleanly rerun full browser regression after adapting replaced controls; several old assertions are known incompatible. Do not infer an application regression or a pass from an obsolete selector alone.
- Repeat final lint/build/scoped checks after the last small customer selector/receipt-link and test-harness edits; APK delivered above is a verified test build, not production release acceptance.
- Setup currently routes initial location creation/payment account maintenance to existing dedicated screens. It does not yet create initial named rack/shelf/box records directly inside the assistant. New-install automatic entry is not forced; Review Shop Setup is available.
- Inspect every screenshot/interaction against all18 owner examples after integrated live owner-only configuration. Current responsive captures cover requested dimensions and themes, but browser overflow checks are not complete human workflow acceptance.
- Offline/mobile coordination deliberately pauses mobile completion until outstanding eight-hour counter authorizations expire; explicit safe early-release protocol is still future work. The guard uses the mobile client marker and is not a cryptographic client-class boundary.
- Dashboard payment activity may link to its module rather than select the exact payment; enrich remaining source navigation where necessary.
- Existing missing historical media files remain missing. No private URLs were made public and no dummy images masquerade as recovered evidence.
- Physical Android camera/gallery/QR pairing, PDF Sharesheet receiver readability, WhatsApp composer, reconnect and installation continuity need the owner's device. Windows native EXE, thermal printer and hosting are outside this acceptance.

## Relevant implementation paths

`docs/PHASE5D1_OWNER_BRIEF.md`, `docs/PHASE5D1_REQUIREMENTS_AND_PROGRESS.md`, `docs/phase5d1-customer-notes.md`, `docs/phase5d1-mobile-notes.md`; `src/features/credit/customer-*`, `credit-pages.tsx`; `src/features/settings/shop-setup.tsx`; `src/types/shop-configuration.ts`; `src/hooks/use-shop-configuration.ts`; `src/components/ui/{searchable-combobox,date-picker}.tsx`; `src/features/inventory/{products-page,receiving-page,transfers-page,inventory-controls}.tsx`; `src/features/sales/transactions-page.tsx`; `src/lib/{dashboard-actions,payment-summary}.ts`; `src/lib/mobile/sales-service.ts`; `src/features/mobile/mobile-sales-page.tsx`; `mobile/android/app/src/main/java/com/tahamobiles/staff/`; `server/migrations/20261021*.sql`, `202610220140_dashboard_record_navigation.sql`, `202610220150_invoice_return_history.sql`; `server/src/sync/cash-reconciliation.service.ts`.

## Physical test order

Follow the seven steps in `mobile/android/README.md`: health first, install build8, current Shop Address, pair/test request, photo insertion, independent mobile sale/receipt sharing, reconnect/draft checks. No physical pass or production deployment is claimed.
