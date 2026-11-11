# Taha POS — TAHA MOBILES

Phase 5A prepares the **bundled Windows desktop product**, SQLite cash/outbox engine, native customer display, secure Windows sessions and managed Node.js package. See [Windows/offline guide](docs/PHASE5A_WINDOWS.md), [security model](docs/PHASE5A_SECURITY.md) and [Hostinger guide](docs/HOSTINGER_DEPLOYMENT.md). PostgreSQL is preserved; no hosting deployment or MySQL migration has occurred. Native binaries remain blocked by missing MSVC/Windows SDK on this PC.

The approved Dashboard/POS shell is preserved. Phase 4B+ adds customer selection, custom services, unified private image galleries, paired staff-phone camera requests, persistent customer displays, profile/session controls, touchscreen input, receipts and appearance customization.

The production adapter now uses the custom **NestJS/PostgreSQL API in `server/`**. Local IndexedDB demo mode remains explicit and independent. The legacy Supabase adapter is retained for compatibility tests; no Supabase project or credentials are required for the custom backend.

Phase 4C.2 adds direct camera auto-upload, global QR scanning, automatic field/gallery insertion and private native retry storage. See [the Android physical retest guide](mobile/android/README.md), [4C.2 validation report](docs/PHASE4C2-REPORT.md) and [camera API](server/docs/CAMERA-BRIDGE.md).

See [the current counter/backend guide](docs/PHASE4B-CONTINUATION.md) and [backend setup](server/docs/DEPLOYMENT.md). Hostinger deployment, hardware camera/push testing and native Windows packaging have not been claimed.

## Run the local prototype

Node.js 22.12+ and npm are required. Dependencies are installed here.

```powershell
npm ci
npm run dev
```

Open `http://127.0.0.1:1420/dashboard`. Committed `.env.development` explicitly selects `VITE_DATA_PROVIDER=local` / `VITE_USE_MOCK_AUTH=true`. Ahmed Khan is the demo owner. Sign Out and **Enter mock owner workspace** work. LOCAL DEMO is visible. The demo PIN/manager approval is available only in local development; it is disabled in production builds.

The approved POS, catalog/editor/import, receiving, locations, invoices/returns, credit/test items, repairs/devices, employees/shifts, reports and settings continue using IndexedDB. **Settings → Data / Demo → Reset Demo Data** resets only local prototype records after confirmation. Never use local demo data or its public PIN as production authorization.

## Run the shared shop API

From `server`, install dependencies with `npm ci`. Copy `server/.env.example` to the ignored `server/.env`, configure the separate PostgreSQL migration/runtime logins and server JWT secret, run `npm run migrate`, provision an owner using `npm run provision`, then run `npm run dev`. Development API documentation is `/api/docs`.

Set ignored root `.env.local` to:

```dotenv
VITE_DATA_PROVIDER=api
VITE_USE_MOCK_AUTH=false
VITE_API_URL=/api/v1
```

Restart Vite. `/api` and `/socket.io` proxy to localhost:3000 in development. Production should serve the existing frontend and API on the same HTTPS origin. Browser refresh sessions use HttpOnly cookies; access and counter tokens stay in memory.

See [backend configuration, Docker and deployment](server/docs/DEPLOYMENT.md). `server/compose.yml` creates PostgreSQL, an isolated migration job, a non-root API and persistent private media storage. Docker must be installed to run it.

For the isolated localhost browser fixture, run `npm run test:serve` in `server` with the documented test PostgreSQL service. Then start a separate API-mode Vite instance on1422 and run `npx playwright test --config playwright.api.config.ts`. The fixture creates only a new test database; its printed accounts are not production accounts.

Legacy Supabase mode remains explicitly selected by `VITE_DATA_PROVIDER=supabase`; its historical setup is in [SUPABASE_SETUP](docs/SUPABASE_SETUP.md).

## Build and verify

```powershell
npm run build
npm run lint
npm test
npm run test:client-boundary
npm run validate:migrations
npm run test:security
npm run validate:tauri
npm run preview
```

Production preview is `http://127.0.0.1:4173`. `npm run build` defaults to API mode and fails closed to login/configuration without configured credentials. In another terminal, `npm run test:production` verifies this behavior, theme persistence, safe public customer display, native CSP and simulated hash routing. It does not launch Tauri.

For a separate production-built local UI review:

```powershell
npm run build:demo
npm run preview:demo
```

Open `http://127.0.0.1:4174`. `npm run test:production:local` checks the local production prototype. This build goes to ignored `dist-demo`; it does not replace `dist`. Demo PIN switching/manager approval remains disabled in production, even in this explicit local review build.

Playwright retains all Phase 2 tests and adds Supabase-adapter workflows using the actual migrations in isolated PostgreSQL. Auth/Storage HTTP and tokens are intercepted fixtures. These tests do not prove hosted services or actual multi-connection concurrency.

Tauri 2 configuration and `npm run tauri dev` / `npm run tauri build` are retained. Native Rust installation/compilation was not attempted in Phase 3A. No native window or Windows installer is claimed. Use a configured Rust/MSVC/Windows SDK machine for native verification separately.

## Structure

```text
src/app/                     Providers, protected router, error boundary
src/components/              Approved shell/navigation/dashboard/POS and UI primitives
src/features/auth/           Login, profile, secure counter, permission/route guards
src/features/inventory/      Catalog, editor, locations, stock, receiving, transfers, adjustment
src/features/employees/      Profiles, explicit permissions, secure PIN assignment
src/features/...             Preserved Phase 2 local business modules
src/hooks/                   Scoped queries/actions, permissions, theme, stock Realtime
src/lib/repositories/        Shared contracts; provider composition
src/lib/local/               26 Dexie stores, seed and transactional local adapters
src/lib/api/                 Auth/session client and Api* repositories, private media and display transport
server/                      NestJS, PostgreSQL business rules, REST/WebSocket, private file storage
src/lib/supabase/            Retained legacy compatibility adapter
src/stores/                  Transient cart/session and persisted UI preferences
src/types/                   Strict domain/database/permission/safe POS types
supabase/migrations/         Historical versioned migrations; no fake production inventory
scripts/                     Schema/security/client-boundary/build smoke checks
 tests/                      Existing local/Auth suite and new SQL-backed adapter UI tests
src-tauri/                   Retained native shell and CSP
```

## Authorization and stock

Role metadata cannot grant application access. Server functions require an active application profile, store membership and explicit branch permission; active owners have unrestricted permission access. Direct client business writes are denied. Products and safe POS DTOs contain no costs/profit; protected financials and receipt costs have separate queries/tables/RLS.

Stock is derived from immutable movements. Receipt lines/costs/movements/audit commit atomically. Transfers are paired and reject insufficient source stock. Adjustments compare the current balance. Store-row locks serialize inventory/catalog changes; product/location edits check timestamps. Permanent codes survive friendly-name changes. Audit has no delete UI.

In API mode, private media uses permission-checked five-minute signed URLs and a replaceable file-storage service. Referenced evidence is protected from deletion. Authenticated WebSocket updates are limited to authorized store/device recipients, with polling fallback. Customer displays use separate expiring capabilities and receive only sanitized order/payment snapshots. The legacy Supabase adapter retains its older Storage/realtime implementation.

## Limits and next phase

The custom backend is implemented and tested locally. It has not been deployed to Hostinger. HTTPS/VAPID/mobile permission and a real phone are still needed to verify push notifications and camera hardware. Customer display transport uses immediate same-browser events or one-second remote REST polling with fail-safe expiry. Full offline synchronization, native installer/second-monitor control and printer/scanner drivers remain separate work.

Next: **Phase 4C — physical Android and counter acceptance before hosting**. Install the test APK and verify camera/gallery, pairing, exact payment-proof delivery, retry and sleep/resume on the shop LAN. Then **Phase 5 — HTTPS staging pilot and operational hardening**: deploy API/frontend together, provision real users with explicit permissions, verify two counters and a physical display, and test backup/restore and expiry. Receipt hardware and offline synchronization remain separate slices.

See [the current continuation guide](docs/PHASE4B-CONTINUATION.md). Historical reports remain in `docs/PHASE3B-REPORT.md`, `docs/PHASE3A-REPORT.md` and `docs/PHASE2-REPORT.md`.

## Android staff app and phone testing

The Android companion lives in `mobile/android/` and bundles the existing React staff UI, fonts and assets inside the APK. Shop Address selects only the backend; it never loads the interface from Vite. `npm run build:apk` validates TypeScript, builds the mobile bundle, runs Android unit tests/lint and verifies the signature, then copies version **0.4C.1-test** to `artifacts/android/Taha-Staff-test-4C1.apk`. `npm run dev:mobile` starts the LAN API on **3001** and counter browser preview on **1423**; database/auth settings come from `server/.env` or the environment. Enter the printed **backend** address in Android. See [Android installation, pairing and camera test instructions](mobile/android/README.md).

The phone UI has a dedicated accessible navigation drawer, searchable permission-aware modules, bottom navigation, Requests/Sent camera tabs and compact profile photo controls. Custom Service sits beside the customer selector inside Current Sale and asks only for name and price. Ad-hoc service charges have no minimum-price approval UI; regular product pricing policies remain enforced.

The current test APK is `artifacts/android/Taha-Staff-test-4C1.apk`. While the test API is running, download it from `http://PC-IP:3001/api/v1/downloads/staff-test-4c1.apk`. First open `http://PC-IP:3001/api/v1/health` in phone Chrome. Eight-second connection checks, address editing, diagnostics and branded startup recovery replace the old blank-screen failure. See [Phase 4C-1 diagnosis and verification](docs/PHASE4C1-REPORT.md). **Ready for physical retest; physical acceptance is still pending.**

