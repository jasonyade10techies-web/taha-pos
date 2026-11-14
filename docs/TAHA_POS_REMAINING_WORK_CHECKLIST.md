# Taha POS remaining work checklist

Evidence updated: **14 November 2026** (earlier sections retain their historical dates). Root: `D:\Inventory system POS`. This checklist records the original audit and subsequent authorized R1/R2A implementation. Historical results are labelled; only the current completion section controls the next work. See `TAHA_POS_COMPLETE_HANDOFF_2026-11-11.md` for architecture, test boundaries and history.

## Latest controlling checkpoint —R3A

Branch `codex/r3a-release-system`; private repository `jasonyade10techies-web/taha-pos`, draft PR1. Build13/application24aecd7fc1fbbffb091fc779667169e9b4dd1498, tag `r3a-source-build13`, APK/download ZIP/full POS package and recovery copies are ready. Dashboard Download App and Devices install QR are implemented. Hosting remains manual; no deployment occurred.

**Remaining before source promotion:** review complete CI run43607701944 at39eebefd2188cd59b1ccd5ed00e62b454baa53e8. It is PENDING at owner departure, not a claimed pass. Its test-harness readiness correction has4/4 targeted passes and fresh types/lint, with no retries/assertion weakening. See the R3A report for earlier failed and passed runs separately. GitHub can finish this run without the chat remaining open.

After that: manual HTTPS download-site acceptance, physical build11→13 retention and subsequent higher-build updater test, then separate full hosted POS acceptance. Windows/native offline, physical printer/HID/second display, stable signing/key custody and repair-job accounting remain daily-use gates. Older dated sections below are retained historical evidence, not the current branch/status.

## Current local release hardening — 14 November 2026

The owner has **paused hosting/account/deployment activity**. Continue local completion and verification; do not contact hosting accounts, deploy, buy services or change DNS. Earlier R2C hosting instructions below are historical and do not override this scope.

Branch: `codex/release-readiness`, based on `8851ac9be012387a9def620aaf661de7789640b0`.

- [x] Isolate corrupt Android queue records; healthy photos remain available. New binary saves carry SHA256/length metadata and an interrupted-commit journal. Identical retries cannot overwrite another capture or fail merely because the queue is full.
- [x] Preserve native camera originals in app-private durable storage across Activity/WebView recreation; offer explicit gallery copy/discard instead of guessing a request assignment. Partial/empty originals remain reviewable. Actual OS-kill/camera acceptance is still required.
- [x] Add damaged-record warnings and recovery diagnostics; preserve ambiguous bytes rather than delete them. Older records without checksums cannot acquire historical integrity proof retroactively.
- [x] Correct browser cookie-operation coordination across tabs and navigation, using Web Locks, keepalive refresh and a nonsecret bounded in-flight marker. Strict server replay revocation is retained. A truly lost response may still require sign-in; no replay grace was introduced.
- [x] Make `npm test` run both isolated frontend and API-reconciliation profiles. Add a guarded `verify:release` command, refusing the saved shop cluster and remote database targets.
- [x] Exact clean-commit package `0.5.0-r2c.5`, source `5c1af83f3441482e4882bf95802fee24648b6665`, passes26/26 compiled-app cases and345 ZIP/payload hashes. Full frontend189 passed/1 intentional skip plus5 reconciliation; full backend280 plus2 startup checks; Android35. See the dated local readiness report for exact artifact hashes and evidence.
- [ ] Physical Android camera/gallery/scanner/pairing/lock-resume and process-death acceptance; production signing remains separate.
- [ ] Windows native build and acceptance: Rust/Cargo/WebView2 exist; MSVC/Windows SDK are missing. No installer is claimed.
- [ ] Repair-job material consumption, deposits/settlement/refunds and expense-adjusted net profit require a separate financial implementation and persisted-state acceptance. Smart-service POS accounting is a different, tested workflow.
- [ ] Printer/HID scanner/second monitor/native offline acceptance; historical missing-image recovery; off-machine restore/operations acceptance.
- [ ] Cloud environment and public cross-device acceptance remain deferred by owner instruction. Local package success is not deployment or production certification.

See the dated local readiness report for fresh results and limitations. No saved shop data or historical recovery archives were changed.

## Phase R2C — current preparation status (13 November 2026)

Branch `codex/r2c-hostinger-staging`, preserving the R2B documentation checkpoint `f408a59ad15b5cb4b035e9ac5e38945ba5b4d3ec` and tested implementation `6bea29a59a767802635ae0213154c8345c5381c1`. **Not deployed; no public staging URL.**

- [x] Guarded first-owner initialization creates no sample business activity, refuses occupied databases and repeated/concurrent initialization, and closes public bootstrap. Seven isolated tests pass.
- [x] Existing six-stage Shop Setup reused for fresh API owners on desktop/mobile, with persisted progress, optional tools, payment/storage links, zero-tax review and empty Dashboard.
- [x] Migration registry now **69**, with a new immutable private initialization marker. Historical 68-migration R2B packages remain preserved.
- [x] Full backend rerun **269 passed / 0 failed / 0 skipped**, 13 Nov 14:49–15:02 PKT. Recovered MediaService remains frozen.
- [x] Latest full isolated frontend **187 passed / 1 intentional API-only skip / 0 failed**, 13 Nov **17:15-17:38 PKT** after the setup busy-link fix. Dedicated API reconciliation **5/5** also passes. Initial complete fresh-shop packaged rehearsal **25/25**, including stored financial assertions and actual isolated backup/restore.
- [x] Latest clean-commit `.3` package **25/25**, all 345 CRC/payload hashes and private-file scans pass. Implementation `88b6076e3e6ab6940ab0cb96373ead9324193b46`; actual packaged startup/restart, persisted financial/media assertions and isolated backup/restore accepted locally. Exact ZIP/provenance in the R2C test report.
- [ ] Investigate rapid page interruption during refresh-token rotation: one immediate navigation/reload rehearsal returned to login. Normal settled-page reload is tested separately. Do not weaken token replay protection to conceal this case.
- [x] Approved **Neon Free** project `taha-pos-staging`, PG17 `taha_staging`, private `taha-staging-private` created. CLI authenticated through keyring; 69 migrations, restricted runtime and actual client TLS pass; four real private storage/POST tests pass. Empty base has no owner/business history. No paid add-ons.
- [x] Managed-role/TLS compatibility regressions fixed, full backend **279/279** passes, latest backend typecheck/lint pass. MediaService and historical financial SQL remain unchanged.
- [x] Separate synthetic Neon acceptance branch: actual pooled financial/media API **10/10**, auth **3/3**, populated provider SQL restore matches **all 76 application tables**, grants/RLS/constraints, and three-object private recovery passes.
- [ ] Complete public-hosted browser CORS, shared internet sessions and clean-owner acceptance. MCP plugin is now installed/exposed but first calls return `Unknown tool`; authenticated CLI works. No app env or user Codex config was overwritten.
- [ ] Hostinger Unlimited account alignment and remaining Node slots/proxy/resource usage. Official docs now explicitly list Unlimited with five Node apps and Node 22/24, NestJS, ZIP/temporary-domain support. No account-specific remaining allowance is inferred.
- [ ] Real Hostinger/cloud acceptance: public HTTPS, provider roles/TLS/pooling, signed POST/CORS/privacy/durability, fresh setup, two sessions, financial SQL assertions and backup/restore. No local or physical result replaces these gates.

See `TAHA_POS_R2C_HOSTINGER_DEPLOYMENT.md`, `TAHA_POS_R2C_CLEAN_SHOP_ACCEPTANCE.md`, `TAHA_POS_R2C_CLOUD_TEST_RESULTS.md`, and `TAHA_POS_R2C_REMAINING_PRODUCTION_WORK.md`. Native Android/Windows, repair accounting and physical hardware limitations below remain open. No purchase, DNS change, public Git push or saved-shop migration is authorized by this preparation.

## Phase R2B completed — historical status (13 November 2026)

Local implementation and acceptance completed on `codex/r2b-cloud-staging`, preserving R2A `2955c204b645ef9d11a8ef78be88f81f36e915f0`. Release implementation is `6bea29a59a767802635ae0213154c8345c5381c1`; later documentation checkpoint does not change the tested application. See `TAHA_POS_PHASE_R2B_REPORT.md`, `TAHA_POS_R2B_TEST_RESULTS.md`, `TAHA_POS_HOSTINGER_STAGING_RUNBOOK.md` and `TAHA_POS_DEPLOYMENT_DEPENDENCIES.md`.

- [x] **Full frontend rerun**: 187 passed / 1 intentional API-only skip / 0 failed, exit 0. R2A's full-run failure is no longer an open regression gate.
- [x] **Full corrected backend**: 262 passed / 0 failed / 0 skipped, exit 0; typecheck, lint and combined frontend/backend production build pass. Runtime audits zero known advisories.
- [x] Durable, transaction-bound per-store revisions cover repair jobs, shifts and other shared mutation gaps. Real permissions, rollback, concurrent commit order and missed notification tests pass.
- [x] Shared HTTPS polling with single-flight, scoped cursors, paging/reset, abort/stale-response protection, visibility/backoff, reconnect and cache invalidation. Existing LAN bridge retained independently.
- [x] Real deep readiness checks schema/checksums/functions/RLS/runtime grants/TLS configuration/authentication/private storage. Public liveness and readiness are separate.
- [x] Active PostgreSQL client termination no longer crashes the API; failed transactions reject without a blind financial retry. Real outage and reconnect acceptance passes.
- [x] Frozen recovered MediaService hash preserved; private originals/thumbnails/uploads remain. Deep object privacy/CRUD fixture checks and read-only historical inventory tooling added.
- [x] Same-origin compiled Nest + React staging package, guarded separate migration/seed, synthetic sample history, manifest/hash/secret inspection, smoke and rollback instructions.
- [x] **16/16 production-style local package checks**: real authentication/DB/files, desktop/mobile shared updates, financial invariants, restart, catch-up, DB/storage failures. No Vite/demo data substituted for online acceptance.
- [x] Verified private source ZIP/Git bundle on C and D with independently cloned object integrity. Saved shop port 55439 and earlier recovery archives untouched.
- [x] Isolated real localhost: frontend `http://127.0.0.1:1423/dashboard`, API `http://127.0.0.1:3306/api/v1`, readiness ready and 68/68 migrations matched. Loopback-only fixture; no physical phone acceptance.
- [ ] **R2C staging gate:** selected Unlimited account entitlement/remaining Node slot, trusted proxy, domain, external PostgreSQL/roles/pool/TLS and private object POST/CORS/backup capabilities must be verified and approved. Current entitlement UNKNOWN; no cloud resource provisioned or deployment performed.
- [ ] Historical missing originals: retain truthful placeholders and metadata; run a separately approved read-only inventory/reconciliation. Do not fabricate or delete history.
- [ ] Android corrupt-item queue isolation and camera process-recreation recovery; rebuild/sign and physically accept APK. Shared polling source changes are not in an already-installed old APK.
- [ ] Windows MSVC/SDK toolchain/native build/installer, SQLite offline launch/cash/receipt/outbox/reconnect acceptance. Source/SQL tests do not prove native operation.
- [ ] Physical printer, USB/HID scanner, customer second monitor, phone pairing/camera and LAN-without-internet acceptance.
- [ ] Repair-job materials/deposits/settlement and expense-adjusted net-profit scope/accounting; separate controlled phase before relying on those workflows in production.
- [ ] Hosted backup/restore, monitoring, signing, real payment-account checks and daily-shop release acceptance.

**Next:** R2C — approved isolated Hostinger staging deployment and real-provider acceptance. No further UI redesign or repetition of R2A is needed. Production/hardware acceptance remains separate.

## Phase R2A completed — historical status

R2A is implemented on `r2a-counter-corrections`, descending from preserved R1 commit `fed76251bb7c5f3de89d58ee76a248a23db2402a`. See `TAHA_POS_PHASE_R2A_COUNTER_CORRECTIONS_REPORT.md` and `TAHA_POS_PHASE_R2A_TEST_RESULTS.md`. The final local commit and independently verified private bundle are recorded in ignored `.test-postgres/r2a-20261111/git-checkpoint.json` and the owner response. No push, deployment, APK/installer build or saved-database migration occurred.

- [x] Restored the archived PostgreSQL cluster into a private disposable copy, verified all 60,378 file hashes, 64 migrations, 195 FK relationships and financial checks, then stopped the copy. Saved port 55439 was not started.
- [x] Short prefixes, aliases, SKU/barcode identity and service search; keyboard/HID-style Enter and touch-compatible counter actions.
- [x] Blank custom service charge remains unset; explicit zero remains visible and rejected by the existing positive-charge policy; reviewed material/labor allocation is preserved.
- [x] Separate damaged/quarantine POS quantity and authorized inspection, without changing available stock.
- [x] Sole eligible return selection; bounded partial returns, paid/manual and credit-only return explanations, method choice, stale-reviewed-amount rejection and retry safety.
- [x] Invoice/receipt/link/customer/reminder clipboard with selectable fallback; explicit WhatsApp browser destination with blocked-popup feedback. Actual native opening or delivery remains unverified.
- [x] Explicit-null template unlink, repeated unlink, immutable old invoice and new sale with no old material deduction.
- [x] Fresh backend **224/224**, real-API browser **10 unique cases** (nine-case run plus one credit-only return), persisted SQL assertions for ten groups, launcher **9/9**, SQLite **7/7**, typecheck/lint/build gates.
- [x] Existing broad local browser run: **186 pass / 1 fail / 1 intentional skip**, followed by the affected legacy WhatsApp case passing with original phone/message assertions retained. **187 unique cases pass**, not a claim that the full-run exit was green. PDF coverage passed.
- [x] Real API/auth fixture available at frontend `http://127.0.0.1:1423/dashboard`, API health `http://127.0.0.1:3306/api/v1/health`, disposable PostgreSQL 55459. No LAN/mobile availability claim.

**Historical R2A next step (now completed):** R2B synchronization/readiness corrections and staging packaging. The R2B section above controls current next work. Production remains blocked by the rows in section B and the unchanged Android/native/accounting gaps below. Native apps/hardware/actual WhatsApp sending are not certified by browser tests.

## Phase R1 implementation update

The owner subsequently authorized recovery. The all-NUL MediaService is now **reconstructed and buildable**, with original forensic bytes and verified private backups retained. The full backend suite passes **203/203**, with zero skipped/failed. Targeted runtime advisories were patched; frontend and backend `npm audit --omit=dev` both report zero findings. An explicit identity-verified `--isolated` launcher starts real API/auth on 3306 and frontend 1423 against disposable PostgreSQL 55459 without consulting saved 55439 data. The browser suite has 187 unique passing cases across the full run and unchanged PDF rerun, plus one intentional API-only skip; the full run's single failure was missing `pypdf` in the default Python. Three fresh real-API browser journeys, eight launcher tests and seven SQLite source/SQL checks also pass. See `TAHA_POS_PHASE_R1_RECOVERY_REPORT.md` for source-control status and exact evidence. No physical/native acceptance or deployment is implied.

The older table entries below describe the audit starting point; resolved R1 recovery/dependency rows are no longer blockers. Those corrections were deliberately excluded from R1 and the first eight have now been implemented and tested in R2A.

| Correction | Current classification (R2A overrides historical R1) | Evidence / remaining acceptance |
|---|---|---|
|1.Short-prefix @Product search|**Working — tested in R2A**|Frontend/backend parity and actual one/two/three-character, alias/model/SKU/barcode/keyboard browser tests.|
|2.Blank service-price semantics|**Working — tested in R2A**|Blank vs explicit zero vs reviewed charge; no false blank breakdown; financial constraints preserved.|
|3.Damaged count on New Sale cards|**Working — tested in R2A**|Safe projection/card, separate unavailable quantity, touch/history and stored condition ledger.|
|4.Only returnable item auto-selection|**Working — tested in R2A**|Single line defaults, zero/multiple rules preserved; partial/credit-only UI and SQL guards.|
|5.Manual refund/credit explanation|**Working — tested in R2A**|Before/after debt, method/payout, credit-only no payout, stale preview rollback and retries.|
|6.Copy Message fallback|**Working — browser verified R2A**|Actual clipboard plus manual selectable fallback; native OS acceptance still required.|
|7.WhatsApp opening|**Working — browser verified R2A; native unverified**|Actual intercepted popup/normalized destination/message, blocked feedback; no send/delivery claim.|
|8.Saved template unlink|**Working — tested in R2A**|Explicit null vs omission, repeated unlink, unchanged old sales, new unlinked sale with no material deduction.|
|9.Repairs/shifts cloud revision|**Confirmed broken** missing durable invalidation|P1;permission-scoped revisions/two-session tests.|
|10.Cloud readiness/object probe|**Confirmed broken** as comprehensive acceptance gate|P1;current schema/grants plus private object write/read/delete; no secret output.|
|11.Android corrupt-photo queue|**Confirmed broken**, synthetic3→0despite2valid retained|P1;per-record isolation/atomic retention and corruption recovery.|
|12.Android camera process recreation|**Requires hardware**, source recovery gap|P1;persist capture state, actualOSkill/return/resume proof.|
|13.Missing historical media|**Confirmed broken** historical originals not recovered; current count unverified|P1;metadata/object inventory, recover originals if available, truthful missing display/backups.|
|14.Repair-job accounting|**Later feature only if excluded from launch**; required before collecting repair money|P1ifused;deposits/parts/settlement/refund ledger, preserve rejected unsafe advances.|
|15.Windows native/offline acceptance|**Requires hardware/toolchain**, no native artifact|P1;MSVC/SDK/build/install thenSQLitecash/DPAPI/printing/display/restart acceptance.|

The owner-selected Hostinger browser plan is now verified as **Unlimited**; the connector exposes a different Business-v3 inventory. Do not deploy until account alignment/domain/externalPostgreSQL/private storage decisions and acceptance are resolved.

Priorities: **P0** blocks use/data integrity/security; **P1** before production; **P2** important usability/operations; **P3** later enhancement. Complexity: Small/Medium/Large. A checked test below means only that identified gate passed, not a completed product.

## Current baseline

- [x] Frontend typecheck, lint and ordinary production build pass on 11 November.
- [x] Focused cloud-browser fixture tests 7/7, cloud config contracts 28/28.
- [x] Isolated backend non-DB tests 16/16; compound/seed PostgreSQL tests 12/12.
- [x] Separate-connection legacy last-unit/retry concurrency runner 2/2 checks.
- [x] SQLite/cash evidence tests 16/16; Android JVM tests 24/24.
- [x] Existing APK build 10 checksum/debug signature and 57/57 bundled assets verified.
- [x] Backend can build/run: MediaService reconstructed inR1; connected real health verified.
- [x] Full current backend API/auth/media/financial suite:203passed,0failed/0skipped on isolated55459. Hosted/native/hardware acceptance remains separate.
- [ ] Native Windows EXE/installer exists and is accepted.
- [ ] Android production signing and physical acceptance.
- [ ] Hosted Taha frontend/API/PostgreSQL/private objects accepted.
- [ ] Daily shop production readiness.

## A. Before a convincing functional demonstration

| Priority / complexity | Problem and current status | Required scope / source | Dependencies | Verification / completion criterion |
|---|---|---|---|---|
| Resolved in R1 | MediaService corruption blocked the complete API | Reconstructed against the October source, later fragments, current contracts and tests; forensic original retained | Private verified backups retained | Backend typecheck/lint/build and all 203 backend tests pass; private-media/direct-upload/race coverage retained. See R1 recovery report. |
| Local demonstration available; hosted demonstration pending | Reproducible isolated real-API localhost now works | `node scripts/start-local-acceptance.mjs --isolated`; frontend 1423, API 3306, isolated PostgreSQL 55459 | Keep fixture services running; saved database remains stopped | R2A now covers ten unique real-API browser cases and persisted stock/credit/media assertions. This loopback fixture does not provide a LAN-phone or public-cloud demonstration. |
| Resolved in R2A | Search correction | Existing implementation corrected; exact paths in R2A report | R2A baseline retained | Fresh focused/API/browser/SQL verification passes. Native and physical acceptance remain separate. |
| Resolved in R2A | Blank custom charge correction | Existing implementation corrected; exact paths in R2A report | R2A baseline retained | Fresh focused/API/browser/SQL verification passes. Native and physical acceptance remain separate. |
| Resolved in R2A | Safe damaged projection/card | Existing implementation corrected; exact paths in R2A report | R2A baseline retained | Fresh focused/API/browser/SQL verification passes. Native and physical acceptance remain separate. |
| Resolved in R2A | Single eligible return selection | Existing implementation corrected; exact paths in R2A report | R2A baseline retained | Fresh focused/API/browser/SQL verification passes. Native and physical acceptance remain separate. |
| Resolved in R2A | Return financial review | Existing implementation corrected; exact paths in R2A report | R2A baseline retained | Fresh focused/API/browser/SQL verification passes. Native and physical acceptance remain separate. |
| Resolved in R2A | Explicit-null template unlink | Existing implementation corrected; exact paths in R2A report | R2A baseline retained | Fresh focused/API/browser/SQL verification passes. Native and physical acceptance remain separate. |
| Resolved in R2A | Clipboard/browser external actions | Existing implementation corrected; exact paths in R2A report | R2A baseline retained | Fresh focused/API/browser/SQL verification passes. Native and physical acceptance remain separate. |
| P1 / Medium if camera demo | Corrupt pending-photo metadata hides valid queued photos | `mobile/android/.../PendingPhotos.java`, recovery UI | Existing synthetic corruption evidence | One corrupt record isolated; other valid images remain visible/uploadable/exportable; explicit damaged-record recovery/discard, no silent wipe. |
| P1 / Medium if remote demo | No public self-contained demo URL | Isolated compatible staging only after target verification | Hostinger plan/domain/PostgreSQL/private storage; recovered builds | HTTPS login from independent browsers, shared stock/sales/receipts/images with PC off, no real customer fixtures/default production passwords. |

## B. Before daily shop use

| Priority / complexity | Current gap | Scope and files/modules | Dependencies | Required verification |
|---|---|---|---|---|
| Resolved findings; ongoing maintenance | Known runtime dependency advisories patched in R1 | Targeted root/server manifests and lockfiles; exact versions/advisories in `r1-dependency-evidence.md` | Preserve lockfiles and future advisory monitoring | Fresh frontend and backend runtime audits report zero known findings; malformed-iframe regression and builds pass. This is not penetration-test certification. |
| P1 / Medium | No compatible target/resource proof | Hostinger plan/Node limits; external PostgreSQL role/extension/TLS; private object provider | Owner plan/domain/provider choice | Actual build/start/health and provider-specific capabilities, not a plan marketing name. |
| P1 / Medium | Hostinger routing/session wiring not implemented | Managed build/package, same-origin static/API or proven proxy, SPA/assets routing, secure cookies/origins | Target architecture agreed | Deep routes refresh; `/api` never returns index.html; secure refresh/logout/independent sessions; no cache of protected responses. |
| P1 / Medium | Pure repair-job/shift changes do not propagate in cloud | SQL revision triggers, `SyncController` permission map, workflow tests | Fresh current migration; cloud polling | Two sessions see create/edit/closing without unrelated event or manual reload, without data/permission leaks. |
| P1 / Medium | Readiness only checks 3 tables/HeadBucket | `HealthController.ready`, schema/checksum/runtime grant/object probe | Recovered media/provider | Incomplete migration/permissions/storage write/read/delete fail readiness; no secrets returned. |
| P1 / Medium | Cloud media never provider-accepted; old local bytes missing | Recovered media grant/completion, S3 POST/CORS/lifecycle, metadata/object inventory | Approved private provider; original backups where available | Actual large upload, MIME/hash/size/content validation, owner/store isolation, replay/expiry/cancel/restart retrieval; truthful missing-image fallback. |
| P1 / Medium–Large | Backup/restore/monitoring not operational | PostgreSQL and object backups, secrets recovery, restore/rollback runbook, uptime/error/disk alerts | Real providers; retention/recovery objectives | Restore database+objects to disposable target, log in/reconcile money/stock/receipt media; recover without shop PC or a single laptop copy. Catalog listing a dump is insufficient. |
| P1 / Large | Windows product uncompiled | MSVC Desktop C++/WindowsSDK installation later, Tauri build/dev/install, icons/splash/single instance/window state | Authorized tools; real public release URL | Actual EXE+NSIS/MSI artifacts and install/uninstall/update-data preservation; bundled UI/offline launch and crash recovery. No system installation during audit. |
| P1 / Large | Native offline financial chain not accepted | Rust IPC/DPAPI/SQLite/outbox/reconciliation/closing; printer | Built native app; isolated server | Offline launch, cash receipt, restart, logout/owner recovery, duplicate/lost ack, stock conflict/post/refund race, closed-shift recovery; stable invoice and exactly-once effects. |
| P1 / Medium–Large | Android retention/lifecycle not durable enough | Atomic photo/metadata writes; per-record queue recovery; MainActivity capture URI/result recreation | Recovered server; test phone | Physical OS kill/camera return/lock/resume/upload interruption; every retained photo visible/recoverable, no unintended duplicates. |
| P1 / Medium | Android release not prepared | Release signing/key custody, final HTTPS endpoint and proper build/version delivery | Staging stable; owner signing custody | Verified release signature/package/update behavior, no debug HTTP/security settings in release, hardware/camera/scanner/gallery/share/cloud/LAN/revoke acceptance. |
| P1 / Medium–Large | LAN bridge not packaged/supervised with EXE | Explicit separate local Nest/PostgreSQL service or bounded packaging plan | Native app and shop architecture | EXE-origin QR/pairing, phone requests/photos with internet down but LAN up, restart/reconnect and correct field insertion. No implicit cross-host token handoff. |
| P1 / Medium | Hardware acceptance missing | White80mm/A4, Windows/WebView printer, optional ESC/POS transport, USB HID, native display | Printer/scanner/second monitor access | Actual readable QR/paper/cut/layout, HID input, native display fullscreen/geometry/privacy/disconnect. Browser preview is not physical acceptance. |
| P1 / Medium | Auth/permissions/session lost-phone acceptance incomplete | Auth/PIN/companion policy, RLS/cost/profit/media, OS vault | Full server/native/staging | Unauthorized employee cannot obtain costs/profit/proof; switching/logout/revoke removes authority; cloud cross-user sessions isolated; no default fixture password. |
| P1 / Medium | Production migration/pilot unplanned | Approved opening balances, stock locations/conditions, payments/tax/roles, pilot runbook | Owner operational settings, accepted backups | Opening totals reconcile, daily cash/credit/returns/stock close matches independent records, rollback/recovery practical. |

Mobile offline checkout is **not implemented** as a phone financial outbox. Decide explicitly whether launch requires it; otherwise document online-only mobile sales. Do not promise offline phone sales based on desktop SQLite or browser demo behavior.

Repair deposits/parts job settlement and full expense accounting are incomplete. If used in daily launch, scope and test them before launch; otherwise keep unsupported repair advances rejected and label reports gross profit. Do not accept cash through a form that lacks a ledger.

## C. Later enhancements, only if excluded from initial operational scope

- [ ] P3 / Medium: extra dashboard density/visual refinements, after actual target-device review; preserve approved layout.
- [ ] P3 / Medium: richer product variant matrix and full API spreadsheet/bulk workflows.
- [ ] P3 / Medium–Large: background push and transparent cloud/LAN handoff with explicit trust model.
- [ ] P3 / Medium: signed application updater; never insecure automatic updates.
- [ ] P3 / Medium–Large: full expense register/net-profit accounting and complete repair settlement, if the shop deliberately launches without these workflows.
- [ ] P2 / Small–Medium: remove unused Supabase runtime/bundle dependency after compatibility tests are preserved; custom production must not rely on Supabase.
- [ ] P2 / Small: update stale README ports/version/phase guidance and finish a current short operator/demo guide after real acceptance.

## Manageable sequence

1. **Completed R1:** recover backend source and establish the protected baseline.
2. **Completed R2A:** owner-visible search/charge/condition/returns/reminder/template defects and archived-database restore rehearsal.
3. Verify purchased Hostinger capabilities and prepare one isolated staging path; deploy only under a later explicit implementation request.
4. In parallel after recovery: Windows toolchain/build acceptance and Android photo/release work.
5. Hosted shared-data/private-media/restore acceptance, physical apps/hardware, then controlled pilot.

Owner inputs still needed: approved domain, external PostgreSQL/object storage/backup choice, physical printer and device access, later Windows prerequisite installation authorization. The browser Unlimited plan was selected; its usable Node limits and connector/account alignment still require verification. No secrets should be pasted into the planning chat.


## R3A — source/release foundation (14 November2026)

- Private source baseline is retained at jasonyade10techies-web/taha-pos; owner elected manual hosting.
- Downloads-only server, manifests/verified APK packaging, native update policy/UI, source-root POS build and CI workflows implemented. See R3A report and owner setup for exact acceptance/artifacts.
- Full fresh frontend197 passes/1 intentional skip; backend284 passes. Final preconnection navigation correction has4 focused passing cases; no combined198-pass full local claim. Release-system17 tests pass. Final build13 managed package passes26/26 compiled acceptance checks, including persisted financial assertions and backup/restore. Local/native automated checks are separate from physical/cloud acceptance.
- GitHub Actions43599209459: Android validation passed, complete browser193+5=198 passed/1 intentional skip, backend284 passed. Overall regression failed afterward because the credential scan needed `dist/assets` before the frontend build step. The build now precedes that unchanged security check; fresh full CI acceptance remains required. Earlier runner setup failures and corrections remain documented.
- Subsequent43605115593: Android/backend green; browser192 passed/1 failed/1 skipped, with aborted390px dark navigation. A deterministic blocked-bootstrap regression exposed the sweep accepting the startup heading. Both theme sweeps now require the actual workspace heading and preserve all error assertions; final full rerun is required. No APK/application source changed for this test-harness correction.
- GitHub private branch/reviewer enforcement is blocked by the current account plan. No signing secrets uploaded; CI publication fails closed. Do not make source public or buy an upgrade automatically. Use a controlled local signing/manual release until the owner chooses an enforceable CI policy.
- Owner: manually host the approved download ZIP, verify HTTPS/hash and install test build13 over build11. Physically test a subsequent higher approved update, retained sessions/pairing/photos, camera/scanner deferral, cancellation/restart and offline behavior.
- Full POS: verify actual Hostinger slot/runtime and approved PostgreSQL/private object storage, guarded fresh staging migrations, shared browser access, readiness, persistence and recovery. Nothing was hosted by R3A.
- Keep native Windows MSVC/SDK build/offline acceptance, real printer/HID/second monitor, stable signing and repair-job parts/deposit/settlement accounting as explicit production gates.
- Claude Design handoff is proposal/audit only; local AST graph is incomplete for SQL. No new redesign has been approved or performed.
