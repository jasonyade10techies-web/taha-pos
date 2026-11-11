# Phase 5D.2 revised — implementation and test handoff

**Evidence date: 22 October 2026. Project: `D:\Inventory system POS`.**

Authoritative request: `docs/PHASE5D2_REVISED_OWNER_BRIEF.md`. Progress/checkpoints: `docs/PHASE5D2_REVISED_PROGRESS.md`. This is continuation of the existing application, not a rebuild. Approved page structures, Taha branding, saved financial history and custom PostgreSQL backend were preserved. No production deployment, dependency upgrade, database reset or Windows software installation was performed. This checkout has no Git metadata; these are in-place files, not claimed commits.

**Delivery state: READY FOR PHYSICAL RETEST.** Core revised services, protected camera-companion enrollment, neutral theme and bounded UI corrections are implemented and automatically checked. The complete production product is not accepted: native Windows/offline/hardware and deployed-cloud gates remain open. Implemented, automatically tested, physically verified and deployed are different states throughout this report.

## A. Smart Services

### Composer and customer line

- `src/components/pos/service-mention-composer.tsx` uses `src/lib/service-composer.ts` and `src/styles/service-mention.css`: a structured document with surrounding text and one optional immutable product-ID token. It does not parse arbitrary pasted HTML into inventory instructions.
- Typing `@` opens a compact caret-adjacent search. Existing catalog/alias matching plus panel typo normalization supports examples such as `@y20 panal`. Suggestions show actual name/variant, stock and retail. Only deliberate mouse/touch/Enter/Tab selection establishes a link; ambiguous/unselected text remains service-only.
- Arrow keys, Escape, atomic deletion, Change Product, inspection/location allocation, surrounding caret editing, plain-text copy/paste, undo/redo and composition guards are implemented. A real prefix/caret defect found during browser testing was corrected; simulated composition is tested, not a claim about every physical keyboard/IME.
- Desktop `src/components/pos/custom-service-dialog.tsx` and mobile `src/features/mobile/mobile-service-dialog.tsx` show the selected material, available stock/current price and one customer charge. Token deletion/undo updates the actual link. One combined cart line has a small Includes-material subline; customer wording can be deliberately edited.
- Service-only custom work retains no artificial material minimum. Selecting a component applies that component's existing price/floor and stock rules. Adding/searching a service does not deduct stock.

### Revenue, floors and immutable history

`src/lib/compound-service.ts`, `compound-price-breakdown.tsx`, desktop `price-dialog.tsx`, mobile `mobile-service-price.tsx`, and migration `server/migrations/202610220200_compound_service_allocations.sql` implement the split. For the applicable material basis S and total T: product portion is min(S,T), labor is max(0,T−S), and the reduction below retail is max(0,S−T). Material quantity is included in the basis. Labor never becomes negative and is revenue, not a purchase-cost or profit figure.

Below-retail charges require the existing permission/reason policy. Below-floor charges require the existing authorized override or are blocked. Approval identity and rounded material-unit price must match the actual selected SKU; synthetic service minimum0 cannot bypass the floor. Stale catalog/floor changes require explicit renewed review; changing a saved template or editing the cart refreshes the relevant basis. Mobile below-floor escalation explains the counter approval requirement rather than inventing an owner PIN flow.

PostgreSQL and IndexedDB/local adapters retain immutable product/labor/discount/tax/cost snapshots and one sale charge. Stock is deducted atomically once through existing transaction/idempotency rules. Cost, protected floors and approval details are removed from unauthorized receipt/candidate projections. Default and date-range profit charts exclude tax and account for refunded tax and retained labor. Unknown purchase cost remains unknown, not fabricated zero profit.

Saved linked templates preserve explicit SKU/linkage, description and labor defaults. Catalog selection reopens current-price review; direct server checkout of a linked template without its material review is rejected. Existing historical service/sale rows were not rewritten.

### Returns

The default compound return refunds the product portion only. Material restoration remains explicitly sellable/damaged/no-restoration. Labor refund is a separate authorized choice enforced by `returns.approve`; credit balances retain unrefunded labor. Partial quantities/rounding, tax conservation and retry behavior have isolated backend coverage. Returns offers Receipts/Return History, seven candidates per page, and keeps the selected receipt mounted when changing lists.

## B. Pairing and authentication

### Passwordless camera companion

PC **Settings → Devices → Connect Phone** shows a large square QR. Phone **Scan to Connect** scans it, creates native proof of possession, and waits. The signed-in authorized PC user compares the presented identity/fingerprint and approves. The phone receives its own limited session; it never receives the owner's password or reusable owner session in the QR.

Primary files:

- Backend: `server/src/auth/enrollment.*`, `companion-policy.ts`, `auth.guard.ts`; migration `202610220300_device_enrollment.sql`.
- PC: `src/features/settings/companion-enrollment-settings.tsx`.
- Phone: `src/features/mobile/companion-enrollment.tsx`, `nearby-counters.tsx`, `mobile-devices-page.tsx`.
- Native: `mobile/android/app/src/main/java/com/tahamobiles/staff/{CompanionSecurity,CounterDiscovery,ShopBridge}.java`.

Enrollment is short-lived and single-use, scoped to shop/terminal/device and approving user, with P256 proof, protected transport and replay rejection. AndroidKeyStore protects identity and AES-GCM refresh storage; refresh material stays native. Refresh rotation, expiry, device revoke/disconnect, parent PC logout and session replacement invalidate the appropriate credential. Device identity persists independently of a WebSocket connection ID.

**Scope is deliberately camera companion, not unrestricted owner mobile access.** Only the explicit camera/device/media allowlist is accepted. Account-management actions unavailable to that scope are hidden; companion Disconnect uses the confirmed private-data-clearing sign-out. Existing ordinary staff-account login remains the path for authorized mobile business Sales and broader functions. No new phone may invent offline authorization when enrollment cannot reach the trusted counter.

### LAN and cloud distinctions

- Existing HTTP test API: `http://192.168.1.3:3001`. Protected enrollment/companion: `https://192.168.1.3:3443`. Both bind `0.0.0.0`; the local API remains an independently running NestJS/PostgreSQL service.
- `scripts/configure-lan-tls.ps1` retains a private key outside app assets, restricts its Windows ACL and renews the local certificate for the selected IP. The scanned QR supplies its SPKI trust pin; Android checks pin, origin and certificate validity. No system-wide trust bypass was installed.
- `server/src/auth/lan-discovery.ts` announces `_taha-pos._tcp.local`; Android NsdManager performs a bounded genuine discovery. Discovered endpoints are hints, not trusted credentials. Manual/QR fallback remains. Selected live interface/hotspot preference survives the launcher; stale DHCP preference falls back to a live private adapter. Loopback/virtual adapters are not advertised as usable phone counters.
- Companion correctness uses HTTPS polling. Existing authenticated LAN WebSockets for ordinary staff remain; the companion does not connect an unpinned HTTP WebSocket. Discovery, restart, malformed-query and interface selection have automated coverage. Real router isolation/hotspot/firewall acceptance remains physical work.
- No firewall rule was silently applied. The helper supports narrow TCP3443/TCP3001 and optional UDP5353 Private/LocalSubnet rules, requiring explicit administrator application if necessary.
- Cloud is not deployed. Protected enrollment currently requires actual TLS on the API socket; deployment behind a TLS-terminating managed ingress needs a verified trust/transport policy. Do not enable blind `X-Forwarded-Proto` trust merely to bypass this gate. No Hostinger WebSocket capability is assumed.

## C. Offline, cash and media reliability

The existing browser IndexedDB/demo, native Windows SQLite/outbox and custom PostgreSQL authorities remain distinct. Native SQLite caches/offline cash receipts are not replaced by a second mobile stock database. Stable transaction/invoice IDs, atomic receipt/outbox/reservation commits, crash retry and owner cash-reconciliation evidence were retained and tested.

The phone can use the independently running LAN API without internet where that LAN/API/database is reachable. **Phone-initiated sales through the installed counter's durable SQLite authority are not implemented/accepted in this build.** Ordinary mobile sales still need their authorized API transaction path; existing active offline-counter grants or unresolved cash evidence conservatively block conflicting mobile financial writes. Compound custom services remain online/API operations. Electronic confirmation, unsafe credit/receiving/write-off/admin actions are not silently permitted offline.

Native photo retention was corrected:

- `PendingPhotos.java` no longer silently deletes unsent images after30minutes; `ShopBridge.configure` no longer deletes every origin's photos when changing address.
- `src/lib/mobile/pending-captures.ts` retains/restores current-origin pending captures and keeps their original capture IDs. Server acknowledgement or explicit discard clears a capture; request cancellation alone does not destroy its image.
- `src/features/mobile/saved-photo-recovery.tsx` exposes expired/cancelled/orphan captures in Activity, with Save Copy and confirmed Discard. The queue remains bounded to12photos/64MiB. Photos are not reassigned to another field or another shop silently.
- Origin isolation intentionally requires returning to the original connection to recover photos stored for that origin. Confirmed sign-out explicitly warns and clears private cached data. Android10+ gallery export is supported; older Android retains the image and explains unsupported export instead of claiming a save.

A real phone power interruption, upload interruption, PC native crash, internet-free hotspot sale and installed SQLite/cloud reconciliation are still physical/native gates. Source logic and isolated tests must not be described as those hardware passes.

## D. Themes and UI

Light tokens: background `#F3F3F3`, card `#FFFFFF`, raised `#F8F8F8`, border `#E2E2E2`, text `#202020`, secondary `#626262`, charcoal sidebar. Dark: background `#181818`, sidebar `#141414`, card `#262626`, raised `#303030`, border `#414141`, text `#F2F2F2`, secondary `#C5C5C5`. Primary gold `#F2BC2D`, Taha brand red retained; smaller semantic red uses readable theme variants. Manrope remains bundled. Existing custom appearance choices are preserved; only the old exact defaults migrate.

Semantic hover/focus/selected/disabled/overlay/chart/paper states were checked. `docs/phase5d2-theme-notes.md` records11passing theme tests and76screenshots; the compact Products toolbar adds12screenshots, for88PNG files in `docs/screenshots/phase5d2-theme/`. Sizes:1920,1440,1366,1024,390,412 in both themes. Native Android shell/scanner resources use the neutral/gold system. Root integration re-inspected Dashboard dark and Products light at1366; the documented earlier inspection covered staff screens, POS, customer, Settings and receipt paper. Screenshot data is isolated demo data.

Products filters/actions wrap compactly without changing the approved table/gallery. At1920 the toolbar fits one row; narrower viewports wrap. Returns tabs/seven-candidate pagination, grouped Settings navigation and Save/Discard state are checked. Ordinary settings cards are constrained rather than stretched. Existing compact Shop Setup and real startup progress remain; no new giant wizard or artificial splash delay was added. The full ten-topic setup expansion is not claimed complete.

`server/migrations/202610220400_receipt_references.sql` and `server/src/receipts/receipt.service.ts` add stable43-character opaque HMAC capabilities with hashed lookup, domain separation and30-day expiry. Legacy JWT receipt links remain accepted. Virtual receipts use customer-safe projections, not account tokens. Receipt/PDF payment summaries distinguish received, refunded, reversed, net paid and outstanding. Thermal80mm and A4 stay white in either theme. Owner-only cashier visibility is respected. Native PDF sharing/FileProvider remains; external receiver-app and physical printer acceptance is pending.

Remaining UI/hardware acceptance includes actual Android edge-to-edge/keyboard/camera/scanner behavior, all receiver apps, physical thermal/A4 output, and installed Windows startup/customer-display behavior. The neutral UI implementation is not equivalent to completed hardware acceptance.

## E. Actual testing and scenario coverage

All logs below are from this Phase5D.2 integration on22October2026. Financial/security tests use isolated databases on127.0.0.1:55459, not the saved owner development database on55439. Do not add overlapping suite counts into one inflated total.

| Gate | Actual result | Evidence |
|---|---|---|
| Full backend |176passed,0failed;508.6s | `.test-postgres/phase5d2-20261022/backend-clean-rerun.log` |
| Final discovery/interface suite |3passed,0failed; adds one address test after full backend run | `discovery-final.log` |
| Full existing local browser regression |164passed,1skipped,0failed;20.0minutes | `browser-clean-rerun.log` |
| Focused services/model/Settings/Returns/photo recovery |9passed,0failed;1.2minutes | `services-workflows-final.log` |
| Local compound/accounting/chart |2passed,0failed;24.7s | `accounting-chart-green.log` |
| Device Settings/failure states |8passed,0failed;2.5minutes | `enrollment-browser-final.log` |
| Protected enrollment API lifecycle |4passed; included in full backend | `enrollment-final.log`, `server/test/device-enrollment.test.ts` |
| Neutral theme |11passed; recorded earlier same-phase run | `docs/phase5d2-theme-notes.md`, theme screenshots |
| Final toolbar rerun |1passed,0failed;23.2s across six widths/both themes | `toolbar-final.log` |
| SQLite durable outbox |7passed,0failed | `sqlite-final.log` |
| Cash evidence/reconciliation policy |9passed,0failed | `cash-evidence-final.log` |
| Android build10 Java unit tests |24tests,0failures/errors/skips | native `app/build/test-results/testDebugUnitTest/TEST-*.xml` |
| Android assemble/lint/sign |success; lint0errors,16warnings; v2 signature verified | `android-build10.log`, `apk-signature-final.log` |
| Frontend full lint/typecheck/production build |exit0 | `frontend-{lint,build}-final.log`, `frontend-gates-final.json` |
| Backend build/lint |exit0 | `backend-{build,lint}-final.log` |
| Client credential boundary |passed | `client-boundary-final.log` |
| Migration validation |exit0; supplementary legacy migration validation, not native acceptance | `migrations-final.log` |
| Tauri configuration |schema/icons/capability validation passed; no native compile claim | `tauri-validation.log` |
| HTTP/TLS and complete APK downloads |200; database connected; TLS certificate validated; all download bodies match SHA256 | adjacent APK validation JSON |

The browser skip is `tests/phase5d-search-controls.spec.ts` API profile Change Password: this local/mock run lacks its API authentication fixture. It was not counted as passed. Backend authorization/password/session coverage is separate, not a substitute claim for that skipped browser case.

Android lint warnings remain: SetTextI18n6, IntentFilterUniqueDataAttributes3, GradleDependency3, ApplySharedPref1, CustomX509TrustManager1, InsecureBaseConfiguration1, UnusedResources1. The custom trust manager enforces the scanned SPKI and certificate validity; debug HTTP is intentional and release differs. These warnings are disclosed, not a clean production-security certification. Production signing/configuration review remains required; dependencies were not upgraded during this phase.

Failures were investigated rather than erased: the first backend full run had5failures caused by a receipt summary private-helper permission regression. The safe security-definer projection was corrected before applying migration400 to owner data; affected API regressions then50/50passed and the clean full run176/176passed. The first legacy browser run had18failures, largely old native-select/label/date/chart-fixture expectations. Helpers now interact with visible custom controls; selected-stock, idempotency, permission and financial assertions remain. Test-only intermediate reruns/logs are retained. Composer caret/composition and native photo-expiry regressions were reproduced and fixed before the final green gates.

### Operational scenario classification

| Scenario group | Evidence and honest boundary |
|---|---|
| Single/multiple product, service-only, selected linked part, typo/ambiguous/unselected token, no stock, retail/floor/stale review, partial payment, duplicate click, compound returns | Fresh focused browser/local and `server/test/{compound-services,smart-services,integration}.test.ts`; one charge and one deduction asserted. Physical checkout not claimed. |
| Receiving, duplicate names/variants, transfers/quantity, quarantine/damaged recovery/write-off, missing location, out-for-test, last-unit contention | Existing local browser regression and isolated `product-hardening`, `damaged-inventory`, `integration`, `camera-assignment`/business suites as applicable; core backend concurrency retained. Actual misplaced physical items/counts remain an owner workflow, not automatically detected. |
| Walk-in/repeat/credit, absent/overdue due date, collection/reversal, unpaid return, manual WhatsApp, customer edits | Local customer/credit regression and backend customer-activity/transaction/cash-reconciliation suites. WhatsApp is prepared for manual sending, not automatic delivery. |
| Repair catalog/intake/private photos, linked materials, purchased device/IMEI | Existing browser/backend coverage retained; inspect `server/test/{workflows,smart-services,integration}.test.ts`. Complete cancel/uncollected/used-device-resale/damaged-device permutations were not individually newly physically accepted. Do not infer completeness from a page/button. |
| Unpaired/offline/two phones, expired/wrong-shop/replayed enrollment, revoked/lost phone, parent sign-out | Fresh device UI and real-TLS backend enrollment tests. Phone hardware transport/camera remains unverified. |
| Router/IP/hotspot switch, cloud outage, interrupted upload/restart, pending cash conflicts | Pure address/DNS tests, unavailable-server UI, retained photo policy and durable SQLite/cash tests passed. Real hotspot-without-internet, installed native counter recovery and cross-device offline sale authority remain open. |

### Saved development data protection

Before applying migrations200/300/400 to the saved localhost database, a custom pg_dump backup was created and inspected with pg_restore --list. File: `.test-postgres/phase5d2-20261022/owner-dev-before-5d2.dump`,917581bytes; SHA256 `acfec4e562324fbd0827e3cb53793d3a681b887c5b9a6a474293b717527119ee`. Manifest and `owner-dev-migration-verified.json` record the upgrade. Pre/post sale/payment/return counts and totals, credit ledger balance, movement count, stock sum and shop settings matched. No historical financial backfill/reset was performed. These migrations are now applied: never edit them in place for subsequent changes.

## F. Verified deliverables

As checked22October2026:

- Frontend: **http://localhost:1423/login** / **http://localhost:1423/dashboard**, HTTP200.
- LAN HTTP health: **http://192.168.1.3:3001/api/v1/health**, HTTP200, database connected.
- Protected LAN health: **https://192.168.1.3:3443/api/v1/health**, HTTP200 with certificate validation against the local certificate, not a disabled-verification test.
- Current Ethernet IPv4: **192.168.1.3**; API listeners `0.0.0.0:3001` and3443; frontend1423. No claim that an old `.8` address remains current.
- Launcher: `scripts/start-local-acceptance.ps1` / `.mjs`; detached hidden processes run independently. Existing development database/accounts retained. Backend restarted only to load this implementation; frontend/API remain running for owner retest. This is local hosting, not Hostinger deployment.
- APK: **0.5D.2-test, build10**, `com.tahamobiles.staff.debug`; **3993094bytes**.
- Exact path: **`D:\Inventory system POS\artifacts\android\Taha-Staff-test-5D2.apk`**.
- Download: **http://192.168.1.3:3001/api/v1/downloads/staff-test-5d2.apk**.
- Alternate: **http://192.168.1.3:1423/staff-test-5d2.apk**. Generic backend staff-test.apk also matches.
- APK SHA256: **`e96269314c5bcefe88cc35d8570eaa62634c4e8f52fa9fb714eeae7e0d6e354f`**.
- Debug signer certificate SHA256: **`fe4bd258ec8f80aa5aeb2fcc608e7fe42c2dd0af3931767ca8bfd84af3618a38`**, same as build8. v2 verification passed; update in place rather than uninstalling/clearing pending data.
- All57packaged UI files exactly matched `dist-mobile`; ZIP integrity passed. No development account password found in bundled JavaScript. Approximate4MB size is normal compressed bundled content, not a remote-Vite wrapper.
- `artifacts/android/Taha-Staff-test-5D2.apk.{sha256,validation.json}` records metadata, full-body download hashes, health and native test counts. Prior5D1 and intermediate5D2-build9 artifacts remain.
- Retest guide: `mobile/android/README.md`, seven steps, starts with PC Devices enrollment and test request before product capture.

No passwords, reusable session credentials, private keys or database secrets are included in this handoff.

## G. Next blockers and bounded next work

1. **Physical Android retest first (owner):** install build10, PC-approved passwordless camera enrollment/revoke, request delivery and correct-field camera/gallery insertion, network interruption/recovery, themes/insets/QR/barcode/PDF receiver. Scope distinction must be confirmed understandable. Compare actual failure diagnostics before changing another architecture.
2. **Windows native acceptance (separate bounded stage):** verify MSVC/SDK prerequisites, build/run Tauri EXE and installer, splash/main/customer-display windows, AppData SQLite, native protected session storage, offline launch/cash/outbox/reconnect and printing. Configuration validation/browser success is not an EXE. No new installer was produced or physically accepted here.
3. **Counter-authority bridge:** explicitly design authenticated mobile cash commands into the same native SQLite transaction/outbox authority, prove idempotency/last-unit/conflicts and retained cash after crash before enabling it. Current separate NestJS LAN server is not that native bridge. Do not independently debit phone stock offline.
4. **Managed cloud deployment:** confirm real Hostinger Node plan, domain, external PostgreSQL, private file storage, backup/restore and ingress TLS trust. Preserve PostgreSQL transactions. Prepare production signing/endpoints and HTTPS polling; no assumed VPS, incoming WebSockets or deployed domain. No production deployment yet.
5. **Hardware/operations sign-off:** thermal/A4 printer, USB HID barcode scanner, second monitor/customer display, phone hotspot/router/firewall, restored backups and financial day-close/reconciliation. Only after these pass should production readiness be considered.

The UI/core revised workflows are available for owner testing now. Outstanding native/cloud/hardware work remains explicitly open; do not label the entire product production-ready.
