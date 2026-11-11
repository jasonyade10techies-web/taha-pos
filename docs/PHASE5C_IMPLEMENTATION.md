# Phase 5C — implementation, verification and handoff

**Work dates:** 14–15 October 2026 (Asia/Karachi). **State:** Phase5C feature implementation and automated validation performed; production/native sign-off remains blocked by the explicit issues below. The broad browser sweep has two recorded parallel-run failures that pass on final serial recheck; it is not described as a clean full-suite run. This document supersedes the interim Stage1 continuation record. Owner specification: `docs/PHASE5C_REQUIREMENTS.md`; staged plan: `docs/superpowers/plans/2026-10-14-phase5c.md`.

The approved Dashboard, POS search/product cards, persistent cart, yellow checkout, customer/service row, coded logo and PKR branding are preserved. The project was extended in place. No dependencies were upgraded, system software installed, real shop database reset, Supabase reconnected or hosting deployed. The folder has no Git repository, so this report uses source paths and retained test evidence rather than invented commits.

## 1. Smart Custom Services

**Implemented:** saved templates; at most three compact suggestions; deterministic model/alias and Roman Urdu shop-term matching; visible material token; undo/replace/inspect; per-service material quantity; explicit allocation when more than one eligible box exists. Unique exact recognition can link automatically; fuzzy/typo or ambiguous variant matches require confirmation. `pnl`/`panl` variants are supported without an external AI request.

Custom Service remains beside the customer selector. It has a service name and employee-set PKR charge, **no minimum-price field**. Normalization prevents duplicate saved templates; saving a duplicate does not grant permission to edit it. `services.create_custom`, `services.save_catalog` and the new explicit `services.consume_inventory` permission remain separate controls.

Typing, suggestions and cart insertion do not mutate stock. Completing the existing atomic sale records `REPAIR_USE` movements and immutable private component/cost linkage. Input material quantities are per service; receipt/domain output includes total consumed quantity and `quantityPerService`. Service-only sales do not change inventory. Unknown purchase cost stays unknown/NULL and affected local profit is suppressed rather than treating the material as free.

Source: `src/components/pos/custom-service-dialog.tsx`, `service-material-allocation.tsx`; `src/lib/smart-services.ts`, `src/lib/local/service-materials.ts`; `src/types/product.ts`, `src/types/demo.ts`; custom API workflow services and the smart-service migration. Employee-safe material locations do not require purchase-cost access. Customer receipts continue to show the service line without private material cost/profit information.

## 2. Damaged Inventory and Classified Returns

**Implemented:** available, damaged/quarantined and out-for-test quantities are separate; physical overview counts actual tracked balances. Products/Stock show clickable damaged history and red actionable low-stock badges, with quantities, thresholds, locations and a Receive Stock action.

A designated damaged/quarantine box cannot receive ordinary sellable stock. Damaged lots preserve origin sale/return/material, reason, notes, photos and disposition history. Authorized actions support transfer, recovery into an available box, write-off and notes. Transfer conserves physical stock; recovery changes condition without creating stock; write-off reduces physical stock. Appending a note does not erase the last physical disposition.

Returns support Sellable Stock, Damaged and Do Not Restore Stock. Damaged restoration requires a quarantine destination; sellable restoration uses available locations. Linked service materials are restored according to their actual component ratio. Idempotency and sold/remaining quantities prevent repeat restoration and overreturns; void restores eligible original components once. Unknown historical damaged returns are displayed as unlocated evidence, excluded from tracked physical totals until reconciled; no invented quarantine balance is seeded.

**Regression fixed during the broad sweep:** direct invoice navigation could mount the return form before return settings arrived and select the wrong default disposition. The form now waits for the query to load and exposes its normal loading/retry state. The existing cash-sale/return test reproduces the failure and passes after the fix.

Source: `src/types/inventory-conditions.ts`; `src/lib/local/inventory-conditions.ts`, `sales-repository.ts`, `catalog-repositories.ts`; `src/features/inventory/condition-stock.tsx`/`.css`; existing products, stock, locations and returns pages; `src/lib/api/catalog-repositories.ts` and custom API inventory operations. Native/offline operation is not certified by these browser tests.

## 3. Customer Ledger and Timeline

**Implemented:** actual linked sales, collections, returns/refunds, credit entries, test items/conversions and reminder-history events; immutable internal notes; category/date/order filters; pagination; transaction references; exact timestamps displayed in Asia/Karachi. Full-ledger balances are calculated before pagination; old date-only records say that time was not recorded.

Source permissions independently govern sales, payments/credit, returns, test items, notes and outstanding amounts. A customer-view-only employee does not receive a financial timeline or outstanding balance. Internal notes are distinct from manually prepared/opened reminder records and are not represented as customer messages.

The existing detail page now has Activity / Ledger and dedicated Returns sections, with authorized New Sale, Receive Payment, View Receipts, View Returns, Reminder and Edit actions. Top summary shows mobile, resolved/separate WhatsApp, account type, outstanding, limit and earliest configured next credit due date/status. Credit statistics use five compact desktop columns rather than a trailing orphan card.

Source: `src/types/customer-activity.ts`, `src/lib/local/customer-activity.ts`, `src/lib/shop-time.ts`, `src/features/credit/customer-activity.tsx`/`.css`, `credit-pages.tsx`; customer repository/service and API activity/note endpoints.

## 4. Receipt Search and Returns Lookup

**Implemented:** full/partial invoice and digits, customer name, normalized Pakistani phone, product, cashier and shop date lookup. Ambiguous searches show explicit receipt candidates with invoice/customer/date/cashier/totals; no arbitrary first result is selected. Returnable quantity is derived from the selected invoice and previous returns.

The existing Transactions page remains the central receipts page; repository pagination and customer/date/employee/payment/status filters are used. Employee detail has receipts/transactions with a link to the complete filtered list. Signed customer-safe receipt links, existing PDF/reprint/virtual receipts and white thermal/A4 paper behavior are preserved.

Lookup works with return permission without granting broad financial, proof or cost access. Unneeded approvals, minimum prices and payment proofs are removed from employee receipt search projections. Protected proof retrieval remains separately authorized.

Source: `src/lib/local/receipt-search.ts`, `src/components/pos/receipt-lookup.tsx`/`.css`, `src/features/sales/transactions-page.tsx`, existing employee detail, `ApiSalesRepository` and custom API receipt functions.

## 5. Credit Due Dates and Manual Reminders

**Implemented:** account/sale due date and time; a custom calendar and custom hour/minute menus; explicit Pakistan timezone serialization; optional required-credit-due-date setting; separate independent credit limit policy; WhatsApp same-as-phone or separate number; configurable warning window and reminders disabled by default.

Credit reminders use current per-invoice balances. Legacy/unallocated payments that cannot reconcile to invoices produce a truthful account-balance obligation instead of invented invoice allocations. Demo credit collection now links FIFO ledger portions to the invoices it actually pays. A return of an already collected invoice refunds that invoice and does not reduce another invoice's debt. Voids use the exact linked balance.

Test-item reminders contain quantities and return obligations, never fictitious purchase debt. Preview contains actual customer/contact/reference/amount or quantity/date/time; message text is editable, copyable and correctly URL encoded. WhatsApp opens only after an explicit employee action; sending occurs manually in WhatsApp. The app records prepared, opened or manually contacted states and **never claims delivery from opening a link**. Expected amount/due/quantity and idempotency are checked against fresh server data before recording an action. No messages were sent to real customers by these tests.

Alerts are deterministic, permission-scoped and refreshed by clock/focus/revision invalidation rather than repeatedly appended. Customer notes do not leak reminder amounts to customer-view-only users.

Source: `src/types/reminders.ts`, `src/lib/reminders.ts`, `src/lib/local/reminders.ts`, `src/components/ui/date-time-input.tsx`/`.css`, `src/features/credit/reminder-button.tsx`/`.css`, `src/hooks/use-shop-clock.ts`, checkout/account/test-item forms and settings/header.

## 6. UI, Themes and Responsiveness

Bundled Manrope remains the consistent application font. Light mode and approved red/yellow/gold design are preserved. Dark mode uses layered charcoal surfaces, distinct borders, readable secondary/muted text and restrained gold/red semantics. Light muted text and semantic badges were corrected for AA contrast; keyboard outlines now use a theme-aware gold token with at least 3:1 contrast. Textareas have visible keyboard focus too. New dropdowns/checkboxes/time menus use existing custom components. Shared Field labeling now includes AppCheckbox, fixing previously unnamed settings controls and restoring accessible keyboard/screen-reader identification. Existing reduced-motion behavior is retained.

Contrast checks cover nine text/background combinations in both themes (at least 4.5:1). New workflows were exercised at 1920×1080, 1440×900, 1366×768, 1024×768, 390×844 and 412×915, in light and dark, with real loaded headings, overflow checks, visible dialogs, no uncaught JavaScript errors and white receipt paper. Screenshots: `docs/screenshots/phase5c/`. One parallel/build-load run timed out at the startup screen at 1024px; the same case passed on an unchanged rerun. This is recorded as a test timing issue, not erased from the logs.

## 7. Persistence, Backend, Authorization and Migrations

Production remains the custom NestJS/PostgreSQL API. No hosted Supabase calls were added. Existing legacy Supabase adapter/SDK and compatibility SQL/mappers still exist; they were not reconnected or removed opportunistically. Local/demo is IndexedDB; native repositories/cache/outbox remain the existing SQLite architecture. Demo is not a security boundary. Server permissions, store membership, protected private data, RLS and controlled functions remain authoritative.

Dexie schema is advanced non-destructively through damaged lots/movements/request idempotency, immutable customer notes and reminder history. New writes preserve existing financial transaction boundaries. Stock-sensitive material/condition operations and credit administration are not newly enabled offline.

The public terminal identity is one persistent UUID shared by UI and Device Bridge, preferring a valid paired bridge identity on migration. Existing pending receipts/outbox payloads are not rewritten. Server validation/auth failures are SYNC ERROR; connection failures remain OFFLINE.

New private writes participate in the monotonic HTTPS revision stream using resource/entity IDs only, without copying notes, contact data, amounts or photos into change payloads. Customer/source permission mapping supports correct cache invalidation without requiring incoming cloud WebSockets.

### New versioned server migrations

1. `server/migrations/202610140100_smart_service_materials.sql`
2. `server/migrations/202610140200_damaged_inventory.sql`
3. `server/migrations/202610140300_customer_activity.sql`
4. `server/migrations/202610140400_receipt_search.sql`
5. `server/migrations/202610140500_due_reminders.sql`
6. `server/migrations/202610150100_phase5c_review_hardening.sql`

These add/extend controlled service-material accounting, private condition lots/movements, append-only notes/reminder history, due/communication fields, safe reads/search and revision triggers. Helpers use explicit permission/store checks and controlled grants; old renamed implementations are revoked to prevent bypass. Migrations were applied to isolated test databases only. No assertion is made that they have been deployed to the shop or Hostinger database.

## 8. Verification

Evidence directory: `.test-postgres/phase5c-20261014/`. All financial tests use fresh isolated databases/roles. PostgreSQL fixture is loopback **55459**; the original shop cluster was not reset. Browser fixture is **1437**, local/mock business data and an unreachable API target; device UI tests explicitly stub their bridge endpoints. Live-shop/Supabase test suites were deliberately excluded from this safe local sweep.

### Current measured results (15 October)

| Check | Result | Evidence |
|---|---|---|
| Full custom backend tests | **135 passed, 0 failed/skipped** | `final-backend-tests.log`; 139956.699ms |
| Backend build | Pass | `final-backend-build.log`; `dist/main.js` + compiled tools |
| Backend lint / TypeScript | Pass | `final-backend-lint.log`, `final-backend-typecheck.log` |
| Frontend build / strict TypeScript | **Pass on final source**, Vite build28.98seconds; standalone strict check passes | `completed-frontend-build.log`, `release-typecheck.log`; output `dist/` |
| Frontend lint | Pass on final source/test updates | `completed-frontend-lint.log` |
| Bundled mobile frontend | Final rebuild passes | `completed-mobile-build.log`; `dist-mobile/`, not an APK/device test |
| SQLite contract/schema tests | **7 passed** | `final-sqlite.log`; Node SQLite, not Rust native acceptance |
| Credential build boundary | Pass | `final-client-boundary.log` |
| Generated-output lint boundary | **1 passed** | `final-lint-boundary.log` |
| Retained SQL business tests | **20 security +14 stock +25 transaction checks passed** | `final-legacy-sql.log`; isolated PGlite, not hosted Supabase |
| Separate real PostgreSQL concurrency | **2 scenarios passed** | `final-concurrency.log`; simultaneous last unit and committed retry |
| Phase5C browser tests | **All26 Phase5C cases pass inside the final broad sweep**, including the full light/dark six-size matrix | `release-browser-all.log`; earlier startup timeout retained in `final-phase5c-browser.log` and unchanged rerun in `recheck-1024.log` |
| Existing recent browser regressions | **28 passed +1 missing-Python-library failure; print rerun passed** | `current-regressions.log`, `print-matrix.log`; bundled Python used, no installation |
| Return/default and stock editor regression recheck | **5 passed** | `legacy-stock-recheck.log` |
| Final full local browser sweep | **114/116 passed; 2 failed**, in 9.8minutes. **Final serial recheck2/2 passed** in24.8seconds after updating the obsolete proof-gating expectation | `release-browser-all.log`, `final-two-recheck.log`; no claim of116/116 in one clean run |
| Tauri configuration | Pass | `final-tauri-config.log`; installed CLI JSON schema/icons/capabilities only |
| Native Windows / physical phone / printer / deployment | **Not tested or deployed in this phase** | No new EXE/MSI/NSIS/APK produced |

Earlier red/green stage evidence remains in this directory: terminal HTTP identity RED400→GREEN201; smart-service and condition-stock authorization/rollback/privacy tests; timeline/receipt/reminder integration tests; calendar and semantic contrast regressions. Intermediate counts (74→75→90→103 etc.) are historical stage gates, not added again to the final135 count.

### Owner scenarios A–J

| Scenario | Implementation and evidence |
|---|---|
| A Saved intelligent Y20 service | Custom backend + local/browser: 36→35 on completed sale, one material use, safe receipt, dedup template and idempotent retry. |
| B Ambiguous variants | Confirmation/disambiguation and fuzzy recognition tests; no arbitrary consumption. |
| C Service only | No physical movements; existing checkout/receipt regression. |
| D Damaged return | Quarantine/history, partial disposition, transfer/recover/write-off and exact tracked totals; no available-stock increment. |
| E Sellable return | Component/product restoration and overreturn/retry protections; return-query settings race reproduced and fixed. |
| F Timeline | Sale→partial collection→classified return→note with exact remaining balance and timestamps; permission-limited projections. |
| G Partial receipt search | Multiple matching invoices, normalized phone/product/cashier search, explicit selection and returnable quantity. |
| H Manual reminder | Fresh remaining balance and PK timezone/contact/URL encoding; stale-value rejection; audited manual opening without delivery claim. |
| I Permissions | Direct backend stock writes denied without adjustment permission; private cost/profit and source-read boundaries tested. |
| J UI | Both themes, custom controls, visible focus, six viewport cases and white receipt/PDF regression. |

### Reproduction commands

- `npm run build`, `npm run lint`, `npm run build:mobile`, `npm run test:desktop`, `npm run test:client-boundary`, `npm run validate:tauri`.
- `npm --prefix server run build`, `npm --prefix server run lint`, `npm --prefix server run typecheck`.
- `npm --prefix server test` with `TAHA_TEST_POSTGRES_URL` pointing to a disposable test cluster, **never the shop database**.
- `npm run test:local` uses `playwright.local.config.ts` and the isolated local/mock fixture. PDF matrix requires `pdfinfo` and a Python runtime with `pypdf`; on this machine `TAHA_PDF_PYTHON` was set to the bundled runtime reported by workspace dependencies.
- `npm run test:security` executes the retained isolated SQL checks; `npm run test:concurrency` needs the disposable PostgreSQL connection.

The test runner excludes live-shop/Supabase suites; those require separately provisioned fixtures. UI tests for pairing are mocked transport contracts, not a new claim of a physically paired phone.

## 9. Known Issues and Existing P0 Blockers

| Item | Current state |
|---|---|
| Native terminal UUID/offline grant | Contract defect fixed; real isolated HTTP and browser migration/persistence tests pass. Actual Rust/Windows acceptance remains unverified. |
| Paid-offline cash reconciliation | **Still P0.** Conflicts after cash was collected need an explicit immutable exception/resolution workflow and original employee handoff. Retry/idempotency alone does not settle money or stock conflicts. |
| Windows EXE | No verified new EXE/MSI/NSIS. Previous audit reported missing MSVC/Windows SDK. No system installation/native build was performed here. |
| Hostinger | Not deployed. Plan capability/domain/external PostgreSQL/private storage/backups still need production decisions. Managed Node path preserved; no VPS assumption. |
| Durable mobile photo recovery | Existing bounded 30-minute queue/request expiry, per-request image/size limits and origin/logout clearing remain. This phase does not certify crash/reinstall/lifecycle-proof recovery. |
| Historical damaged stock | Unlocated evidence is not a verified physical balance. Owner reconciliation/migration is needed before counting it as quarantine stock. |
| Supabase legacy cleanup | Compatibility adapter/SDK remains. Production backend work is custom; removal should be separately tested, not confused with a new Supabase dependency. |
| Cross-device/native acceptance | No physical phone, Tauri binary, scanner or thermal-printer acceptance was performed. Mobile frontend build and IPC/browser contracts are narrower evidence. |
| Browser test maintenance | Older suites used pre-gallery labels, exact payment-button labels, one-step checkout and late proof-error assumptions. These now use current review/proof gating and explicit custom-select targeting. Full parallel run114/116 and final serial recheck2/2 remain separate evidence. Intermittent browser timing under load still needs a clean full serial/CI gate before declaring the entire suite green. No app layout was changed to satisfy obsolete tests. |

## 10. Next Bounded Recommendation

**Phase 5C.1 — Offline cash conflict resolution and native acceptance preparation.** Implement a narrowly scoped collected-cash exception ledger/resolution flow, original-employee attribution and restart-safe idempotency tests against SQLite plus the custom PostgreSQL API. Acceptance must cover lost response after commit, changed stock, revoked/off-shift employee, retry after restart and an auditable owner decision without silently losing paid money. Preserve online transaction behavior.

A small test-stability follow-up should first establish a clean full serial/CI browser gate with stable persisted-state assertions. In parallel, confirm managed Hostinger Node capabilities, PostgreSQL/private-object-storage choices and Windows build prerequisites. Only after those dependencies and native acceptance are satisfied should the project proceed to actual managed backend deployment and a final signed Windows installer. Durable mobile capture recovery is another separately bounded phase. This report does not mark native, financial-offline or hosted deployment production-ready.
