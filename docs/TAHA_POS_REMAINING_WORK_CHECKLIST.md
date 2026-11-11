# Taha POS remaining work checklist

Evidence date: **11 November 2026**. Root: `D:\Inventory system POS`. This is a plan produced by an audit, not implementation authorization. See `TAHA_POS_COMPLETE_HANDOFF_2026-11-11.md` for architecture, test boundaries and history.

## Phase R1 implementation update

The owner subsequently authorized recovery. The all-NUL MediaService is now **reconstructed and buildable**, with original forensic bytes and verified private backups retained. The full backend suite passes **203/203**, with zero skipped/failed. Targeted runtime advisories were patched; frontend and backend `npm audit --omit=dev` both report zero findings. An explicit identity-verified `--isolated` launcher starts real API/auth on 3306 and frontend 1423 against disposable PostgreSQL 55459 without consulting saved 55439 data. The browser suite has 187 unique passing cases across the full run and unchanged PDF rerun, plus one intentional API-only skip; the full run's single failure was missing `pypdf` in the default Python. Three fresh real-API browser journeys, eight launcher tests and seven SQLite source/SQL checks also pass. See `TAHA_POS_PHASE_R1_RECOVERY_REPORT.md` for source-control status and exact evidence. No physical/native acceptance or deployment is implied.

The older table entries below describe the audit starting point; resolved R1 recovery/dependency rows are no longer blockers. Remaining functional corrections were deliberately not folded into backend recovery.

| Next correction | R1 classification | Priority / required evidence |
|---|---|---|
|1.Short-prefix @Product search|**Confirmed broken**|P2;1/2/3character/dictionary regression across consumers.|
|2.Blank service-price semantics|**Confirmed broken** presentation;zero submission guard works|P2;blank remains unset without false floor/breakdown; preserve financial constraints.|
|3.Damaged count on New Sale cards|**Confirmed broken** / absent projection|P2;safe available/damaged DTO and actionable card without selling quarantine.|
|4.Only returnable item auto-selection|**Confirmed broken** / absent default|P2;one vs multiple/zero eligible lines.|
|5.Manual refund/credit adjustment explanation|**Confirmed broken** presentation, SQL safeguards working|P1/P2;derive actual payout/method/credit reduction and show before confirmation.|
|6.Copy Message fallback|**Confirmed broken** in unavailable/denied clipboard environments|P2;manual copy fallback and real runtime checks.|
|7.WhatsApp opening|**Implemented but unverified** on actual receiver; virtual receipt fallback missing|P2;browser/native blocked-popup and manual send acceptance.|
|8.Saved template unlink|**Confirmed broken** API validator null handling|P2;explicit null removes, omission preserves, immutable old sales unaffected.|
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
| Local demonstration available; hosted demonstration pending | Reproducible isolated real-API localhost now works | `node scripts/start-local-acceptance.mjs --isolated`; frontend 1423, API 3306, isolated PostgreSQL 55459 | Keep fixture services running; saved database remains stopped | Three real-API browser journeys and persisted stock/credit/media assertions pass. This loopback fixture does not provide a LAN-phone or public-cloud demonstration. |
| P2 / Medium | First-character service/product suggestions fail | `src/lib/product-search.ts`, service composer and all dictionary consumers | Stable baseline | Test 1/2/3-character prefixes, fuzzy/aliases/Roman Urdu, partial code, keyboard selection and ambiguous cases on desktop/mobile. |
| P2 / Small | Empty desktop service charge coerces to 0 for messaging | `custom-service-dialog.tsx`, breakdown and mobile parity | Search/composer tests | Empty stays unknown/blank; no zero breakdown/floor warning until valid entry; submission policy remains explicit. Existing disabled Add is preserved. |
| P2 / Small–Medium | POS missing damaged stock visibility | Safe POS DTO/repository/API projection and `product-card.tsx` | Condition/movement source; no costs in public POS projection | Available and damaged distinct; damaged is not sellable; card/action reflect actual stock. |
| P2 / Small | Sole returnable product not auto-selected | `features/sales/transactions-page.tsx` | Selected receipt/current settings | Exactly one eligible item defaults correctly; several require explicit choice; quantities remain bounded. |
| P1–P2 / Medium | Manual refund screen lacks amount/method/credit explanation | Returns preview/confirmation UI and existing SQL return result contracts | Financial regression baseline | Preview derives product/labor/tax/credit reduction/actual cash payout; only require relevant manual payout confirmation; retries never double refund/restore. |
| P2 / Small | Saved linked template cannot be unlinked through API | `server/src/workflows/validation.ts:serviceInput`, save_repair_service | Current migrations | Explicit null removes linkage; omitted preserves old link; permissions, existing sales snapshots and defaults unchanged. |
| P2 / Small–Medium | Clipboard and virtual-receipt external opener unreliable | Reminder/virtual receipt components, native opener adapters | Actual intended HTTPS/LAN/native context | Clipboard denial/unavailable yields manual copy; no false success; popup blocked feedback; manual WhatsApp launch on real device; no delivery claim. |
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

1. Recover backend source and establish full passing/source-recovery baseline. No hosting deployment in this slice.
2. Fix owner-visible search/charge/condition/returns/reminder/template defects with exact regressions.
3. Verify purchased Hostinger capabilities and prepare one isolated staging path; deploy only under a later explicit implementation request.
4. In parallel after recovery: Windows toolchain/build acceptance and Android photo/release work.
5. Hosted shared-data/private-media/restore acceptance, physical apps/hardware, then controlled pilot.

Owner inputs that cannot be inferred from code: exact Hostinger plan, approved domain, PostgreSQL/object storage/backup choice, physical printer and device access, later Windows prerequisite installation authorization. No secrets should be pasted into the planning chat.
