# Phase 5A implementation report — Taha POS 0.5.0

Implementation date: 8 October 2026. Native Windows acceptance remains blocked by missing MSVC and Windows SDK. No EXE, MSI or NSIS installer was produced, and no physical native-window success is claimed.

## Windows application

The approved Dashboard, POS, product/media workflows, branding, Android and IndexedDB demo remain. Tauri release configuration bundles the React UI and coded-logo splash locally. Main window is 1440×900, minimum 1024×680; geometry/maximized state persists. Single-instance activation focuses the existing counter. Autostart defaults off, fullscreen can be exited with F11, and About shows 0.5.0. Approved TM application icons are retained. Customer display uses a dedicated native window and sanitized internal events, with no staff database or authentication access.

Native database, receipts, drafts, metadata and image files live in the user's AppData directory, not Program Files. Windows refresh/session cookies and offline authorization are encrypted with current-user DPAPI. Access tokens stay in memory. SQLite is not encrypted; see the documented Windows-user/BitLocker threat model.

## Offline engine

SQLite uses WAL, FULL synchronous commits and foreign keys. Cost-free catalogue/prices/minimums, stock snapshot, locations, customers and receipt/payment settings are cached behind the existing repository interfaces. Browser/demo keeps IndexedDB. Cloud remains authoritative.

Native catalogue cash checkout atomically commits one local receipt, stock reservation and outbox item. Invoice `TM-INV-O-<transaction UUID>` is final and preserved by server import, audit and idempotency snapshots. Signed eight-hour offline cash access is issued after individual staff sign-in online. PIN switching/shared-counter PIN sessions require the server and do not receive offline access in this version.

Drafts are restored before network checks; completed receipt UUIDs prevent duplicate checkout after a crash. Outbox supports PENDING, SYNCING, SYNCED, CONFLICT and FAILED. Reconnection synchronizes automatically with retry/backoff and current server permission/stock/price/tax checks. Conflicts do not overwrite cloud data. Settings → Synchronization shows pending work, last sync and retry. Pending work is scoped to the original employee; signing out does not delete it, but that employee must sign in again to synchronize it.

Offline credit, coupons, custom services, test conversions, manager overrides, electronic confirmation, inventory mutations, product/price/cost edits and staff administration remain blocked. White-paper 80 mm receipts work locally. BrowserPrinter is preserved; WindowsPrinter and an ESC/POS transport interface are prepared. Actual physical printer behavior remains unverified.

## Backend and hosting

The custom NestJS/PostgreSQL backend is preserved. Production Windows builds require the real public HTTPS `TAHA_API_URL`; no LAN release address or server secret is embedded. Owner-confirmed backend changes clear the session and are blocked while unsynced operations exist.

Primary deployment is Hostinger managed Node.js with external managed PostgreSQL and private S3-compatible storage. The backend uses platform PORT, binds 0.0.0.0, and has build/start/migration tooling without Docker/root SSH/systemd requirements. Deployment package:

`D:\Inventory system POS\artifacts\managed\Taha-API-managed-0.5.0.zip`

No Hostinger deployment was performed. The actual plan, domain, production database and storage have not been selected.

Cloud correctness uses authenticated HTTPS revision/cursor polling, four seconds active and thirty seconds inactive. Native POS consumes the revision-updated SQLite catalogue instead of refetching a full catalogue after each change. Initial preparation and post-sale recovery take explicit snapshots. The database revision head is commit ordered per store.

New production migrations:

- `server/migrations/202610080200_desktop_sync.sql`
- `server/migrations/202610080300_media_outbox.sql`

PostgreSQL-specific dependencies include PL/pgSQL, SECURITY DEFINER/search_path, RLS/policies, transaction-local identity/role switching, jsonb, UUID types, partial indexes, ON CONFLICT/RETURNING, advisory locks, row locks, triggers and sequences. MySQL would require a separate function/security/locking/migration rewrite and full financial/concurrency revalidation, estimated in engineering weeks after a detailed inventory. No conversion was started.

## Device bridge and photos

LAN phone pairing/presence/capture stays independent of the business provider and cloud endpoint. The native counter can operate the existing LAN NestJS bridge directly without a browser counter page. The LAN service must still run separately on the shop PC; a bridge daemon is not packaged in this EXE architecture yet.

Cloud device updates use foreground HTTPS polling; LAN retains WebSockets. Explicit bridge host changes require sign-in/pairing; automatic authentication transfer between LAN and cloud is not implemented.

Captured offline Windows images are durable AppData files with an outbox reference and stable upload UUID. Upload retries reuse one server media record. Limits are 10 MB per image and 64 MB pending; failures are explicit. Synced local files are retained, with no automatic pruning yet. Product save remains explicit after reconnection.

## Verification evidence

- Frontend production build and TypeScript: passed.
- Frontend and backend lint: passed.
- Full backend suite: 74 passed, zero failures, using real PostgreSQL.
- SQLite schema/durability suite: 7 passed.
- Native IPC browser contract suite: 4 passed, covering visible startup recovery, scoped cache/delta reads, stable cash checkout restrictions, upload reuse and fullscreen control.
- Existing Phase 4E UI suite: all 12 cases passed across the full run and two targeted reruns; desktop/mobile reflow, catalogue, media, POS and dashboard checks retained.
- Compiled local UI with an unreachable backend: visible login in approximately 1.1 seconds, zero page errors, using mocked native IPC. This is not a physical Tauri test.
- Managed compiled npm-start launcher: passed assigned-PORT and database-health check without Docker.
- Android frontend build: passed; existing 4E0 APK retained, no new physical Android test claimed.
- Tauri JSON schema, icons and capabilities: validation passed. Rust formatting/parser check passed.
- `npm run tauri dev` and `npm run tauri build`: attempted; blocked at dependency linking by missing MSVC/SDK, before project Rust type-check/native window launch.

The source-module Vite IPC harness can take over thirty seconds on a cold Windows filesystem; it waits for actual UI readiness with a sixty-second assertion budget. The compiled startup check does not use that source-module delay.

## Current local testing links

- Counter: http://localhost:1423/dashboard
- API bind: 0.0.0.0, port 3001
- Current Ethernet IPv4: 192.168.1.6
- Health: http://192.168.1.6:3001/api/v1/health
- Existing Android APK: http://192.168.1.6:3001/api/v1/downloads/staff-test-4e0.apk

LAN addresses can change; these are current development links, not production defaults.

## Manual prerequisites and next phase

Rust is installed: rustc 1.99.0, cargo 1.99.0, rustup 1.29.1, stable-x86_64-pc-windows-msvc. Install Visual Studio Build Tools with Desktop development with C++, MSVC x64/x86 and a Windows 10/11 SDK. Then run native acceptance from `PHASE5A_WINDOWS.md`; select the real HTTPS endpoint before a release build. Confirm the actual Hostinger managed-Node plan, API domain, managed PostgreSQL and private storage credentials before deployment.

Next: **PHASE 5B — ACTUAL HOSTINGER MANAGED BACKEND DEPLOYMENT + PRODUCTION DATABASE + FINAL WINDOWS INSTALLER**. Complete native offline/reconnect/customer-display/phone/printer acceptance before calling the installer production ready.

Detailed guides: [Windows/offline](PHASE5A_WINDOWS.md), [managed Hostinger and database assessment](HOSTINGER_DEPLOYMENT.md), [security threat model](PHASE5A_SECURITY.md).
