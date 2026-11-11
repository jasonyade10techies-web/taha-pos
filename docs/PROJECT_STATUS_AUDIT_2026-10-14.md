# Taha POS — project status audit

**Audit date:** 14 October 2026. **Location:** `D:\Inventory system POS`. Times below are Pakistan time, UTC+05:00. **Scope:** inspection, isolated tests, builds and documentation only; no application fixes, deployment, dependency upgrades or system-software installation.

## 1. Executive assessment

The project is an extensive working browser/local prototype with a real custom NestJS/PostgreSQL business engine, a bundled Android test application, and substantial but unaccepted Windows-native code. Phase 4E product/media/checkout work and Phase 5A desktop/offline/managed-hosting foundations exist. It is **not production ready**. No working Windows EXE, MSI or NSIS installer was found. No cloud deployment was evidenced.

The highest-priority newly reproduced defect is a native offline authorization contract mismatch: `src/stores/ui-store.ts` creates a short `terminal-xxxxxxxx` ID, while `server/src/sync/sync.controller.ts` requires a UUID for the offline grant. `src/components/layout/desktop-sync.tsx` sends the short ID. The actual compiled controller rejected that value with HTTP 400 during this audit. A UUID control succeeded. That failure precedes initial cache preparation and is mislabeled as OFFLINE. Native catalogue cash checkout depends on the grant. Passing separate backend and mocked-IPC tests does not establish a usable native cash/offline workflow.

The custom backend is meaningfully implemented, not a static UI facade. Today's isolated PostgreSQL and API tests passed. Most remaining blockers concern native integration, paid-offline conflict recovery, production hosting/security/backup operations, and physical-device/printer acceptance.

### Evidence vocabulary

- **IMPLEMENTED:** source contains a coherent workflow, not merely a page/button.
- **TESTED:** a specified automated or manual check passed; its environment is stated.
- **PHYSICALLY VERIFIED:** exercised on the actual phone, native Windows application, monitor or printer. This audit did not perform these tests.
- **DEPLOYED:** installed/configured in the intended production environment. A ZIP, debug APK or local API is not a production deployment.

Earlier owner messages establish that an Android test APK loaded, connected and logged in on a physical phone. They also establish pairing problems at that time. They do not prove today's complete camera/pairing/receipt/native workflows passed physically.

## 2. Evidence and history limitations

The project directory is **not a Git repository**. `git rev-parse`, status and history cannot supply commits, branches, diffs or uncommitted classifications. File modification times establish when files were last changed, not authorship, the original creation date, or a complete chronological history.

Read/inspected evidence includes root/frontend/backend/mobile READMEs, `docs/PHASE2-REPORT.md` through `docs/PHASE5A_IMPLEMENTATION.md`, Phase 4C subphase reports, `server/docs/`, migrations, repository implementations, native/Android sources, test suites, generated artifacts and local service/build logs. Phase 4E and Phase 5A are newer than the early continuation requirements. No subsequent Phase 5B/6 implementation report was found.

Pre-audit source timestamps are preserved in `.test-postgres/audit-20261014/source-timestamps.json`. A comparison after verification found **zero changes to those snapshotted application/source/documentation files**. Builds refreshed generated outputs; tests created isolated fixtures/logs and regenerated some QA screenshots. The four requested audit documents are new. No original database was reset or modified by audit test workflows.

Recent history is documented separately in `docs/RECENT_DEVELOPMENT_HISTORY_2026-10-14.md`. Do not treat old report pass counts as today's results. Root `README.md` contains stale descriptions of APK versions, proxy ports, offline support, hosting and the next phase alongside its newer Phase 5A section; prefer actual source and these dated audit documents.

## 3. Architecture actually present

### Frontend

Installed/resolved versions: React/React DOM **19.3.0**, TypeScript **5.9.3**, Vite **7.3.6**, Tailwind CSS **4.3.3**, Zustand **5.0.15**, TanStack Query **5.104.1**. Root application version is **0.5.0**; package ranges can differ from these installed versions.

`src/app/` composes routes/providers. Modular `src/components/`, `src/features/`, `src/hooks/`, `src/lib/`, `src/stores/`, `src/types/`, `src/mocks/` and styles/assets exist. Radix Dialog/Dropdown, Lucide, Framer Motion, custom AppSelect/AppCheckbox, virtual keyboard, InfoTooltip and shared media components form the UI system. Dexie supplies browser persistence; Fuse/search dictionaries support forgiving shop terminology. DOMPurify/sanitize-html protect rich descriptions. jsPDF/AutoTable create invoices; QRCode.react/jsQR and Socket.IO support display/scanning/device flows.

Design retains light-default workspace, charcoal sidebar and red/yellow/gold Taha branding. Light/Dark/System and appearance preferences persist. Current default typography is **Manrope**, with Inter/System choices; this differs from the original Phase 1 Inter-only request and is documented in later appearance work. No redesign is recommended by this audit.

`src/lib/config.ts`, `src/lib/repositories/interfaces.ts` and `src/lib/repositories/index.ts` select **local, api or supabase** adapters. Local/demo uses IndexedDB and explicit mock identity; API uses custom auth and REST. Native production forces the API path. Native debug can still use demo composition, so a debug window alone would not prove SQLite/offline API integration. Query keys/services centralize access rather than raw requests in every page. Device Bridge is independently implemented in `src/lib/device-bridge/`; local business data does not deliberately disable real phone pairing anymore.

Browser routes cover Dashboard/POS, products/editor/import, stock/locations/receiving/transfers/low-stock, transactions/invoice/returns, customers/credit/out-for-test, repair services/jobs, used devices/suppliers, employees/shifts/coupons/payments, reports/audit, settings/profile/login/counter and customer display/mobile capture. Protected routes load session/profile/permissions and deny unauthorized direct navigation. API production routes intentionally deny product import and website modules whose production workflows are incomplete.

Dedicated mobile composition lives in `src/app/mobile-app.tsx` and `src/features/mobile/`, using bundled hash routes for Android. Native Tauri also uses hash-compatible internal routes; normal browser development uses browser routing. Mobile is a staff utility/read/edit experience, not an exposed desktop cashier page.

### Custom backend

`server/` is the existing NestJS project in the same folder, not a separate repository. Installed NestJS core **11.2.7**, backend package **0.1.0**, pg **8.23.1**, Argon2 **0.44.0**, sharp **0.35.5**. Node requirement is **>=22 <25**. Modules include auth, business, workflows, media, camera, customer display, receipts, sync, realtime, health and development APK downloads. REST is under `/api/v1`; development Swagger is `/api/docs`. The entry point uses `process.env.PORT` and binds `0.0.0.0`.

Business services allowlist operations and execute PostgreSQL transactions under request actor/session context. The frontend does not supply SQL/function names. API repositories use shared domain interfaces and some pure mapper code still under `src/lib/supabase/mappers.ts`.

Authentication is custom email/password/session auth: Argon2id password hashes, short-lived JWT access tokens, digested refresh tokens, rotation/replay revocation, active-account/store membership checks, rate limits, session listing/revocation, password change and private profile pictures. Production cookies are HttpOnly/Secure with explicit origin controls. Browser access tokens stay in memory. Account provisioning is trusted/owner controlled; there is no public customer/employee signup. Custom Google OAuth is **not implemented**; the retained Supabase provider is not an acceptable final substitute.

Scoped WebSocket rooms deliver LAN camera/presence/display events. Cloud correctness also has authenticated HTTPS polling and revision/cursor endpoints; incoming cloud WebSockets are not required for the polling path. Foreground reconnect/presence is implemented. Native Android background push is deferred; web-push scaffolding is not equivalent to a verified Android push service.

### PostgreSQL

`server/migrations/` contains **31 top-level SQL files**, including `0000_compatibility.sql`, plus **17 legacy SQL files** in `server/migrations/legacy/`. Custom migration ordering preserves the original PostgreSQL engine using local compatibility definitions such as `auth.users` and `auth.uid`; it does not require a hosted Supabase service. `supabase/migrations/` remains as the historical provider path and is still tested separately.

Table-name extraction identified 59 declared names across the custom/legacy source trees; this is a source inventory, not a claim that every legacy compatibility table is actively used in production. Important groups:

- Identity: stores, profiles, store_memberships, permissions, employee_permissions; `app_private.accounts`, sessions, refresh_tokens, login_attempts; private counter sessions/PIN credentials/attempts and transaction approvals.
- Catalogue/stock: products, product_financials, catalog_values, locations, stock_movements, stock_receipts, stock_receipt_lines, stock_receipt_costs, suppliers.
- Finance: customers, credit_accounts, credit_ledger_entries, sales, sale_items, sale_item_financials, payments, returns, payment_methods, coupons, coupon_redemptions, out_for_test, purchased_devices.
- Operations: repair_services, repair_jobs, shifts, audit_logs, business_settings.
- Bridge/media/sync: app_private terminals, staff_devices, device_pairings, camera_jobs, camera_captures, display_sessions, media, media_uploads, sync_heads, sync_changes, offline_imports and push_subscriptions.

Key functions include `has_permission`, `is_owner`, `get_session_context`, `get_pos_products`, `get_product_financials`, `get_profit_summary`, `save_product`, `save_location`, `save_stock_receipt`, `transfer_stock`, `adjust_stock`, `complete_sale`, `receive_credit_payment`, `reverse_payment`, `return_sale_item`, `void_sale`, counter/PIN helpers, repairs/shifts and append-only audit helpers. `.test-postgres/audit-20261014/database-symbols.json` lists extracted names; not all historic functions are exposed through REST.

Stock is movement-derived with immutable history, location hierarchy validation and server-generated permanent product/location codes. Financial fields are physically separate from safe catalogue DTOs. RLS is enabled; request transactions set a restricted authenticated database role and actor context. Owner access requires active membership, not just a frontend role label. Migrations and runtime credentials have different privileges.

### Persistence and authority boundaries

Cloud PostgreSQL is authoritative for real business operations. IndexedDB local/demo data is a different demonstration dataset, not a transparent replica of production. Windows SQLite is intended to be a cache/draft/receipt/reservation/outbox boundary, not an independently authoritative stock ledger. Android maintains limited scoped read caches and temporary photo retries; it does not implement offline financial writes.

Remaining Supabase dependencies: installed `@supabase/supabase-js` **2.117.2**, optional provider/services, historical migrations/tests, mapper names and setup docs. Current builds still include SDK code. Custom production API can operate without a Supabase project, but the strict requirement of **no Supabase dependency in final production** is not yet fulfilled. Remove the live compatibility provider/SDK deliberately after preserving useful pure types/mappers/SQL history and tests.

## 4. Major module classification

“Tested” below means targeted automated coverage, not complete production acceptance. Hardware/deployment limitations apply to all rows.

| Module/workflow | Current classification | Evidence and important limits |
|---|---|---|
| Product search, aliases, Roman Urdu terms | Implemented; tested | Search API/Fuse and dictionary tests cover A15, charging patta, battri, typos and aliases. Search relevance still needs actual shop catalogue acceptance. |
| Cart, quantities, removal, totals, keyboard | Implemented; browser tested | Cart store/POS modules, touchscreen input modes and shortcuts exist. Actual Windows HID/touch acceptance pending. |
| Custom Service | Implemented; tested | Beside Walk-in Customer; name and charge, no minimum input; optional reusable service. Server snapshot has a distinct ad-hoc service path. |
| Bargaining, discounts, coupons | Implemented; SQL/API tested | Minimums and coupon eligibility/floors checked server-side; purpose-bound approval cannot be reused for another cart/price. |
| Checkout cash/digital/credit/split/review | Implemented online; tested | Exact allocations, change, proof rules and review snapshot. Native catalogue cash path blocked by grant ID mismatch. No bank/payment-provider integration: verification is internal staff approval. |
| Manager approval | Implemented; tested | PIN/capability and permission/payload-bound transaction approval. No unrestricted role-only override. |
| Customer search/quick add/details | Implemented; browser/API tested | Individual/business/phone search, recent selection and quick add; credit info permission gated. |
| Receipt, invoice, PDF, virtual receipt | Implemented; browser/API tested | White 80mm/A4, safe signed references, jsPDF pagination. Real thermal printer and native print dialog not tested. WhatsApp opens prepared text/link, does not silently send or attach PDF. |
| Returns/voids/refunds | Implemented online; SQL/API tested | Atomic append-only corrections, chosen restock location, damaged/finance-only handling. Physical cash refunds are manual acknowledged actions, not automatic payment-network refunds. |
| Product CRUD/duplicate/archive | Implemented; API tested | Permanent internal codes, optimistic timestamp version checks, protected cost query, opening-stock movements. |
| Gallery and product editor | Implemented; browser/API tested | Up to 12 media, batch selection/crop/original preservation/reorder/primary/thumbs/private references/atomic save; phone delivery still needs physical acceptance. |
| Categories/brands/models/grades/colors/tags | Implemented | Catalogue values and product fields exist; delegation and sanitization tested. Not a separate enterprise taxonomy engine. |
| Rack → Shelf → Box and stock history | Implemented; SQL/API tested | Permanent codes, hierarchy/cycle rules, balances and movements. |
| Receiving/transfers/adjustments/low stock | Implemented online; SQL/API tested | Atomic receipts, paired transfers, stale-balance rejection, costs/permissions separated. Prohibited offline. |
| Spreadsheet import/export | Partial | Local CSV flows/exports exist; API product import is route-blocked. No verified XLSX production import/mapping/error recovery. |
| Credit/old-debt collection | Implemented online; tested | Ledger, limits, partial sales, allocation/reversal; old debt is not new sales revenue. Native offline credit not enabled. |
| Cash/JazzCash/Easypaisa/bank | Implemented accounting/config/UI | Proof capture/internal approval and displayed account snapshots; actual production payment accounts/QR and external reconciliation remain owner/operational setup. |
| Tax | Implemented; API/SQL tested | Default zero, inclusive/exclusive profiles, immutable sale tax snapshots, returns and profit exclusion. Not a certified jurisdictional tax integration. |
| Profit/reporting/Dashboard/audit | Implemented; tested | Per-permission aggregates, Karachi ranges/buckets, exact chart point values, append-only actor audit. No forensic/production reporting acceptance yet. |
| Repair catalogue/intake/jobs/photos/status | Partial functional workflow | Services/jobs/technician/photos and scoped permissions implemented. API intentionally rejects repair advances/payment capture; complete repair settlement/refunds deferred. |
| Purchased devices/IMEI/suppliers | Implemented baseline; tested | Single-unit lifecycle and private photos; buying requires sensitive-cost permission too. Full device inspection/warranty workflow not proven. |
| Roles/permissions/employees/PIN | Implemented online; tested | Owner/Manager/Employee plus granular per-store grants, trusted provisioning, hashed PIN, rate limits. PIN employee switching is not an offline unlock flow. |
| Shifts/cash closing/employee reports | Implemented baseline; tested | Schedule/actual/open/count/difference/closing and employee aggregates; closed history protection and late reversal tested. Physical drawer reconciliation pending. |
| Customer Display | Implemented browser/remote; tested | Idle/cart/payment/cash/digital/credit/complete states, safe projection, pairing/polling. Native dedicated window code exists but no native/second-monitor acceptance. |
| Mobile dedicated home/navigation/profile | Implemented; browser tested | Responsive home, activity/products/inventory/reports/devices/profile, password/session/photo/theme; no full mobile cashier workflow intended. |
| Phone pairing/scanner/camera/gallery | Implemented; API/Java/browser tested | Persistent device/counter IDs, code/QR, assigned/claimable requests, scoped events, native scanner/capture, multi-select. End-to-end physical retest outstanding. |
| Mobile notifications/background | Partial | Incoming foreground request and polling/reconnect; web-push code. Native background push not complete/verified. |
| Android offline read/photo retry | Partial, bounded | 8-hour scoped read cache; app-private retries. Photos expire at 30 minutes and camera jobs usually at 60 seconds; not durable long-outage photo storage. |
| Windows SQLite/outbox/crash drafts | Implemented source/schema; native blocked | SQL durability and mock IPC tested. Real Rust SQLite/DPAPI startup and cash-to-import integration not verified; grant contract currently broken. |
| Settings/alerts/themes/help | Implemented baseline; tested | Custom controls, bounded toasts, semantic alerts, InfoTooltip, system/reduced-motion preferences. Some legacy labels/docs and toast placement need polish. |
| Backups/recovery | Partial preparation | Docker/VPS scripts and deployment notes; no managed PG/S3 or desktop restore rehearsal/automation. |
| Public website/enquiries | UI/adapters; intentionally unavailable in API app | Production route access denied. No deployed public website/customer login. |
| Secure updater/ESC-POS/discovery/native push | Intentionally deferred | Boundaries or settings exist, not complete workflows. |

## 5. Windows: exact status

Audit prerequisite script and direct inspection:

| Item | Verified status |
|---|---|
| Rust | `rustc 1.99.0 (b940084d7 2026-09-28)` |
| Cargo | `cargo 1.99.0 (5f94df478 2026-08-27)` |
| rustup | `1.29.1`; stable-x86_64-pc-windows-msvc active/default |
| Tauri | Installed JS API/CLI 2.12.1; Rust resolved 2.12.1 |
| MSVC | Missing: vswhere/MSVC C++ compiler absent. PATH `link.exe` is a Git GNU tool, not the required Microsoft linker. |
| Windows SDK | Missing: required installed SDK headers/libraries not found. |
| `cargo check --offline` today | Failed building dependency: MSVC linker environment missing. Application Rust code did not reach full type-check. |
| `npm run tauri dev` / `tauri build` today | Not launched after prerequisite/check failure. Historical October 8 attempts failed. Browser development is not native acceptance. |
| EXE/MSI/NSIS | No `taha-pos.exe` in debug/release and no generated installer found in the native output tree. **No artifact path can be supplied.** |

Native code/config: locally bundled `frontendDist`, coded Taha icons, frameless centred splash, staged startup/recovery, hidden main window revealed after initialization, single-instance focus, window-state persistence, 1440×900 initial/1024×680 minimum, fullscreen exit and optional autostart off by default. About shows 0.5.0; signed updater is disabled.

`src-tauri/src/{lib,desktop,outbox,vault,http,images,bridge_config}.rs`, `src-tauri/migrations/001_desktop.sql` and `src/lib/desktop/` implement AppData persistence, WAL/FULL SQLite, DPAPI cookies/grants, local receipts/drafts/reservations/outbox/images, scoped HTTP and backend configuration. Customer display is a separate restricted Tauri window. Main-only sensitive IPC is designed to exclude the customer window.

Release build requires an explicit public HTTPS `TAHA_API_URL`; private LAN URLs are rejected by release checks. Owner-only advanced overrides require confirmation and block unsafe switches with pending data. No release endpoint/domain is configured/evidenced. No password/database/JWT signing secret should enter the executable.

Prerequisite installation **was not performed**. A future authorized installation needs Microsoft Visual Studio Build Tools with Desktop development with C++, x64/x86 MSVC and a supported Windows SDK, then a developer environment restart and fresh native checks. Automation can assist later; administrator/install interaction may be necessary. Do not attempt production packaging until native compilation and the grant bug are resolved.

## 6. Offline engine and device bridge

### Windows offline

The DDL and TS/Rust code implement cached safe catalogue/prices/minimums/stock/locations/customer/payment/settings, immutable transaction UUIDs, reservations, receipts, drafts, outbox attempt/status/error metadata and automatic retries. SQLite uses foreign keys and full synchronous WAL. Offline invoice `TM-INV-O-<UUID>` is final, preserved by backend import; it is deliberately longer than sequential online invoice numbers.

Signed cash authorization is issued after an individual employee signs in online, valid for eight hours. Shared-counter PIN capabilities do not receive that grant. Cash completion writes receipt/reservation/outbox atomically, and synchronization reuses the transaction UUID/payload identity. Server import revalidates store/actor/current policy, stock, prices/tax and duplicate payloads. Changed/insufficient stock or invalid authorization produces conflict rather than silent overwrite. Stock receiving, sensitive edits, adjustment, permission administration, remote electronic confirmation and unsupported credit are denied offline.

**What cannot be claimed:** real Windows offline launch, SQLite plugin/DPAPI functioning, cached search/cash completion/printing/restart recovery on this machine. The terminal mismatch blocks the intended path even before native physical testing. Seven Node/SQLite checks and four mocked-IPC browser cases are evidence of particular rules, not the complete native integration.

**Paid-offline conflict risk:** a collected cash transaction can be retained locally but rejected by cloud. UI offers error/retry/owner review; there is no complete audited reconciliation, refund/adoption/stock disposition workflow. Original-employee scope also creates a handoff risk if another owner/session needs to repair an outbox or the original actor is deactivated. Native financial commands need further server-grade validation of all frontend policy assumptions before accepting untrusted renderer input.

### LAN/cloud bridge

Desktop/local demo and API business data can both use the custom Device Bridge service. Terminal/device registration, short-lived hashed pairing capabilities, six-digit codes, presence, requests, assignment/QR claim, photo capture/upload and insertion are scoped by store/terminal/device/job. Backend tests verify assignment, revocation, expiry and cross-identity denial. Browser staff pairing controls pass without “API mode” language.

However, the EXE does **not** currently include or install a self-contained LAN bridge server. The fast bridge still requires the separate NestJS service and PostgreSQL to run on an accessible PC/server. If that local service remains up, internet loss need not prevent LAN transport; actual phone/PC outage acceptance is outstanding. A cloud-only URL does not magically expose an offline PC bridge. Cloud/LAN identities and fallback/session handoff need a defined production deployment model.

Cloud foreground polling avoids dependence on incoming managed-hosting WebSockets. Native/Android reconnect listeners exist, but repeated lock/unlock, Wi-Fi change, LAN internet loss and server restart still need physical testing. No arbitrary global broadcast is intended.

### Images

Android app-private pending files are bounded to 12 images, 8 MB each and 64 MB total. `PendingPhotos.java` deletes files older than **30 minutes**. `ShopBridge` clears captures/cookies on shop-origin changes; logout also clears captures after a warning. Default requests expire around **60 seconds**. Prolonged outage, changed PC IP, logout or expired request can lose/unattach an unsent image. This is not the promised indefinite durable offline photo queue.

Windows pending-image code has bounded per-file/unsynced capacity, idempotent uploads and server file IDs; synced local files currently have no finished retention/pruning/backup lifecycle. SQLite/receipt/customer cache is not encrypted. DPAPI does not protect against malware running as the same Windows user. Use least privilege, Windows user security and disk encryption; document retention rather than claiming a tamperproof local database.

## 7. Android exact status

This is a **custom Java Android WebView application**, not Capacitor/TWA. AndroidX WebViewAssetLoader serves bundled assets locally; `ShopBridge` handles private authenticated HTTP, origin-scoped cookies, lifecycle/events and app-private files. It does not load the whole UI from Vite. Configured Shop Address is the backend origin. UI remains available with explicit connection/setup/errors while backend is offline.

Build: min SDK 26, target/compile SDK 35, JDK 17, Gradle 8.11.1. Current application version **0.4E.0-test**, version code **6**, debug package `com.tahamobiles.staff.debug`.

Latest artifact: **`artifacts/android/Taha-Staff-test-4E0.apk`**, 3,566,149 bytes, last modified 8 October 2026 at 06:49:09 PKT. Stored SHA matches; Android APK v2 signature verified today. It is **debug signed**, not a production release-signed distribution. No new APK was built for this audit. Source/ZIP later changes do not update an installed APK automatically.

Manifest verifies INTERNET/network state/camera/vibration; debug LAN cleartext is separated from release HTTPS, backup disabled, external navigation constrained and TLS errors not bypassed. Native ZXing scanner and square/wide viewfinder are implemented; current default is **Auto**, then explicit QR or Barcode. Camera/Photo Picker returns multiple gallery images where appropriate; profile/proof remain single-image flows. Actual focus/torch/gallery/vendor permissions, scanner decode speed and upload on a physical phone were not tested today.

Connection checks have timeout and explicit invalid/unreachable/network/server/auth states. Hash-route refresh/error boundaries and safe diagnostics are browser tested. Persistent device identity/pairing and foreground reconnect/polling exist. Mobile owner dashboards/profile/product edits work against an isolated API in browser-native emulation; this does not verify real Java HTTP/cookies or Android camera hardware.

Today's active Ethernet IPv4 is **192.168.1.4**, not older .8/.3/.7 values. Any test APK LAN address/download guide must derive the current address and verify the local API is running; no permanent production IP is claimed. Audit APIs were loopback-only and are not a phone download service.

## 8. Security and financial controls

Verified architectural protections:

- Safe employee product DTOs omit purchase cost/valuation/profit. `product_financials` and sale-item cost snapshots are separate; explicit cost/profit routes/helpers are permission gated. Used-device purchase prices are omitted without the cost grant. Aggregate profit permission does not imply raw cost permission.
- Actor context, active profiles/membership, RLS and allowlisted security functions enforce backend permissions; UI guards provide an additional user experience layer. Runtime role is intended to lack BYPASSRLS; using migrator/superuser credentials at runtime would invalidate this protection.
- PIN hashes/counter capabilities stay server-private, failed attempts persist and lock. Custom passwords use Argon2id; refresh token database records are digests. Sessions recheck active state, rotate/revoke and avoid frontend persistent password/token storage.
- Stock/credit/payment/return/void/out-for-test mutation is atomic, idempotent and audited. Separate-connection tests cover competing last-unit sales and identical retry. Transfers preserve totals; tests convert held stock without deducting twice. Reversals retain originals and append ledger records.
- Digital proof/image access is private, type/store/actor checked and references protected. Product descriptions are sanitized; uploads validate image content and bound processing. Customer receipt capabilities are separate from staff auth and omit private costs/proof/history/notes.
- Tax/price/payment snapshots are immutable for completed sales; employee IDs and audit actors come from verified session context, not caller-selected identity.

Production controls still needing acceptance/hardening: terminal contract and native financial boundary, paid-offline reconciliation, original employee outbox recovery, long-outage photo retention, deployment runtime grants, reverse proxy/cookie/origin/HTTPS configuration, private S3 permissions/limits, managed DB/desktop backups and restore drills, retention/pruning, account recovery/provisioning operational UX, native/release signing and dependency/provider cleanup. No penetration test, independent security review or production-load/availability acceptance was performed.

The separate mock/local dataset has simulated business/security behaviors. It must never be presented as secure production authorization or silently combined with a real user's production cache. No secrets are reproduced in this report.

## 9. Hosting compatibility and deployment assessment

Current official Hostinger documentation lists NestJS support on eligible Business/Cloud managed Node.js hosting with GitHub/ZIP deployment and build/start configuration. This does not identify the owner's subscription or entitlement. [Managed Node deployment requirements](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

Use Node 22/24 per backend engines, environment PORT, build/start scripts and persistent managed process lifecycle. `server/scripts/build-managed.mjs`, `managed-start.mjs`, compiled migration tools and `artifacts/managed/Taha-API-managed-0.5.0.zip` exist. The ZIP is 399,053 bytes, dated October 8; sampled entries include an environment **example**, not an actual credential file. No deploy was attempted.

Keep custom NestJS with **external managed PostgreSQL**. Hostinger documents external database connectivity; its included managed/shared database is MySQL, so PostgreSQL must be external for this path. This is a database-connectivity statement, not a proposal to return to Supabase. [External database connections](https://www.hostinger.com/support/connecting-a-supabase-database-to-a-hostinger-node-js-application/), [Hostinger MySQL scope](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/).

Do not assume incoming WebSockets on managed Web/Cloud: official connectivity documentation distinguishes outgoing support. Cloud HTTPS polling is therefore the supported correctness path, with optional LAN WebSockets. [Connectivity limitations](https://www.hostinger.com/support/which-web-standards-and-connectivity-features-are-supported-at-hostinger/).

Managed deployment does not require Docker/root SSH/Caddy/systemd. These remain in optional VPS docs. Required choices: supported plan, API domain/TLS, external PG provider/region, private S3-compatible bucket, production origin/auth configuration, migration/runtime roles, backup/restore and monitoring. Filesystem storage can be used locally, but managed ephemeral/redeploy durability is not assumed; use private object storage for production. No domain, hosted database or cloud storage deployment is evidenced.

The PostgreSQL engine uses PL/pgSQL functions, RLS/SET LOCAL role/claims, JSONB, UUID/sequences, transaction/row/advisory locks, triggers, constraints, partial indexes and PostgreSQL upsert/returning behavior. MySQL requires redesign of authorization/function execution/migration syntax plus stock/financial concurrency revalidation: **Large** relative complexity, not a connection-string swap. Do not migrate automatically because a hosting plan offers MySQL.

Backups: optional VPS Docker scripts are not a managed PostgreSQL/S3 backup solution. Choose automated PG snapshots/PITR and private-media versioning/retention, add a restore runbook and rehearse restoration to isolation. Desktop SQLite/DPAPI/AppData recovery also needs an explicit policy. Marketing backup coverage is not evidence that these external stores are backed up.

## 10. UI/UX audit

Fresh browser screenshots cover desktop 1024/1366/1440/1920 widths, product editor 390/412, customer display 1366/1920, mobile 390/412/1024, checkout and white receipts. No horizontal overflow was found in the tested responsive assertions. No page errors occurred in the mobile shell-route test. Native/WebView hardware rendering remains unverified.

Positive findings: approved compact POS/cart retained; customer and Custom Service are side-by-side with duplicated cart icons removed. Gallery/crop/editor/checkout use consistent custom components. Customer payment QR and order are visible together; receipt paper stays white in dark mode. Mobile has its own bottom Scan navigation, dark drawer, profile sheets and clear unpaired state.

Prioritized corrections, without redesign:

| Priority | Finding | Evidence / scope |
|---|---|---|
| P1 | Validation/auth failures shown as OFFLINE | `DesktopSync` catch-all; proven grant failure miscommunicates network state. |
| P1 | Paid offline conflict has no complete owner resolution | Sync status/errors/retry are insufficient to account for already received cash. |
| P2 | Cold workspace can stay on loading long enough to hit a 60s test timeout | Fresh desktop run failed initial opening; warm rerun passed. Investigate initialization/error observability before demos/native pilot. |
| P2 | Top-center toast covers sale-complete action strip | Fresh `receipt-dark.png`; success toast obscures nearby actions temporarily. Adjust toast safe area later. |
| P2 | Generic Workspace → Workspace context after sale | Fresh sale-complete screenshot; use transaction/invoice context. |
| P2 | Secondary/minimum-price/location text and disabled controls need contrast review | Fresh POS and dark receipt screen. Preserve density; improve legibility/accessibility where needed. |
| P2 | Long editor hierarchy requires substantial scrolling on 1024 | Fresh product editor; not cut off, but primary metadata after large description/media sections can be slower to reach. |
| P2 | Mobile empty sales chart uses large area without a clear no-activity explanation | Fresh isolated-data Home screenshot. Do not mistake zero data for failed loading. |
| P2 | Scanner fallback is a sheet; actual native full-screen scanner is different | Browser screenshot verifies square target/error UI only. Compare native autofocus/torch/safe areas on physical device. |
| P2 | Currency/mode/doc language requires release sweep | Central PKR formatter exists. Demo labels valid only in explicit demo; legacy technical and stale README terms should not reach production. |
| P3 | Default Manrope differs from early Inter spec | Owner already approved later screens; confirm typography only if changing design system later. |

AppSelect uses a hidden semantic native select with a custom visual menu; its existence is not evidence of a visible basic dropdown. AppCheckbox and hidden labelled upload inputs are intentional accessibility mechanisms. Product/gallery image fixtures and missing camera permission in browser screenshots are test conditions, not proof of broken Android camera hardware. Receiving/locations/credit/settings sources were reviewed; their entire browser interaction matrix was not rerun today.

## 11. Today's safe test results

All timestamps are **14 October 2026 PKT** and represent log completion time, not a physical-device test time. Isolated portable PostgreSQL ran on 127.0.0.1:55449 with fresh test databases. Original cluster 55439 and original shop data were not reset. Mobile fixture API was 127.0.0.1:3015; browser-native transport mapped a synthetic LAN-looking URL to that loopback fixture. Audit frontend ports 1435/1436 were separate from the existing demo ports. Test outputs are in `.test-postgres/audit-20261014/`.

| Check | Result today | Completed | Evidence |
|---|---|---|---|
| Frontend lint | PASS | 16:37:37 | `frontend-lint.log` |
| Frontend TypeScript | PASS | 16:37:44 | `frontend-typecheck.log` |
| Backend build / lint | PASS / PASS | 16:40:42 / 16:40:43 | `backend-build.log`, `backend-lint.log` |
| Frontend production build | PASS; 2705 modules | 16:43:35 | `frontend-build.log`; separate `dist-audit-20261014/` |
| SQLite SQL/durability tests | 7 passed | 16:43:37 | `sqlite-tests.log`; Node SQLite, not Rust-native execution |
| Tauri config / Rust formatting | PASS | 16:43:43 | `tauri-config.log`; formatting checked, not compilation |
| Legacy PostgreSQL security/stock/transactions | 20 + 14 + 25 passed | 16:44:49 | `security-tests.log`; isolated fixtures |
| Client privileged-key boundary | PASS | 16:45:03 | `client-boundary.log` |
| Migration validation | PASS | 16:45:09 | `migrations.log`; backend suite separately applies custom migrations |
| Native offline ID contract probe | FAIL reproduced; UUID control PASS | 16:45:09 | `terminal-contract.log`; actual compiled controller with safe stub context |
| Separate-connection concurrency | 2 scenarios passed | 16:45:25 | `concurrency.log`; real isolated PostgreSQL |
| Full custom backend suite | 74 passed, 0 failed/skipped | 16:48:17 | `backend-tests.log`; 258.319 seconds |
| Mobile production build | PASS | 16:49:29 | `mobile-build.log`; separate `dist-mobile-audit-20261014/` |
| Rust `cargo check --offline` | FAIL: missing MSVC linker environment | 16:50:23 | `rust-check.log`; not a completed application type-check |
| Desktop/browser/mock IPC initial run | 15 passed, 1 failed startup timeout | 16:53:48 | `browser-tests.log`; opening workspace absent at 60s |
| Failed desktop case rerun | 1 passed | 16:55:51 | `browser-recheck.log`; all 16 distinct original selected cases passed across runs, not one clean run |
| Android debug unit/lint command | BUILD SUCCESS; lint 0 errors, 10 warnings | 16:57:08 | `android-tests-lint.log`; initial unit task cached |
| Existing APK signature/SHA | PASS, v2 debug signer | 16:57:10 | `apk-signature.log`; no APK rebuild |
| Android unit tests forced rerun | 23 tests, 0 failures | 17:00:30 | `android-tests-fresh.log` and fresh XML; 21 Gradle tasks executed |
| Mobile browser selected suite | 21 passed | 17:02:27 | `mobile-browser-tests-final.log`; Java/native camera emulated, isolated API used |
| Local-data desktop pairing UI | 1 passed | 17:08:24 | `device-bridge-ui.log`; no “API mode” requirement in normal controls |

Build warnings about static/dynamic imports, Gradle deprecated APIs and ten Android lint warnings were non-blocking. They should be reviewed before release. The initial mobile run was stopped after two pure checks to bind the workflow suite explicitly to isolation; the later 21-case result above is the complete selected run. A temporary fixture module-resolution problem was corrected in the audit copy, not application source.

Not run: entire historical Playwright matrix, tests against a live Supabase project, live-production smoke, hosted Google login, production database load testing, native Windows app/dev/build/installer, emulator/instrumentation camera tests, real phone/monitor/printer/HID acceptance, backup restoration. Some historical integration tests default to current LAN/shop services and must be rebound to isolated fixtures before execution. Do not run them blindly against shop data. No browser result is reported as native/physical.

## 12. Gap analysis

| Module | Current status | Evidence | Missing work | Priority | Dependencies |
|---|---|---|---|---|---|
| Native grant/cache/cash | Broken contract | UI short ID vs backend UUID; reproduced 400 | Persistent identity migration, correct error classification, real cross-layer integration test | P0 | Existing bridge UUID/native session contracts |
| Paid offline reconciliation | Partial; accounting risk | Conflict status/retry only | Audited owner resolution, money/stock disposition, original-actor handoff and exact idempotency | P0 before offline use | Correct native identity, real SQLite execution |
| Native executable | Blocked | Missing MSVC/SDK; cargo dependency failure; no artifacts | Toolchain, compile repairs if exposed, actual native smoke | P0 for requested installed product | Authorized external prerequisite installation |
| Android pending photos | Bounded retry; loss risk | 30-minute TTL, origin/logout clear, 60-second request | Durable long-outage/expired-job recovery and visible expiry warning | P1 before promising durable offline images | Bridge/media server contract |
| LAN bridge in installed product | Not packaged | Separate NestJS/PG process | Decide/install secure local bridge lifecycle; cloud/LAN identity/fallback model | P1 | Windows build, owner deployment choice |
| Managed cloud/DB/files | Prepared, not deployed | Managed scripts/ZIP/poll endpoints | Plan/domain/external PG/private S3/TLS/env/runtime privileges | P1 | Owner hosting/provider choices |
| Backup/restore | Not operationally verified | VPS scripts only | Managed PG/media and AppData policy + isolated recovery drill | P1 | Selected hosting/retention/RPO/RTO |
| Runtime security/release | Partially tested | RLS/auth suites pass; release unaccepted | Proxy/cookies/TLS limits/IAM/account recovery/native validation/release signing | P1 | Staging and native runtime |
| Supabase removal | Incomplete | Installed SDK/provider/mappers/tests | Remove production live dependency while preserving useful pure engine code | P1 | Custom API path regression coverage |
| Android release | Debug APK only | 4E0 code6/debug certificate | Release keystore ownership, HTTPS config, physical acceptance | P1 | Staging endpoint, signing decision |
| Customer display/printing/scanner | Source/browser ready | Native window and BrowserPrinter/HID boundary | Real monitor/thermal/WebView/HID tests; selected printer adapter | P1 | Native build; hardware |
| Repair financial completion | Partial intentionally restricted | API rejects deposits/payments | Separate repair collection/settlement/refund phase | P2 | Accepted transaction foundation |
| CSV/XLSX production import | Local CSV only | API route intentionally denied | Scoped validated import preview/idempotency/rollback/XLSX if required | P2 | Production catalogue migration plan |
| UI contrast/loading/toasts/context | Minor and observed issues | Fresh screenshots/startup timeout | Focused corrections with approved layout retained | P2 | Native/production state acceptance |
| Native media/cache retention | Partial | Synced files retained | Pruning/size limits/recovery without deleting unsynced work | P2 | Backup/retention policy |
| Native push/updater/public website | Deferred | Boundaries/UI, not complete workflows | Separate later phases | P3 | Signed release/cloud accepted |

## 13. Requirements assessment and next action

Brand/PKR/approved layout, rich gallery, safe receipts, zero-default tax, customer display projection, independent bridge services and PostgreSQL atomic business logic are materially implemented and tested. Real installed Windows operation, reliable native offline lifecycle, indefinitely safe offline photo handling, complete paid-conflict recovery, final Supabase removal, production hosting/backups and physical acceptance remain unmet.

First undertake a **small native terminal/grant contract repair phase**, then install/verify the Windows toolchain and exercise the native cash/outbox path. Resolve paid-offline conflicts before enabling it for real money. Managed HTTPS staging with external PG/private S3 can be prepared in parallel after owner hosting choices. Do not begin another broad module expansion.

The detailed dependency/acceptance roadmap is `docs/NEXT_PHASE_ROADMAP_2026-10-14.md`; the copyable cross-conversation brief is `docs/CHATGPT_PROJECT_HANDOFF_2026-10-14.md`.

