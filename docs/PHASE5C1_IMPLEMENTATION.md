# Phase 5C.1 — offline cash reconciliation and synchronization reliability

Work date: 15 October 2026, Asia/Karachi. Specification: `docs/PHASE5C1_REQUIREMENTS.md`. Plan: `docs/superpowers/plans/2026-10-15-phase5c1.md`.

**IMPLEMENTED and automatically tested. Native Windows acceptance remains UNVERIFIED.** The existing project was extended in place. Dashboard/POS structure, branding, mobile workflows and Phase 5C modules are preserved. No hosting, system installations, dependency upgrades, production migrations or database resets were performed. There is no Git repository in this folder; evidence consists of source files and retained command logs, not invented commits.

## Problems established from source and execution

1. Native outbox/receipts and stock reservations were employee-scoped. Another employee signing in could hide already-collected cash, and the old import endpoint demanded the original seller's current session. An inactive seller therefore prevented ordinary recovery.
2. Failed imports rolled back the entire server transaction, leaving no independent server cash evidence. A stock rejection could not be distinguished in financial management from money never collected.
3. Server acknowledgment was followed by catalogue refresh **before** the local outbox was marked synced. A failed refresh could cause unnecessary replay of an already committed receipt.
4. The old conflict Retry button reset transport state without an owner decision/reason or a separate refund ledger.
5. The browser checkout helper used a one-shot `isVisible()` before query-loaded checkout had necessarily rendered. It could miss Review and then wait for a completion control that Review had not revealed. The old fixture could also reuse an unrelated server. An actual new serial run found a separate cold Vite startup failure: the first workflow still showed the explicit startup screen at its 30-second assertion. It passed after module warm-up; this was not evidence of a repair-form regression.
6. Tailwind's automatic source detection included documentation/backend/test content. A controlled Markdown probe containing `w-[12345px]` appeared in generated application CSS; cold transformation took 9.6 seconds, and rewriting the document caused another 9.3-second transform. A second full browser run failed a repeated hard navigation during that delay. Its trace showed slow stylesheet/module requests and the startup screen, not a chart exception. CSS now explicitly scans application sources and the two HTML entry points. The same probe was excluded and the measured transform fell to 921 ms. No approved visual design was changed.

## Browser regression infrastructure

`playwright.local.config.ts` owns its isolated server on port 1437, uses one worker, never reuses another counter server, retains failure traces and disables HMR through a test-only environment flag. Dynamic browser imports of application TypeScript still work; switching blindly to built preview would break those tests.

`tests/fixtures/local-suite-setup.ts` opens the real application in a disposable context to compile/wait for the cold startup module graph before individual workflow assertions. No seeded employee/cart/storage is shared with test contexts. It does not increase every workflow timeout or enable retries. `tests/fixtures/checkout.ts` now waits for the Review/Complete state before acting.

`src/styles/globals.css` uses explicit Tailwind source paths; `vite.config.ts` excludes documentation/test/native files from the test server's watcher. `tests/phase4d-desktop.spec.ts` uses one initial load followed by actual sidebar navigation rather than 16 cold document reloads. It still verifies every viewport, exact page headings, chart behavior and screenshots. Probe evidence is retained in `tailwind-visible-diagnosis.log` and `tailwind-source-scope.log`; the temporary Markdown probe was removed.

The two failures recorded at Phase 5C (payment proof and website/demo reset) passed in the initial 5C.1 full run. That initial serial run was **115/116**, with the separate cold first-page failure retained in `browser-full-initial.log`. A second run was **115/116**, with the repeated-navigation/CSS delay retained in `browser-full-final.log`. The final run uses the corrected source scope and navigation. Final clean run results are recorded in the verification section; earlier unsuccessful runs are not relabeled as passes.

## Immutable local cash evidence

New SQLite migration: `src-tauri/migrations/002_cash_evidence.sql`.

- `cash_evidence` retains original receipt and payload, immutable UUID/invoice, seller, terminal, capture time, tendered cash, change and collected amount in integer minor units.
- `cash_events` is append-only and records attempts/registration/decisions separately from cash evidence.
- Legacy receipts are backfilled without replacing an existing evidence row. Missing/unusable legacy amounts stay unknown; the raw receipt remains available for review.
- Unknown legacy cash amounts are explicitly labeled “Amount needs review” in both the table and inspection dialog. The summary identifies known collected cash separately, flags missing amounts and cannot enable an actual-refund action without a known amount. Missing cash facts are not displayed as PKR 0.
- Receipt, outbox, reservations and evidence are written in one SQLite transaction. SQLite remains WAL + FULL synchronous. A failed local checkout is not acknowledged as a completed transaction.
- Outbox entries and original receipt evidence survive session clearing and employee changes. Authorized owner/manager native reads can discover pending cash from earlier employees at the same backend/shop. Ordinary employee access remains scoped.
- Reservations include other employees' unresolved transactions at the same backend/shop, rather than considering only the current employee's queued sales.
- Restart returns interrupted SYNCING transport to PENDING without changing the UUID or receipt number.
- Successful posting/refunding closes transport and releases reservations but retains the evidence/history. Refund acknowledgment marks the working receipt REFUNDED; original evidence is immutable. Cached server receipts retain the original offline ID.

Original per-sale offline authorization remains in separate DPAPI-encrypted files. Raw authorization is not persisted in SQLite; the queue explicitly removes a supplied `grant` before storage. No employee password or server signing secret was added to the app/database.

Shared production SQL used by both native code and actual SQLite tests lives in `src-tauri/sql/`: `capture-cash.sql`, `reserved-shop-stock.sql`, `list-cash-backlog.sql`, `list-cash-records.sql`, `record-cash-decision.sql`. The records query explicitly projects the immutable original receipt, including legacy outbox payloads that did not embed it.

Native source: `src-tauri/src/{desktop,outbox,cash,lib}.rs`. Frontend adapter: `src/lib/desktop/{database,sales,reconciliation}.ts`.

## Server evidence and transaction recovery

New versioned migration: `server/migrations/202610150200_offline_cash_reconciliation.sql`.

New private objects:

- `app_private.cash_captures`: immutable captured receipt/input, original seller/terminal/time, tender/change/collected amount, canonical payload fingerprint, submitting profile and non-secret signed-authorization facts.
- `app_private.cash_capture_events`: immutable state transitions/decisions with resolver identity, reason and actual refund amount.
- `app_private.cash_capture_state`: latest state plus original evidence.
- `app_private.require_cash_resolver`, `post_cash_capture`, `refund_cash_capture`, `cash_failure`, `cash_summary`, `offline_cash_attribution`.
- `private.offline_cash_summary`; wrappers for existing cash closing, dashboard and transaction reporting.

`CashReconciliationService` verifies the signed offline grant and its capture-time window, validates the cash contract and registers immutable evidence **before** attempting the existing sale engine in a separate transaction. No JWT/refresh token is stored in the evidence. Retries with changed evidence conflict with the original fingerprint.

Posting and refunding lock the shop and capture consistently. Previously committed requests are recognized before current stock/price checks, including recognition across resolver changes. The stored request hash, invoice, total and original seller must match. The same stable `TM-INV-O-<UUID>` invoice is retained; retry does not create another sale/payment/stock deduction.

The existing `public.complete_sale` engine still performs the financial transaction and stock validation. It is not replaced with a second sale engine. The independently authenticated resolver remains the authorization actor. Narrow insert triggers attribute the verified receipt, payment and stock movement to the original seller, and sale/payment capture times to the original capture. `auth.uid()` is never changed to impersonate the seller. Separate resolution/audit events identify who recovered it and why.

Insufficient stock, changed price/tax, permission failure and other validation conflicts remain reviewable with cash retained. Temporary server failures retain cash and allow retry. A reachable server rejection is not labeled a network outage.

### Failure points after cash collection

| Failure point | Retained evidence / required behavior |
|---|---|
| Local write fails before checkout commits, or the disk is lost | The UI must not acknowledge/print a successful checkout. There is no software guarantee for money physically taken before a durable write; staff must keep the failed-sale details and reconcile the cash. Actual power-loss acceptance remains outstanding. |
| Offline queue waits for connectivity | Original receipt, cash facts, reservation and UUID remain in SQLite. No server revenue is invented. |
| Logout, staff switch, expired login or inactive seller | Evidence remains; an independently authenticated owner/authorized manager can recover it without using the seller's expired login token. |
| Original encrypted per-sale authorization is missing before registration | Retain the receipt and report the recovery problem. Do not fabricate authorization or silently delete the collection. |
| Evidence registered but sale rejected for stock, price, tax, disabled configuration or permissions | The server retains collection evidence; the sale stays unposted and reviewable. Resolve the underlying issue and retry, or record an actual full refund. |
| Server/database fault after registration | FAILED — Retry Available; preserve evidence and the UUID. |
| Sale committed but acknowledgment/catalogue refresh fails | Retry recognizes the committed sale. Local acknowledgment precedes catalogue refresh; no second invoice/payment/stock movement. |
| Owner decision fails or its response is lost | Failed retry reason and error are audited. Completed posting/refund is serialized and recoverable from the server decision; do not hand cash back a second time. |
| Receipt remains pending beyond the original shift | Original seller/time remain attached. Late reconciliation is shown alongside the frozen closing snapshot, rather than rewriting counted cash history. |

## Authorization and UI

New permission: `sync.reconcile_cash`. Owner has it automatically. A manager must explicitly receive it; an employee role is still prohibited from reconciling even if that permission is accidentally assigned. Posting through the unchanged sale engine additionally requires the normal sale/discount permissions relevant to that transaction.

The API authenticates the resolver's current session independently. Revoked employee login tokens are not replayed as recovery credentials. A signed offline grant is evidence of a capture-time authorization, not a current employee login token. An expired grant can cover a receipt captured within its signed window; it cannot authenticate an API session.

Both private tables have RLS enabled with no authenticated-client policies. Only the dedicated API runtime has its named server policies and private-function access. The runtime cannot update/delete the immutable evidence/event tables; append-only triggers also prevent mutation. Employee clients cannot invoke private recovery functions directly. Backend/store authorization is checked independently of UI route guards.

Settings → Synchronization contains **Synchronization Exceptions**. It includes original invoice, seller, collected amount, date, status/problem, original receipt/items/customer, cash drawer implications and shop response. Actions require a reason:

- Retry the **same** original receipt after properly resolving stock/configuration issues.
- Confirm an **actual full cash refund**, then close the exception.

Linked replacements/amendments are explicitly unavailable because the existing engine does not implement them. No hidden force-negative-stock action was added. A posted sale must use its existing normal return/refund workflow; it cannot be refunded through the unposted-exception endpoint. Recent resolved records remain accessible, and all unresolved records remain queryable. Specific older local references can be refreshed even if outside the recent completed history window.

Status wording: Pending Sync; Syncing; Synced; Needs Owner Review; Failed — Retry Available; Resolved / Refunded. Recovery of a lost decision acknowledgment updates local transport from the authenticated server decision.

The reason entered for a failed owner retry is retained separately from the server's rejection message, in both an immutable cash event and an `offline_cash.retry_failed` audit record. A red regression test reproduced the previously missing reason before the fix. Managers with only `sync.reconcile_cash` can inspect/resolve these records without unrelated `settings.manage` access; retrying a sale still requires its normal sale permissions. Refunding an unposted collection does not require `sales.create`.

Main UI source: `src/features/settings/{cash-exceptions,desktop-settings,settings-page}.tsx`, `src/components/layout/{desktop-sync,cash-exceptions-notice}.tsx`, `src/hooks/use-cash-exceptions.ts`, and permission definitions/route access.

## Accounting and closing

Physical cash evidence, posted sales and exception refunds are separate. A rejected receipt is not silently counted as posted revenue. The Dashboard shows unresolved retained cash separately from its posted-sales metrics. Shift closing exposes collected/posted/unresolved/refunded cash.

Expected drawer cash starts with existing confirmed payment events, adds only cash captures not already represented by posted sale payments, and subtracts actual exception refunds. Posted offline payments are not added twice. A rejected-sale refund creates an append-only cash event and audit record; it creates **no negative sale and no stock movement**.

Collections remain attributed to the original seller/capture time. A later exception refund is attributed to the resolver who confirms handing cash back, in that staff member's drawer/time window. Closing snapshots that were already closed are not rewritten; late submissions and current reconciliation information are exposed alongside the frozen count. Closed shifts can be inspected through View Closing.

The native closing UI checks the same-shop cash backlog and blocks closing while an employee's retained cash has not been submitted to the backend. This prevents knowingly closing that native drawer without registering retained money. A remote server cannot know about data that has never reached it; physical operating procedures and native acceptance still matter.

Server reporting exposes `offlineCash` metadata and separate physical/posted cash figures without inventing revenue or touching other workflows. The existing online sale engine, returns, credit/payment ledger and append-only stock rules remain in force.

## Verification and evidence

All new server tests use fresh databases on the isolated loopback PostgreSQL fixture **127.0.0.1:55459**. The real shop database/port was not reset or used as a fixture. Logs are under `.test-postgres/phase5c1-20261015/`.

Completed checkpoints:

- Initial financial red tests failed because reconciliation endpoints/evidence did not exist (`cash-red.log`). Subsequent implementation failures were inspected and corrected, including private row-lock privileges and a reserved SQL identifier; unsuccessful logs are retained.
- Targeted reconciliation/import/shift suite: **39/39 passed** (`reconciliation-targeted-2.log`).
- Full custom backend suite on the final server source: **150/150 passed, zero failures/skips**, 339.4 seconds (`backend-full-release.log`). Includes 15 reconciliation tests. The latest test refinements cover failed-decision reasons, a manager refund without sale permissions, and an employee accidentally granted the reconciliation key.
- SQLite: **16/16 passed**: 9 new evidence/backlog/reservation/original-receipt cases + 7 existing durable-outbox cases (`sqlite-final.log`).
- Dedicated reconciliation UI on the final source: **5/5 passed**, 20.0 seconds (`reconciliation-ui-verified.log`). Includes a manager with reconciliation permission while general shop settings return 403, and unknown legacy cash facts that must not appear as zero. The latter test first failed on the incorrect zero-valued dialog (`legacy-unknown-red.log`). Browser transport is mocked; real server behavior is tested separately through HTTP/PostgreSQL.
- Frontend production build passed (`frontend-build-release.log`); backend managed build passed (`backend-build-release.log`).
- Frontend and backend lint passed without errors/warnings (`frontend-lint-release.log`, `backend-lint-release.log`).
- Complete clean serial browser run: **116/116 passed, zero failures, 18.7 minutes**, with no retries (`browser-full-release.log`). Includes the two formerly failing workflows and all approved desktop/mobile regression viewports. Targeted counter/responsive checks also passed **5/5** (`browser-stability-targeted.log`).
- Legacy SQL compatibility baselines passed: security **20**, stock **14**, transactions **25** (`security-baseline.log`, `stock-baseline.log`, `transactions-baseline.log`). These run the retained legacy SQL fixtures; the custom backend's current migrations are covered by its separate 150-test suite. No hosted Supabase service was used.
- Separate real PostgreSQL concurrency runner: **2/2 scenarios passed** (`concurrency-state-wait.log`). Its old fixed 150 ms sleep was replaced by waiting for the actual `pg_blocking_pids` state; this verifies the intended lock rather than assuming process timing.
- Client privileged-key rejection boundary passed (`client-boundary-final.log`). Rust formatting check passed (`rust-format-final.log`); native compilation remains blocked as explained below.
- Tauri CLI configuration/icon/capability schema check passed (`tauri-config-final.log`). This does not compile Rust or launch a native window.

The final backend log was completed at **20:45:45**, SQLite at **20:25:06**, the complete browser run at approximately **20:53**, and the final focused UI run at approximately **20:57** on 15 October 2026, Asia/Karachi. These are this phase's executions, not repeated historical claims. The disposable PostgreSQL fixture on port 55459 was stopped cleanly after backend/concurrency verification; no shop server was stopped.

The 116 cases are the complete isolated local browser suite defined by `playwright.local.config.ts`, not every live-service/device spec in the repository. There are no remaining failures in that verified fixture. It remains relatively slow (18.7 minutes with one worker); arbitrary parallel execution against a shared counter is not claimed stable. The final small legacy-amount wording/nullability correction was made after that complete run and verified with all five focused reconciliation cases plus fresh frontend build/lint; the 116-case run was not needlessly repeated for that isolated presentation change. UI fixtures intentionally leave the device WebSocket target at unused port 39999, so their server log includes expected connection-refused proxy messages; they do not verify live device pairing.

### Reproduction commands

From the project root with the existing dependencies installed:

```powershell
npm run build
npm run lint
npm run test:local
npx playwright test --config playwright.reconciliation.config.ts
node --test scripts/test-cash-evidence.mjs scripts/test-desktop-sqlite.mjs
npm --prefix server run build
npm --prefix server run lint
npm run validate:tauri
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

The backend/concurrency suites require a **disposable PostgreSQL cluster**, with permission to create/drop their uniquely named fixture databases. This phase explicitly overrode the legacy test default; never point these commands at production:

```powershell
$env:TAHA_TEST_POSTGRES_URL = 'postgresql://taha_phase5c@127.0.0.1:55459/postgres'
npm --prefix server test
npm run test:concurrency
```

Start the isolated fixture before those two commands. No production migration/reset is part of these test instructions. The browser fixtures own ports 1437/1438 and intentionally refuse an existing server; close a leftover fixture using that port before retrying, rather than attaching to an unknown counter instance.

`server/test/cash-reconciliation.test.ts` tests paid evidence, successful synchronization, lost acknowledgment, duplicate/concurrent retries, stock failure/resolution, logout, deactivation, independent owner/manager recovery, actual SQLite close/reopen during sync, refunds, closing/reporting, no duplicate inventory/invoices/payments, authorization denial, append-only records, refund/post races, late closed-shift recovery, temporary server failure and unchanged online sale behavior. One integration case actually writes/reopens a SQLite file, submits the restored payload through HTTP into PostgreSQL, discards the first successful acknowledgment and retries the same UUID.

SQLite tests execute actual versioned schema/shared native SQL, not mocked localStorage. They do **not** execute Tauri IPC, DPAPI or a compiled Windows process. Browser UI tests mock transport; they do not prove native crash recovery or physical cash handling.

Required scenario coverage:

| Scenario | Executed evidence | Native physical result |
|---|---|---|
| Offline paid cash retained | SQLite transaction/evidence tests; SQLite-to-HTTP integration | Unverified |
| Successful synchronization | Real PostgreSQL/HTTP import and stable receipt assertions | Unverified |
| Commit followed by lost acknowledgment | Discard first successful HTTP result; retry same restored SQLite payload | Unverified |
| Duplicate retries | Concurrent HTTP requests; one invoice/payment; legacy two-connection runner | Unverified |
| Stock insufficient at sync | Real Parts product, zero stock; owner review; proper adjustment then retry | Unverified |
| Employee signs out | Real logout revokes session; evidence retained; independent owner recovery | Unverified |
| Seller deactivated | Inactive seller cannot authenticate; current owner recovers original attribution | Unverified |
| Owner/manager recovery | Real independent sessions, reason/permission checks, original seller vs resolver | Unverified |
| Restart during sync | Actual SQLite close/reopen with interrupted SYNCING state and unchanged UUID | Unverified |
| Refund rejected collection | Real cash decision/audit; no fictitious sales/stock; SQLite evidence retained | Unverified |
| Correct cash closing/reporting | Retained vs posted vs refunded totals; later resolver drawer; frozen closed shift | Unverified |
| No duplicate stock effects | Explicit movement count and remaining quantity after retry | Unverified |
| No duplicate invoice | Unique UUID/invoice plus repeated/concurrent import assertions | Unverified |
| Unauthorized reconciliation denied | Employee/manager denials; role restriction; dedicated UI guards | Unverified |
| Existing online sales unchanged | Ordinary numbering, no offline capture, existing backend/legacy financial suites | Unverified |

## Native status and actual limitations

- Rust `1.99.0`, Cargo `1.99.0`, active `stable-x86_64-pc-windows-msvc` were observed.
- `cargo check --locked` failed at native build-script linking. The resolved `link.exe` is Git's Unix utility, not MSVC; its output is `link: extra operand ...`. `vswhere.exe`, the normal Visual Studio installation directories, the Windows Kits registry root and `C:/Program Files (x86)/Windows Kits/10/Lib` are absent. A usable MSVC C++ toolchain and Windows SDK must be installed/configured before native compilation.
- Rust formatting/parsing checks are available; successful Rust type checking, a new EXE/MSI/NSIS build and native physical acceptance are **not claimed**. No toolchain/SDK installation was performed.
- Actual power interruption, Windows session changes/DPAPI, native receipt printing, EXE launch offline, real phone pairing and hardware are still unverified for these changes. No new APK was produced in this financial phase.
- Same OS-user access to AppData is not tamper-resistant accounting hardware. Cash evidence avoids accidental application deletion and provides server validation/audit; local disk modification, disk loss and clock manipulation remain part of the documented offline threat model. The server signed grant bounds capture time but cannot independently prove when physical cash changed hands.
- If the original per-receipt encrypted authorization is missing/corrupt before any server registration, retain the local receipt and seek controlled recovery. The implementation does not manufacture a grant or silently post unverified evidence.
- Legacy migration can retain the original snapshot still present on disk; it cannot reconstruct history overwritten before this phase. New captures preserve their original snapshots independently of the working receipt cache.
- The existing offline-grant endpoint requires a named online staff sign-in. A shared-terminal/PIN-only context does not currently issue this authorization. This guard was preserved; offline PIN-session issuance needs explicit native acceptance/design work, not bypassing authentication.
- Exception reconciliation/refund decisions require the backend and a current authenticated resolver. No offline administrative refund workflow was introduced. A lost refund response can be recovered idempotently, but software cannot prove that physical cash was handed back; staff must confirm the actual refund once.
- No offline credit/electronic confirmation, price/cost editing, stock receiving/adjustment or permission administration was added. These remain online-only. Photo-queue lifespan and other previously documented mobile/hosting work are unchanged.
- Changed price/tax snapshots require proper reconciliation or actual refund. No unsupported historical amendment is silently generated.
- Production has not been migrated/deployed. Applying the new server migration and dedicated runtime grants is required before deploying this client; use the existing controlled migration process and restart the backend. This phase only exercised isolated databases.

## Next phase

**Windows native build and offline acceptance**: provide MSVC C++ Build Tools and Windows SDK, compile/run the real Tauri application, and execute paid-cash/restart/logout/stock-conflict/refund/reconnect/lost-response/shift-closing scenarios against an isolated backend. Verify local receipt printing and native customer display without risking real shop money. Only after that acceptance, proceed to hosting preparation using the confirmed managed Node hosting plan and PostgreSQL choice. No Hostinger VPS assumption or deployment is introduced here.
