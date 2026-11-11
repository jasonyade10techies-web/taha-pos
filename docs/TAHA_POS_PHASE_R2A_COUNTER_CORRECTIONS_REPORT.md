# Taha POS — R2A counter corrections

Date: **11 November 2026, Asia/Karachi**. Project: `D:\Inventory system POS`.

## Scope and baseline

Implemented the owner's R2A specification in the existing application. Baseline `fed76251bb7c5f3de89d58ee76a248a23db2402a` remains on branch `recovered-r1`; R2A is a descendant on `r2a-counter-corrections`. No reset, history rewrite, remote push, hosting deployment, purchase, DNS change, APK build/install, Windows installer build or saved-shop database migration was performed.

The final implementation commit, clean-tree verification, secret-scan and private backup identities are recorded in ignored `.test-postgres/r2a-20261111/git-checkpoint.json` and the final owner response. This avoids pretending a commit can contain its own hash. The R1 forensic file and immutable private archives remain unchanged.

## Database restoration rehearsal

**PASS: restored and inspected the archived database without starting the preserved database.**

- Source: private `D:\Taha-Private-Recovery\R1-20261111-1336\saved-development-postgres-offline-before-R1.zip`, SHA256 `4058fe838c836fea2d430d7b7fb41632251068f7ea294287aa29f4e211d82067`.
- Extracted into private ignored `.test-postgres/r2a-20261111/restore-copy`. All **60,378 files / 1,329,358,054 source bytes** matched the source manifest by size and SHA256, including rereading extracted files.
- The file-only archive omitted empty PostgreSQL directories and retained a stale PID/unclean shutdown state. Recreated standard empty directories and replaced launch configuration **only in the disposable copy**. Preserved its archived PID/auto-configuration separately. Local WAL replay completed successfully.
- Rehearsal bound only `127.0.0.1:55469`, with explicit copied data/HBA paths, external services disabled and default read-only transactions. No application or migration runner used the restored records.
- Inspected the archived saved development database: **73 application tables, 64 matching migration checksums, 398 indexes with zero invalid/not-ready, 195 foreign-key relationships with zero orphan rows**.
- Counted products, stock movements, accounts, credit ledger, sales/items, returns, services and media metadata. Verified sale/item totals, return amount = credit reduction + payout, and returned quantities bounded by original items. No inconsistencies in these checks. Raw counts/financial aggregates remain private; no customer records or credentials are copied into this report.
- Exported schema privately and stopped the copy cleanly. Rechecked original archive hash. The preserved `.test-postgres/data` database/port **55439** was never started or written by R2A.

Evidence: `restore-extraction.json`, `restore-database-verification.json`, `restored-schema.sql`, `restore-server.log` under the private R2A evidence directory. An archive has no pre-recorded logical row-count manifest: comparison is exact file/byte verification followed by restored catalog/relationship/accounting checks, not an invented live-source SQL comparison. This does not recover missing historical image objects or establish offsite/cloud backup readiness.

## Corrections and before/after behavior

| Area | Reproduced cause / previous behavior | Implemented behavior |
|---|---|---|
| Short search | Prefixes required three characters; fractional prefix scores were rejected for some three-character terms. Partial SKU was forced through exact-only logic; expanded dictionary text discarded useful original aliases. | Frontend/backend parity for one/two/three-character word prefixes, compact model prefixes, names, service names, Roman Urdu/dictionary aliases and bounded fuzzy matching. Original words plus synonyms remain searchable. Exact numeric barcode identity is never fuzzy-matched; SKU prefixes are deterministic. Dictionary preparation occurs once per search, with no new per-keystroke API query. |
| Keyboard/touch | Main POS search did not select results with Enter/arrows. | Arrow navigation focuses enabled Add buttons, Escape returns to search, and Enter from search supports keyboard/HID barcode input. Actual desktop keyboard and touch-compatible browser interactions are tested. No driver or physical scanner acceptance is claimed. |
| Service charge | Number state and `price || ''` conflated blank with zero; linked-price warnings/breakdown appeared before a charge was entered. | Blank remains unset; typed zero remains visibly zero. A custom service requires a positive valid PKR charge with at most two decimal places. No misleading zero breakdown/floor warning while blank. Saved configured prices retain their existing contract; no free-sale policy or nullable financial model was invented. Material floor/approval and product/labor accounting remain authoritative on the server. |
| Damaged stock | Safe POS projection/card omitted damaged quantity, although quarantine already had a separate ledger. | POS exposes only a safe damaged count, separate from sellable quantity. Damaged/quarantine is one existing condition, not two quantities to add together. Authorized operators can open existing stock/history/location/reason views. Quarantine does not increase available balance or become sellable implicitly. |
| Return choice | A sole eligible item still required manual selection. | Exactly one eligible line defaults; several require an explicit choice; fully returned/voided receipts remain inspectable without another return form. Receipts and Return History navigation remain separate. |
| Refund explanation | A blanket payout checkbox obscured credit-only returns and method/amount. | Preview shows original invoice debt before/after, credit reduction, actual manual payout and method. Credit-only returns require no payout confirmation; partial-credit returns pay only the excess. Paid single-method sales suggest their recorded method; ambiguous cases require a choice. Other invoices are not automatically offset. |
| Stale financial confirmation | A changed invoice could invalidate an operator's reviewed payout. | Optional expected payout/credit reduction are checked against existing SQL calculations under existing locks, with atomic rejection when changed. Cached idempotent retries still resolve before this check. Stock/money history and established refund calculation are unchanged. Confirmation resets when form values change. |
| Copy actions | Clipboard calls could fail without a usable manual path; receipt sharing lacked copyable invoice/receipt summaries. | Shared browser/WebView copy attempts normal clipboard then supported browser fallback; otherwise opens selectable manual text with no false copied-success claim. Invoice, receipt, receipt link, customer info and reminder copying are covered. No passwords, costs/profit or internal locations are included in receipt summaries. |
| WhatsApp | Receipt opening had no blocked-window feedback and bypassed native opener handling. | User-click popup reservation, validated `https://wa.me` destination, safe phone normalization, Tauri opener when native, and useful failure feedback. Optional receipt recipient selection is preserved. Reminder/account permissions and current-obligation validation remain enforced. Opening is never sending/delivery confirmation. No messages were sent. |
| Template unlink | Validator discarded explicit null, so SQL treated unlink as omitted/preserve; UI had no explicit detach action. | Explicit null unlinks, omission preserves, repeated unlink is safe. Edit Service offers a pending-on-save Unlink material action. Local/demo linkage metadata clears consistently. Old invoice/material allocations remain unchanged; a subsequent unlinked service sale consumes no old material. |

The application is Tauri-based, not Electron. R2A did not add or replace a desktop framework. Native clipboard/OS WhatsApp acceptance remains a physical/native test; browser fallback and browser destination behavior are verified.

## Accounting and authorization evidence

Fresh full backend suite: **224 passed, zero failed/skipped**, including auth, permissions, private media, stock/concurrency, sales/credit/returns, tax and offline-cash cases. The R2A cases additionally verify:

- Receiving, selling and returning preserve quantities; partial/full returns cannot over-return, and identical retries create one return/payout.
- Credit **PKR 3,600 − PKR 1,000 = PKR 2,600**; collection retries do not duplicate credit.
- A partially paid credit return reduces only that invoice's outstanding debt and pays the actual excess. Another invoice's debt remains unchanged.
- A credit-only return records no payout; an explicit bank refund retains its method-name snapshot and employee attribution. This records a manual payment, not an external bank/gateway transfer.
- Stale reviewed financial amounts reject atomically, with no stock restoration or return record committed.
- Combined charge **PKR 2,500 = PKR 2,000 product + PKR 500 labor**, with one material deduction across checkout retries.
- Explicit unlink and subsequent new service sale leave the original invoice and physical material balance unchanged.

Ten unique real-API browser cases pass (the required eight, private-image reload and credit-only return). Read-only SQL verification against their current disposable database also passes for all ten workflow groups. See the test report for the complete-suite failure/rerun history; no test count is inflated by adding subsets.

Owner-only and Staff modes, identities, shifts, permission enforcement, cost/profit visibility, and existing financial calculation remain in place. No staffing-system rewrite or automatic cash offset against unrelated debt was introduced.

## Files changed

Counter UI: `src/components/pos/{custom-service-dialog,product-card,product-search,service-mention-composer,virtual-receipt}.tsx`; `src/features/sales/transactions-page.tsx`; `src/features/services/service-form-page.tsx`; `src/features/credit/{credit-pages,customer-reminder,reminder-button}.tsx`.

Shared/domain: `src/components/ui/copy-text.tsx`; `src/lib/{product-search,reminders,external-actions,receipt-share,return-preview}.ts`; `src/lib/local/catalog-repositories.ts`; `src/lib/supabase/mappers.ts`; `src/types/{product,database,demo,transactions}.ts`. The mapper is reused pure conversion code; using that path does **not** switch production back to Supabase.

Backend: `server/src/business/product-search.ts`; `server/src/workflows/validation.ts`; new append-only migration `server/migrations/202611110100_counter_workflows.sql`. Existing migration files and MediaService were not rewritten.

Tests/tooling: `server/test/r2a-{search,template,preview,counter-financial}.test.ts`; `tests/r2a-counter.spec.ts`; `tests/phase5d-whatsapp.spec.ts`; `playwright.r2a-api.config.ts`; `playwright{,.local}.config.ts`; `tsconfig.node.json`; `scripts/{isolated-local-acceptance,start-local-acceptance,test-isolated-local-acceptance}.mjs`.

Documentation: this report, `TAHA_POS_PHASE_R2A_TEST_RESULTS.md`, remaining-work checklist, and `docs/superpowers/plans/2026-11-11-r2a-counter.md`. Exact final changed paths and checkpoint evidence are retained in the private acceptance record.

## Local startup and scope

From the project root, using the installed Node runtime:

```powershell
$env:PATH="C:\Users\hassa\AppData\Local\hermes\node;$env:PATH"
node scripts/start-local-acceptance.mjs --isolated --evidence-dir .test-postgres/r2a-20261111/local-acceptance
```

Open `http://127.0.0.1:1423/dashboard`; direct health `http://127.0.0.1:3306/api/v1/health`; proxy health `http://127.0.0.1:1423/api/v1/health`. The launcher verifies isolated PostgreSQL 55459 identity, unique fixture/process proof and connected health, and refuses occupied foreign ports. Evidence directories must remain under `.test-postgres`. It does not reset/initialize the saved database. If already running, open the URL rather than launching twice. Fixture sign-in is shown by the launcher and is not production provisioning.

This is **real API/real authentication with disposable test records**. Browser tests assert API provider and mock authentication disabled. Loopback is not a phone/LAN/public hosting endpoint. No APK/native installer/hardware acceptance is implied.

## Remaining work and phase boundary

See the test-results report for final counts, targeted reruns and limitations. R2A's software acceptance does **not** make the shop production-ready.

Outside R2A: repair/shift cloud revision gaps; complete readiness/schema/private-object checks; Hostinger account alignment/domain/external PostgreSQL/private storage; real backups/restore/offsite monitoring; missing historical media objects; Android corrupt queue/process-death recovery and signing; Windows toolchain/EXE/offline/hardware acceptance; remaining repair-job settlement/expense accounting before those workflows are used for real money.

Next bounded phase: **R2B — synchronization/readiness corrections and Hostinger staging packaging**. Keep PostgreSQL, verify the owner-selected Unlimited plan/account and external providers, and prepare same-origin Nest/React hosting. Deployment, native packaging and additional product work need their own subsequent authorized phase. Stop after R2A review.

## Exact changed-path manifest

- `docs/TAHA_POS_PHASE_R2A_COUNTER_CORRECTIONS_REPORT.md`
- `docs/TAHA_POS_PHASE_R2A_TEST_RESULTS.md`
- `docs/TAHA_POS_REMAINING_WORK_CHECKLIST.md`
- `docs/superpowers/plans/2026-11-11-r2a-counter.md`
- `playwright.config.ts`
- `playwright.local.config.ts`
- `playwright.r2a-api.config.ts`
- `scripts/isolated-local-acceptance.mjs`
- `scripts/start-local-acceptance.mjs`
- `scripts/test-isolated-local-acceptance.mjs`
- `server/migrations/202611110100_counter_workflows.sql`
- `server/src/business/product-search.ts`
- `server/src/workflows/validation.ts`
- `server/test/r2a-counter-financial.test.ts`
- `server/test/r2a-preview.test.ts`
- `server/test/r2a-search.test.ts`
- `server/test/r2a-template.test.ts`
- `src/components/pos/custom-service-dialog.tsx`
- `src/components/pos/product-card.tsx`
- `src/components/pos/product-search.tsx`
- `src/components/pos/service-mention-composer.tsx`
- `src/components/pos/virtual-receipt.tsx`
- `src/components/ui/copy-text.tsx`
- `src/features/credit/credit-pages.tsx`
- `src/features/credit/customer-reminder.tsx`
- `src/features/credit/reminder-button.tsx`
- `src/features/sales/transactions-page.tsx`
- `src/features/services/service-form-page.tsx`
- `src/lib/external-actions.ts`
- `src/lib/local/catalog-repositories.ts`
- `src/lib/product-search.ts`
- `src/lib/receipt-share.ts`
- `src/lib/reminders.ts`
- `src/lib/return-preview.ts`
- `src/lib/supabase/mappers.ts`
- `src/types/database.ts`
- `src/types/demo.ts`
- `src/types/product.ts`
- `src/types/transactions.ts`
- `tests/phase5d-whatsapp.spec.ts`
- `tests/r2a-counter.spec.ts`
- `tsconfig.node.json`
