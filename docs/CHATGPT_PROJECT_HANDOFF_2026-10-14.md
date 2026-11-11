# TAHA POS — COMPLETE DEVELOPMENT HANDOFF

**As of 14 October 2026. Project:** `D:\Inventory system POS` on Windows. **This handoff is based on source inspection and fresh isolated tests, not merely previous implementation reports.** No feature development was performed during the audit.

## 1. Product and fixed owner decisions

Taha POS is an internal retail inventory/POS system for **TAHA MOBILES**, one physical Pakistani mobile-parts/accessories/repair shop and initially one primary counter. Currency is **PKR**. The primary production counter must be a **real installed Windows Tauri application with locally bundled UI**, not Chrome or a remote website. Android Staff is a bundled dedicated mobile utility for staff/photos/scanning, not the full desktop cashier interface.

Preserve the approved Dashboard/New Sale/cart and compact light-first white/gray workspace, dark charcoal sidebar and red/yellow/gold branding. Keep the coded TM logo for now. Do not rebuild the frontend or replace the custom NestJS backend/PostgreSQL transaction engine. Browser/local demo remains useful. Owner may change the backend only in advanced settings. Customer Display must be live and customer safe. Offline allowed cash must have stable receipts/idempotency/audit and safe reconciliation. Costs/profit must be protected by backend authorization, not hidden columns. Business-data selection and Device Bridge are separate concerns.

Production must use **custom independently hosted auth/API**, with **no Supabase production dependency**. PostgreSQL remains the database. Owner has Hostinger but **no VPS**; target an eligible managed Node.js plan with external PostgreSQL/private media. Do not automatically migrate to MySQL, assume incoming cloud WebSockets, deploy without actual hosting choices, or expand all deferred modules at once.

## 2. Overall current stage

Phase 4E product/media/receipt/checkout hardening and Phase 5A Windows/SQLite/managed-hosting foundations exist. There is an extensive functional local prototype and real tested custom backend, plus a debug Android APK. The project is **not production ready**: no native Windows binary/installer, no demonstrated hosted deployment, no completed native offline acceptance, and unresolved paid-offline recovery/photo-retention risks.

Distinguish **IMPLEMENTED**, **TESTED**, **PHYSICALLY VERIFIED** and **DEPLOYED**. JavaScript/browser emulation is not phone/native hardware acceptance. The owner previously reported that the APK loaded, connected and logged in physically, but also reported pairing problems. No complete physical camera/pairing/printer/native pass was established by this audit.

## 3. Current environment and versions

- Node **22.23.1**. Frontend application **0.5.0**; React/React DOM **19.3.0**, TypeScript **5.9.3**, Vite **7.3.6**, Tailwind **4.3.3**, Zustand **5.0.15**, TanStack Query **5.104.1**. These are installed/resolved versions, not only manifest ranges.
- UI: Radix/custom AppSelect/AppCheckbox, Lucide, Framer Motion, shared media/crop/viewer, virtual keyboard, InfoTooltip. Current default font is **Manrope**; Inter/System are available. Preserve approved appearance.
- Backend package **0.1.0**, NestJS core **11.2.7**, pg **8.23.1**, Argon2 **0.44.0**, sharp **0.35.5**, supported Node **>=22 <25**.
- Tauri installed JS/Rust **2.12.1**. Rust **1.99.0**, Cargo **1.99.0**, rustup **1.29.1**, stable-x86_64-pc-windows-msvc active. **MSVC and Windows SDK are missing.**
- Android: custom Java/AndroidX WebViewAssetLoader, JDK 17, Gradle 8.11.1, min SDK26/target35. Tools are under `.tools/android/`.
- Directory is **not a Git repository**. Do not invent commits, branches or uncommitted classifications. Source timestamps and reports/logs provide limited history.
- Active Ethernet IPv4 on audit day: **192.168.1.4**; older .8/.3/.7 addresses are stale. Development backend generally uses port3001, frontend1423, demo4174/mobile4175, but derive current LAN/address/readiness rather than hardcode them. No production endpoint is evidenced.

## 4. Frontend architecture and routes

`src/app/` composes providers/router. `src/features/`, `src/components/`, `src/lib/`, `src/stores/`, `src/hooks/`, `src/types/`, mocks/styles/assets are modular. Zustand manages UI/session/cart/device/display/preferences; TanStack Query manages reads/invalidation.

`src/lib/config.ts`, `src/lib/repositories/interfaces.ts` and `index.ts` select **local/api/supabase** adapters. Local business data uses Dexie/IndexedDB and explicit mock auth; API uses custom REST/auth. Native release forces API; native debug can still choose local/demo and thereby bypass parts of native integration. Device Bridge is independent in `src/lib/device-bridge/` and may use the real custom backend while products remain demo/local. Some pure API mappers still live under `src/lib/supabase/mappers.ts`.

Routes cover Dashboard, POS, product list/new/edit/import, stock/locations/receiving/transfers/low stock, transaction/invoice/returns, customers/credit/out-for-test, services/repair jobs, used devices/suppliers, employees/shifts/coupons/payments, reports/audit, settings/profile/login/counter and Customer Display. Route guards load session/profile/permissions and deny unauthorized URLs. API mode intentionally denies production product import and website modules; a present page/adapter does not mean those workflows are complete.

Dedicated Android composition is `src/app/mobile-app.tsx` plus `src/features/mobile/`: Home, Activity, Products, Inventory, Devices, Profile, Settings, Reports, display/receipt utilities. Android/native internal routing is hash-compatible; browser development has normal routes. Mobile does not expose full cashier POS.

## 5. Backend and database architecture

`server/` is NestJS in the same project. REST **`/api/v1`**; Swagger **`/api/docs`** in development. Entry point uses `process.env.PORT` and binds **0.0.0.0**. Auth/business/workflows/media/camera/display/receipts/sync/realtime/health modules exist. Allowed operation maps prevent caller-supplied SQL/function invocation.

`server/migrations/` has **31 top-level SQL files** including `0000_compatibility.sql`, plus **17 legacy SQL files**. They preserve PostgreSQL business rules with local compatibility `auth.users`/actor helpers; custom backend does not require hosted Supabase. Historic `supabase/migrations/` still exists.

Business tables include stores, profiles/memberships/permissions, products and separate product_financials, catalogue values, permanent Rack/Shelf/Box locations, stock movements/receipts/costs, suppliers, customers/credit accounts/ledger, sales/items/financial snapshots/payments/returns, payment methods/coupons, out-for-test, purchased devices, repairs/services, shifts, settings and audit. Private schemas hold accounts/sessions/refresh digests, PIN credentials/counter sessions, approvals/idempotency, terminals/devices/pairings/jobs/captures/display capabilities, media/uploads, sync heads/changes/offline imports.

Cloud PostgreSQL is authoritative. Stock is movement-derived. Server-generated friendly product/location codes are permanent. Transactions use locks, atomic changes, exact payments, idempotency/payload checks and append-only audit/corrections. SQLite is cache/draft/outbox/receipt/reservation state; IndexedDB demo is a separate dataset, not production synchronization.

`Database.asActor` scopes a database transaction to verified actor/counter context and restricted authenticated role. RLS/permission helpers enforce active membership and granular grants; owner is unrestricted within active membership. Financial fields are separate and explicit cost/profit reads are gated. Runtime must not use a superuser/BYPASSRLS migration connection.

Custom auth uses Argon2id passwords, short-lived access JWTs, digested refresh tokens, rotation/replay revocation, session/device revoke, change password, private profile photos and rate limits. No public signup. PINs are hashed server-side and counter capability attempts are rate limited; mock PIN behavior is demo only. **Custom Google OAuth is not implemented**; retained Supabase Google support does not satisfy custom-production auth.

Local file and private S3-compatible storage abstractions support originals/derivatives/thumbs, validated image types/bounds, private capabilities, ownership/references and idempotent uploads. Foreground cloud HTTPS polling/revisions coexist with scoped LAN WebSockets. Android native background push remains deferred/unverified.

## 6. Modules that actually exist

**POS/finance:** product/model/alias/fuzzy/Roman Urdu search; persistent cart; quantity/remove/totals; CustomerCombobox and quick add; Custom Service **next to** Walk-in Customer with name/PKR charge and **no minimum field**; bargaining/coupons/minimum floor; payload-bound manager approval; review checkout; cash/digital/credit/split allocations/change/proofs/internal confirmation; atomic online sale/void/returns/refunds; old-debt collection/reversal separate from new-sales revenue; credit limits; zero-default inclusive/exclusive immutable tax; profit/reporting permissions. Electronic methods are configured account/payment-proof workflows, not automatic JazzCash/bank integrations.

**Inventory:** real API CRUD/duplicate/archive, separate owner cost query, optimistic edits, opening-stock movements; category/brand/model/grade/color/tags/aliases; permanent Rack→Shelf→Box; atomic receiving/transfers/stale-safe adjustments/history/low stock. Shared product media supports 0–12 images, batch upload, mobile capture, crop preserving original, reorder/primary/thumbs/private refs and atomic gallery save. API spreadsheet import is blocked; local CSV import/export exists, full production XLSX does not.

**Services/staff:** repair catalogue/intake/photos/status/technician and baseline used-device single-unit/IMEI/supplier flows exist. Repair advances/payment capture are deliberately rejected by API; full repair settlement/refunds are unfinished. Owner/Manager/Employee plus per-store explicit permissions, trusted provision, PIN switching and shift schedule/close/cash differences/employee reports exist online. Shared-counter PIN is not an offline unlock mechanism.

**Customer-facing:** live sanitized display states (idle/cart/checkout/payment/completed), cash/change, digital/account QR, credit order amounts, pairing/polling and browser/native adapters. Receipts/invoices are customer safe, white 80mm/A4 in dark/light UI; PDF pagination and signed virtual receipt references exist. WhatsApp opens prepared text/link; it does not automatically send or attach the PDF. Hardware printing/native second monitor remain unaccepted.

**Mobile/system:** dedicated responsive staff shell/bottom Scan/drawer, home/activity/products/inventory/reports/profile/settings/devices, photo/gallery/crop/editor, password/logout/sessions, closed Taha QR/barcode parser, foreground request/presence/poll/reconnect, explicit shop errors/diagnostics/error boundaries, themes/custom controls/help/keyboard. Native scanner default is currently **Auto**, with QR/Barcode modes. Public website, native background push, secure updater and real ESC-POS transport are deferred.

## 7. Windows — exact status and critical defect

No `src-tauri/target/debug/taha-pos.exe`, release EXE, MSI or NSIS installer was found. Fresh `cargo check --offline` failed at dependency linking because Microsoft tools are missing; app Rust has not completed type-check. PATH `link.exe` is a Git GNU tool, not MSVC. Historical October8 Tauri dev/build failed; neither native command was launched as a success today. **Do not claim a real native window has run.**

Source/config includes bundled assets/icons, centred frameless coded splash and startup recovery, single-instance focus, remembered geometry/maximized state, 1440×900 initial/1024×680 minimum, autostart off, fullscreen exit, About0.5.0, separate restricted native Customer Display window. AppData SQLite uses WAL/FULL/foreign keys, cache/receipts/drafts/reservations/outbox/pending-image tables. DPAPI protects native session cookies/offline authorization; access tokens stay in memory. SQLite itself is not encrypted/tamperproof. Native printing currently inherits BrowserPrinter; ESC-POS is an adapter boundary.

**P0 contract failure reproduced:**

- `src/stores/ui-store.ts:35` initializes `terminal-${crypto.randomUUID().slice(0,8)}`.
- `src/stores/device-bridge-store.ts` independently owns a valid UUID.
- `src/components/layout/desktop-sync.tsx:155` sends the **short UI ID** to `/stores/:storeId/sync/offline-grant`.
- `server/src/sync/sync.controller.ts` validates `terminalId` with the UUID helper.
- Actual compiled controller probe returned **HTTP400 for short ID**, accepted UUID control. Evidence: `.test-postgres/audit-20261014/terminal-contract.log`.

This error occurs before initial cache preparation and catch-all marks it OFFLINE. Native catalogue cash completion depends on that grant; this is not a usable verified cash path. Backend tests use valid UUIDs; mocked IPC tests bypass this integration. Fix canonical persisted identity/migration and error classification first, without breaking existing display/device pairings.

Release requires explicit public HTTPS `TAHA_API_URL`; private LAN release URLs are rejected. Owner advanced override is confirmed/scoped and guards pending data. No release endpoint is configured. Installing Microsoft C++ Build Tools/MSVC x64/x86/Windows SDK is the next native prerequisite; no software was installed during audit.

## 8. Offline and device-bridge risks

Native cash code atomically writes receipt/reservation/outbox with immutable UUID and final **`TM-INV-O-<UUID>`**. Backend import retains this identifier, validates authorization/current stock/floors/tax and rejects conflicts rather than silently overwriting. Signed offline cash access is eight hours after individual staff online login; PIN/counter capabilities do not receive it. Sensitive edits/receiving/adjustments/permissions/electronic confirmation and unsupported offline credit are blocked.

**Not yet production safe:** paid cash can be rejected at sync; the UI has conflict/retry/owner-review messaging but no complete audited money/stock/refund resolution. Original-employee outbox scope can strand pending work when another session/owner must repair it or the actor is deactivated. Native renderer financial inputs need further policy validation. Real SQLite/DPAPI/restart/offline-to-import acceptance is absent and the terminal contract already fails.

**LAN bridge is not packaged inside the EXE.** Existing fast PC↔phone transport requires separate running NestJS/PostgreSQL service. If that LAN service remains up, internet loss need not stop transport, but physical outage acceptance and secure cloud/LAN session/fallback deployment are unresolved. A cloud backend URL alone cannot provide an offline PC bridge.

**Android photos are bounded retries:** `mobile/android/app/src/main/java/com/tahamobiles/staff/PendingPhotos.java` permits 12 images/64MB/8MB each and deletes older than **30 minutes**. Shop-origin change and logout clear captures; default requests expire near **60 seconds**. Long outage, changed PC IP or expired job can lose/unattach a capture. Do not describe this as indefinite durable offline photo queuing. Mobile read cache is scoped/cost-free/eight-hour; financial writes require online.

Synced native image files also lack complete pruning/backup policy. DPAPI protects against different-user file theft, not same-user malware; OS/disk security and privacy retention are needed.

## 9. Android artifact and verification

Latest: **`artifacts/android/Taha-Staff-test-4E0.apk`**, **0.4E.0-test/code6**, debug package `com.tahamobiles.staff.debug`, **3,566,149 bytes**, last written October8 06:49:09 PKT. Stored SHA and v2 signature verified today; debug signed only. No release signing config/production APK and no new audit APK.

UI is bundled via WebViewAssetLoader at local asset origin; Shop Address connects to API only. INTERNET/network/camera permissions exist, debug cleartext LAN is separate from release HTTPS, external URL navigation constrained, TLS failures denied, backup disabled and errors/diagnostics sanitized. Java ShopBridge handles HTTP/cookies/files; native ZXing Activity handles scanner, Android intents handle camera/gallery.

Persistent IDs, six-digit/short-lived QR pairing, presence, assigned/claimable requests, scoped rooms, automatic uploads and target-slot insertion are implemented and partly tested. No physical camera/scanner/torch/multi-photo/lock/unlock/server-restart acceptance was performed today. Native Java unit tests and browser emulation must not be reported as such.

## 10. Fresh tests — 14 October, PKT

Tests used a new loopback-only PostgreSQL cluster **55449** and fresh fixture databases, separate frontend1435/mobile1436 and API3015. Original shop/PG data was not reset. Mobile native HTTP was emulated and mapped to isolated loopback API. Evidence folder: **`.test-postgres/audit-20261014/`**. Private fixture logs contain synthetic test credentials: do not redistribute secrets from them.

| Verification | Result | Completion time |
|---|---|---|
| Frontend lint / TypeScript | Pass / Pass | 16:37:37 / 16:37:44 |
| Backend build / lint | Pass / Pass | 16:40:42 / 16:40:43 |
| Frontend production build | Pass; separate dist-audit output | 16:43:35 |
| SQLite model/durability | 7 passed; not native Rust | 16:43:37 |
| Tauri config / Rust format | Pass; not compilation | 16:43:43 |
| Legacy security/stock/transactions | 20 / 14 / 25 passed | 16:44:49 |
| Client boundary / migrations | Pass / Pass | 16:45:03 / 16:45:09 |
| Offline terminal contract | Short ID FAIL reproduced; UUID control pass | 16:45:09 |
| Separate-connection concurrency | 2 scenarios passed | 16:45:25 |
| Custom backend full suite | 74 passed, zero failed/skipped | 16:48:17 |
| Mobile frontend build | Pass | 16:49:29 |
| Native cargo check | FAIL, missing MSVC environment | 16:50:23 |
| Selected desktop/IPC browser | 15 pass/1 startup timeout; failed case rerun passed | 16:53:48 / 16:55:51 |
| Android lint | Zero errors, ten warnings | 16:57:08 |
| APK SHA/signature | Pass; debug signer | 16:57:10 |
| Forced fresh Android units | 23 passed, zero failures | 17:00:30 |
| Selected mobile browser | 21 passed | 17:02:27 |
| Local-data desktop pairing UI | 1 passed | 17:08:24 |

Thus all 16 original selected desktop cases passed across runs, plus one pairing-UI case; it was not one clean initial run. Cold opening workspace exceeded60s once and needs investigation. Full historic browser suite, live-production/Supabase smoke, physical phone/native hardware and backup restore were not rerun. Historical API tests can default to real LAN services; rebind to isolation before running them.

Fresh responsive review covers desktop1024/1366/1440/1920, mobile390/412/1024, product editor and customer display1366/1920. Tested overflow assertions passed. UI corrections: toast overlaps sale action strip, generic Workspace breadcrumb after sale, low-contrast secondary/disabled text, long editor scroll, empty mobile chart explanation and startup/error observability. No approved layout redesign is needed.

## 11. Hosting readiness and history

Managed build/start/PORT/privateS3/polling package exists: **`artifacts/managed/Taha-API-managed-0.5.0.zip`**, 399,053 bytes, October8. No Hostinger deployment/domain/database/storage is evidenced.

Official Hostinger documentation lists NestJS on eligible managed Business/Cloud Node hosting; confirm this owner's plan. Its included DB is MySQL, while external PostgreSQL connectivity is supported. Incoming Web/Cloud WebSockets are not assumed; use HTTPS polling. Sources: [Node deployment](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/), [external database support](https://www.hostinger.com/support/connecting-a-supabase-database-to-a-hostinger-node-js-application/), [MySQL scope](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/), [connectivity limits](https://www.hostinger.com/support/which-web-standards-and-connectivity-features-are-supported-at-hostinger/). The external DB source's example name does not imply using Supabase.

PostgreSQL-specific PL/pgSQL/RLS/SET LOCAL actor roles/JSONB/UUID/sequences/locks/triggers/partial indexes/upsert/returning make MySQL a **Large rewrite/revalidation**, not routine hosting setup. Optional VPS/Docker docs remain; managed deployment must not require them. Managed external PG/media and desktop backup/restore are not yet operationally rehearsed.

Recent verified history: October8 Phase4E and5A source/reports/artifacts; October12 `scripts/start-mobile-preview.mjs` added explicit demo preview origins; October13 `scripts/build-demo.mjs` forced `/api/v1` so local demo uses real bridge. Stale October3 demo assets and prolonged PG unclean-shutdown recovery explain earlier demo/login/device-control problems. PC HTTP/WS tests are not a physical pairing pass. No source/history evidence was available for specific October9–11 development. No later Phase5B/6 report found. Root README has stale claims; prefer source and dated audit.

## 12. Security/deployment priorities and next plan

**P0:** fix native terminal/grant integration; compile actual Windows product; finish paid-offline cash reconciliation/handoff before real offline money. **P1:** durable photo/expired-job recovery; package/secure LAN service; HTTPS staging/external PG/privateS3; backups/restore; correct runtime RLS privileges/proxy/cookies/origins; physical native/mobile/display/printer acceptance; release signing and production Supabase cleanup. **P2:** repair finance, production imports, retention/UI/startup polish. **P3:** native background push, secure updater and public website.

No raw cost/profit leak was found in exercised employee paths; separate SQL/API authorization tests pass. This is not a penetration audit or a guarantee under wrongly privileged production DB credentials. Keep private proofs/media/credit history out of display/receipts. Never embed secrets in EXE/APK/frontend or reproduce them in handoff.

Recommended bounded phases:

1. **5A.1 Native identity/grant repair** — canonical UUID migration, actual frontend→grant regression, validation/auth/network separation. Small/Medium.
2. **5A.2 Windows native build/acceptance** — C++ prerequisites, Rust compile, real splash/SQLite/DPAPI/cash/receipt/customer-window test; verified EXE/installers. Medium.
3. **5A.3 Paid-offline reconciliation** — owner disposition, original employee recovery, stable invoice/idempotency/accounting tests. Large financial-only phase.
4. **5B.1 Managed HTTPS staging** — external PG/privateS3, migration/runtime separation, polling, backup/restore. Can prepare in parallel after hosting decisions. Medium/Large.
5. **5B.2A durable photos** then **5B.2B LAN/cloud bridge and Android release** — explicit retention/recovery/service deployment and physical phone matrix. Separate Medium/Large slices.
6. **5B.3 Hardware pilot** then **5B.4 security/recovery/signed release** — real monitor/thermal/HID, permission/recovery checks, controlled one-counter pilot.

Owner decisions genuinely needed: exact Node-capable Hostinger plan/API domain; external PG/private storage and recovery targets; actual printer/hardware; real payment/contact details; authorized Windows prerequisites and LAN service-installation preference; signing-key ownership before release. Do not ask the owner to repeat architecture already available in source.

## 13. Where to continue

- Main/frontend: `package.json`, `src/app/app.tsx`, `src/features/`, `src/components/`, `src/stores/`, `src/lib/repositories/`, `src/lib/device-bridge/`, `src/lib/desktop/`.
- Native: `src-tauri/tauri.conf.json`, `src-tauri/src/`, `src-tauri/migrations/001_desktop.sql`, capabilities/icons/build configuration.
- Mobile: `mobile/android/README.md`, Android app Java sources/build/manifest/network-security resources, `src/app/mobile-app.tsx`, `src/features/mobile/`.
- Backend: `server/package.json`, `server/src/`, `server/migrations/` and `legacy/`, `server/scripts/`, `server/test/`, `server/docs/`.
- Tests/scripts: `tests/`, `scripts/test-{security,stock-backend,transactions,concurrency,desktop-sqlite,client-boundary}.*`, managed/build/mobile/native scripts.
- Previous reports: `docs/PHASE2-REPORT.md`, `PHASE3A-REPORT.md`, `PHASE3B-REPORT.md`, Phase4B/4C reports, `PHASE4D_IMPLEMENTATION_REPORT.md`, `PHASE4E_IMPLEMENTATION.md`, `PHASE5A_IMPLEMENTATION.md`, `PHASE5A_WINDOWS.md`, `PHASE5A_SECURITY.md`; deployment docs under `docs/` and `server/docs/`.
- Full audit: `docs/PROJECT_STATUS_AUDIT_2026-10-14.md`.
- Evidence chronology: `docs/RECENT_DEVELOPMENT_HISTORY_2026-10-14.md`.
- Acceptance/dependency roadmap: `docs/NEXT_PHASE_ROADMAP_2026-10-14.md`.
- This self-contained handoff: `docs/CHATGPT_PROJECT_HANDOFF_2026-10-14.md`.
- Fresh audit evidence: `.test-postgres/audit-20261014/`; generated builds `dist-audit-20261014/` and `dist-mobile-audit-20261014/`. Audit fixtures are isolated and shut down after verification, not a persistent production environment.

**Instruction for the next conversation:** inspect these sources before editing, preserve the approved product and PostgreSQL financial rules, start with the specific native contract blocker, and require actual native/physical/deployment evidence at the relevant acceptance gates. Do not treat the latest phase report as proof that the whole system is ready.

