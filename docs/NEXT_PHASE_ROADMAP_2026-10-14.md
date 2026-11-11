# Taha POS — next-phase roadmap

**Based on:** 14 October 2026 source audit and isolated verification. This is a proposal for subsequent authorized development, not work performed during the audit.

## Fixed decisions

Preserve the existing React/NestJS/PostgreSQL/Android/Tauri project, approved Dashboard/POS, compact light-first charcoal/red/yellow/gold design, Taha Mobiles/Taha POS names and PKR. One primary shop/counter is the initial operating model. Windows EXE is the primary counter product; bundled Android is a staff utility. Cloud is authoritative; offline caches/outboxes must reconcile safely. Business data and Device Bridge are independent. Backend authorization must protect costs/profit. No Supabase production dependency, no automatic MySQL conversion, no assumed Hostinger VPS.

## Recommended order

1. **5A.1 — Native terminal identity and offline authorization contract.** Start here; no new business modules.
2. **5A.2 — Windows toolchain and real native acceptance.** Prerequisite installation may be prepared in parallel with 5A.1, outside audit scope.
3. **5A.3 — Paid-offline reconciliation and staff handoff.** Required before accepting real offline cash.
4. **5B.1 — Managed HTTPS staging, PostgreSQL and private media.** Can proceed in parallel after owner hosting decisions; staging is not final release.
5. Separate **5B.2A image durability** and **5B.2B desktop/mobile transport deployment** so a native/bridge rewrite is not hidden inside “mobile polish.”
6. **5B.3 — Shop hardware pilot** after Windows and connection foundations pass.
7. **5B.4 — Security, recovery and signed release candidate**, then a supervised production pilot.

Do not jump directly to “final installer + hosting + all remaining modules.” Each slice has an acceptance gate.

## 5A.1 — Native identity/grant repair

**Objective:** make the actual desktop session obtain valid offline authorization and distinguish network failure from server validation/auth errors.

**Scope/files:** `src/stores/ui-store.ts`, `device-bridge-store.ts`, `src/components/layout/desktop-sync.tsx`, `src/lib/desktop/`, backend `server/src/sync/`, native grant/cache commands and `tests/phase5a.spec.ts`/server integration tests. Use a canonical persistent UUID with a safe migration from existing short UI IDs. Preserve device/display pairings and completed/pending receipts; do not regenerate identity every refresh.

**Dependencies:** existing persisted identities, custom auth context, signed grant and server UUID validation. **Complexity:** Small to Medium.

**Acceptance:** fresh and upgraded install use stable matching IDs; real frontend request to isolated API returns valid grant; cache preparation completes; 400/401/403/timeout have distinct safe states; logout/branch/backend changes isolate grants; existing device bridge pairing still works while local business provider is selected. Regression test must execute this boundary, not replace both sides with matching test doubles.

**Risks:** invalidating old pairing or outbox scope, hiding validation errors as OFFLINE, granting broader authority than the signed original employee/store.

## 5A.2 — Real Windows build/startup acceptance

**Objective:** compile and run the installed/native product.

**Scope/files:** authorized environment installation, `scripts/windows-prerequisites.ps1`, `src-tauri/`, native configuration/capabilities/build rules, AppData initialization and deployment docs. Fix only actual compilation/runtime issues exposed by the Microsoft toolchain.

**Dependencies:** MSVC Desktop C++ workload, x64/x86 tools, Windows SDK and stable MSVC Rust; 5A.1 for cash acceptance. **Complexity:** Medium.

**Acceptance:** `cargo check`, `npm run tauri dev`, native window inspection and `npm run tauri build` genuinely succeed; record generated EXE/NSIS/MSI paths/checksums. Verify splash/recovery, single instance, window geometry/theme, Dashboard/POS/products, DPAPI session restore, SQLite reopen, crash draft, offline cached search/cash/receipt, reconnect/outbox retry and restricted native customer window. Test 1366×768 and 1920×1080. Installer uninstall must not silently delete pending business data.

**Risks:** source Rust has not reached full compilation; WebView2/printer/platform behavior; debug demo composition can bypass native cache path. A browser preview or successful frontend build is not this gate.

## 5A.3 — Paid-offline conflict resolution

**Objective:** every collected offline cash sale ends in one auditable server transaction or an explicit reconciled exception.

**Scope/files:** native outbox/receipt/reservations, Sync Center, `server/src/sync/`, custom SQL offline imports/transaction audit, permission checks and isolated concurrent tests. Define owner review outcomes for changed floor/tax, insufficient stock, expired/revoked employee authority and store/backend changes. Provide authenticated handoff without impersonating the original cashier. Preserve final invoice identity and immutable original capture evidence.

**Dependencies:** actual SQLite execution and 5A.1; original financial engine/permissions. **Complexity:** Large; keep it a financial phase only.

**Acceptance:** duplicate retries/import-after-crash result in exactly one financial effect; stale stock cannot silently oversell; paid rejected sale remains visible across restart; owner disposition produces linked correction/refund/reservation/stock/audit records; deactivated original employee does not strand money; partial network responses are recovered; tests use separate connections and real native persistence.

**Risks:** refund fiction, changing customer totals after receipt, lost cash, privilege escalation, audit gaps. Do not enable unrestricted offline credit or repair deposits in this phase.

## 5B.1 — Managed Hostinger staging with external PostgreSQL/private media

**Objective:** validate the intended non-VPS cloud architecture using production-like staging.

**Scope/files:** `server/scripts/{build-managed,managed-start}.mjs`, server config/health/auth/storage/sync, `server/.env.managed.example`, packaging/deployment docs and isolated migration/restore tooling. Use managed Node 22/24, HTTPS API domain, separate migration/runtime database users and private S3-compatible storage. Keep incoming WebSockets optional; foreground HTTPS polling is required.

**Dependencies:** confirmed Hostinger plan with server-side Node deployment, domain, external PG and object-storage choices, owner-provided secret entry outside source. **Complexity:** Medium to Large.

**Acceptance:** deploy source/ZIP through supported managed workflow; health/schema/DB readiness, secure cookies/origins, private image/reference access, server restart/session persistence, revision polling and mobile auth succeed on HTTPS. Demonstrate no DB password/signing secret in frontend/EXE/APK. Establish backup schedules/retention/RPO/RTO; restore PG and media to an isolated environment. Record what Hostinger actually supplies rather than inferring it from plan names.

**Risks:** unsupported plan/process lifetime, connection limits/latency, file loss on redeploy, missing proxy trust/TLS settings, RLS defeated by superuser runtime credentials, media and DB backups becoming inconsistent.

**Wait:** public deployment/release is not authorized merely by this roadmap. Do not migrate to MySQL without a separately approved redesign/revalidation phase.

## 5B.2A — Durable photo queue

**Objective:** captured product/proof/profile/repair/device photos are not silently lost during a realistic outage.

**Scope/files:** Android `PendingPhotos.java`, `ShopBridge.java`, mobile camera upload service/UI, native `images.rs`, server camera claims/media outbox. Replace implicit 30-minute deletion with explicit retention and recoverable pending state; define expired request reattachment and safe origin/IP migration. Preserve original/derivative ownership and bounded disk usage.

**Dependencies:** bridge/media permission contracts, storage/retention decisions. **Complexity:** Medium.

**Acceptance:** lock/restart/server outage beyond request/photo TTL, changed counter IP, exhausted capacity and interrupted batch upload never silently discard accepted captures; staff see retry/reassign/discard outcomes; upload idempotency and entity/slot routing remain correct. Test real Android process recreation and native local queue as well as JS emulation.

**Risks:** leaking proofs across accounts/shops, retaining private photos forever, attaching a late photo to the wrong sale/product, pruning unsynced content.

## 5B.2B — Installed counter ↔ staff transport

**Objective:** define and package the real shop LAN bridge plus cloud fallback.

**Scope/files:** local bridge settings/runtime installer/service lifecycle, `src/lib/device-bridge/`, native HTTP/config, Android origin/session/pairing, backend camera/realtime/polling and installation docs. Decide how the separate NestJS/PG LAN service is deployed and secured; it is not currently included in the EXE. Specify whether an independent lightweight LAN service is required or the existing local backend is deliberately provisioned.

**Dependencies:** Windows app and staging identities, owner service-installation/administration preferences. **Complexity:** Medium to Large; architecture decision first, no automatic duplication of authority.

**Acceptance:** Pair Staff Phone from EXE; persistent QR/code/device name; online/offline presence; test request; product/proof/profile/used-device/repair capture and gallery auto-insertion; Use Another Phone claims without cancellation; two counters/phones isolated; internet-off LAN operation; remote HTTPS polling; repeated sleep/Wi-Fi/server restart reconnect without duplicate sessions. Native Android release signing and HTTPS/default backend configured and tested physically.

**Risks:** cloud and LAN divergent identities/permissions, exposing a PC service to untrusted networks, requiring users to operate developer terminals, background camera/push assumptions. Keep pairing tokens free of passwords/JWTs.

## 5B.3 — Display, printing and scanner hardware pilot

**Objective:** demonstrate complete counter operation with the actual shop hardware.

**Scope/files:** native customer-display window state/fullscreen/monitor selection, `receipt-printer.ts` Windows/ESC-POS adapter, receipt CSS/print settings, HID focus/shortcut handling and hardware test guide.

**Dependencies:** native acceptance, actual second monitor, thermal printer model/driver/interface and barcode scanner. **Complexity:** Medium.

**Acceptance:** customer window opens/reconnects on second monitor without internal data; idle/cart/digital/cash/credit/complete transitions and account QR readable; 80mm white print compact with real margins; A4 and PDF correct; reprint does not create another sale; HID scan enters intended search without losing checkout focus; offline receipt prints and final invoice remains unchanged after sync.

**Risks:** vendor print drivers, paper cut/feed, mixed monitor DPI, accidental customer-screen privilege/cost leak. Browser PDF tests are only preparation.

## 5B.4 — Security/recovery and release candidate

**Objective:** remove remaining development dependencies and prove an operable recovery/release process.

**Scope/files:** provider/auth/config cleanup, pure mapper relocation, runtime credentials/grants, release bundles/signing, logging/limits/retention, backup runbooks, smoke/permission/migration/native/mobile tests and owner onboarding. Remove Supabase SDK/live provider from production deliberately while retaining PostgreSQL business rules and valid regression tests. Harden native financial commands, restore operations and trusted-account recovery. Keep updater disabled until signatures/server trust are designed.

**Dependencies:** all preceding gates; production values/signing ownership. **Complexity:** Medium.

**Acceptance:** employee network responses never contain protected cost/profit/proof/history; permissions revoke promptly; token rotation/PIN/recovery/session loss tests pass; no production secrets bundled/logged; signed Android and Windows distribution with verified checksums; restore drill succeeds; supervised one-counter pilot including outage/conflicts/pairing/printing completes before broader use.

**Risks:** rushing installer signing before safety acceptance, enabling incomplete workflows, undocumented deployment drift. Repair finance/import/public website can be separate later P2/P3 phases.

## Only owner decisions that block later phases

1. Exact Hostinger plan and whether its hPanel offers server-side Node.js deployment; selected API domain/subdomain.
2. External PostgreSQL and private object-storage providers/region/retention, plus acceptable recovery time/data-loss window. Keep PostgreSQL unless a separate migration is expressly authorized.
3. Actual thermal printer model, 80mm/A4 needs and connection/driver; available second monitor/scanner for acceptance.
4. Real payment account details/QR and store contact/footer information before customer-facing production tests.
5. Permission to install Windows C++ prerequisites and chosen account/service-installation approach for the LAN bridge; production signing-key/certificate ownership before release.

Do not ask the owner for information that the repository already provides (framework choice, existing API modules, product names or current phase). No passwords/tokens/keys belong in chat or handoff documents.

