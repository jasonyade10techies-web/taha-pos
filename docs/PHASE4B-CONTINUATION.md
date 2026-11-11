# TAHA MOBILES — Phase 4B+ counter and custom backend

Android setup in this historical guide is superseded by [Phase 4C-1](PHASE4C1-REPORT.md) and the [physical retest guide](../mobile/android/README.md). The current APK bundles its UI; its Shop Address uses API port3001, not Vite port1423.

The existing React/Tauri application stays in place. The approved Dashboard, New Sale product area, persistent cart, charcoal sidebar and red/yellow/gold branding are preserved. Manrope is the default locally bundled font; its license and Inter's license are in `public/licenses`.

## Counter workflows

- Search customers by name, phone or shop, choose recent customers, and create an individual/business without leaving the cart or checkout. Customer photos use the common uploader. Credit information and actions require explicit permissions.
- Add a one-sale custom service from **Current Sale**, beside the customer selector, without stock movements. It asks only for service name and a positive PKR charge; staff with `services.create_custom` choose its charge without a minimum-price approval dialog. Staff with `services.save_catalog` or `repair.services.manage` can also save a reusable service. Regular catalog product minimums, discounts and approval rules remain server-enforced.
- Checkout supports cash, electronic payment, full/partial credit, proof preview and idempotent completion. Receipts prominently show `TM-INV-…`, PKR amounts, payment/credit/change and the Taha Mobiles footer. Receipt and full A4 invoice previews share the existing print flow; Save PDF uses the browser's print dialog.
- Optional physical/touch input works together. The virtual keyboard follows the focused input, chooses numeric mode for amounts/PINs, and stays inside the active dialog. Ctrl+K, F1, F4 and Escape remain supported.
- Reusable contextual information icons explain minimum price, credit, stock, payment proof and cash reconciliation. Destructive actions use confirmations.

## Customer display

Open `/customer-display` or use **Customer Display** in POS. Its idle, live order, checkout/payment and thank-you states follow cart, quantity, negotiated price, discounts, customer and payment changes. Cash shows received/change; credit shows only this order's paid/remaining amounts; digital methods show only their configured account/QR instructions. Sale completion returns to idle after the configured duration.

Same-browser demo windows use an isolated terminal BroadcastChannel. A different browser/monitor uses the API: open the display, enter its eight-character pairing code at the counter, and keep both windows open. Remote snapshots publish on changes and heartbeat every five seconds; displays poll each second. A missing heartbeat expires the snapshot to idle after ten seconds. **Manage Displays** lists/revokes current-session pairings. Fullscreen requires the viewer's user gesture. Native monitor placement is future work.

The public display starts independently of staff authentication. It receives only a validated public snapshot through a dedicated expiring capability kept in memory. It never requests staff settings, products, financials or internal WebSocket rooms. Its snapshot cannot contain purchase cost, minimums, location, stock counts, customer history, proof or staff controls. Account/PIN revocation invalidates the association; pair again after its session ends.

## Images and staff phone

The common media uploader supports validated JPG/PNG/WebP, drag/drop, paste, multiple previews, order/primary/removal and native camera input. Inputs are decoded, bounded and resized; forms wait for preparation. Repair photos retain Before/After/Damage/Customer-provided categories. Evidence retains a higher minimum image quality. Private paths are stored in records; temporary signed URLs are used only for preview.

In **Settings → Devices**, choose **Pair Staff Phone**. Scan/open the QR on a staff phone, sign in and confirm pairing. The counter selects a paired device when requesting payment/product/device/repair/customer/profile/damage/document photos. `/mobile-camera` shows only requests assigned to that phone. Camera statuses include waiting, opened, captured, uploading, received, failure and retry. A received photo attaches only to its exact request/form. Interrupted acknowledgement retries reuse the already uploaded file.

The phone can use **Take Photo** or **Choose Existing Photo**. An unsent preview is kept in memory during a recoverable connection failure; it is not stored in localStorage and does not survive closing/reloading the page. Completed requests cannot be replayed. Disconnecting a phone cancels its pending jobs.

The staff companion has a manifest, service worker and PNG install icons. **Enable Camera Notifications** registers actual Web Push when server VAPID configuration and browser permission exist. Push contains a generic request reference; details are retrieved after authentication. Without push, open the queue through the pairing QR. No simulated notification is reported as a delivered notification.

## Profile and appearance

Profile supports editing name/phone, private photo capture/upload/remove, current-password verification, connected-session revocation, account sign-out and separate counter employee switching. Password and PIN verification happen server-side. Preferences cover display, camera/proof/compression, keyboard, customer selection and receipt identity/footer. Appearance uses validated color tokens and Manrope/Inter/system fonts, persists locally and to the API when allowed, and supports Light/Dark/System.

## Backend and authorization

`server/` contains NestJS/TypeScript, PostgreSQL, `/api/v1` REST, development Swagger at `/api/docs`, authenticated Socket.IO, optional Web Push, private file-storage abstraction and Docker/Compose. See [deployment](../server/docs/DEPLOYMENT.md), [API contract](../server/docs/API.md) and [migration notes](../server/docs/MIGRATIONS.md).

Existing stock/transaction/permission SQL is reused through a static API operation allowlist. Versioned backend migrations adapt the protected auth schema and add custom sessions, media, paired phones, repairs/shifts, appearance and customer-display capabilities. There is no arbitrary SQL/RPC API. Business calls set the validated actor in a transaction using a restricted runtime role; RLS and functions enforce granular branch permissions. Owners are unrestricted; manager/employee role names alone do not grant business access.

Purchase costs and profit remain separate protected queries/tables. Employee POS DTOs never contain those values. Frontend route guards complement server authorization. Sales/returns/collections retain atomic SQL transactions, stock-event history, approval checks and idempotency. Audit has no delete endpoint. Media is decoded/compressed server-side and remains private; five-minute signed reads check active access again. Referenced business/payment evidence cannot be deleted through the media endpoint.

Access/counter tokens stay in memory. Refresh uses a rotated HttpOnly, SameSite cookie, Secure in production. No service-role or database credentials enter the frontend. Production defaults to API mode and fails closed. Local IndexedDB/mock owner remains an explicit development option; existing Supabase adapters remain compatibility options.

## Commands

Local UI, from the project root:

```powershell
npm ci
npm run dev
```

The committed development configuration selects the local demo at `http://127.0.0.1:1420`. LOCAL DEMO is visible. Demo records/PINs are never production authorization.

For the real API:

```powershell
cd server
npm ci
# Copy .env.example to .env and supply PostgreSQL/JWT/origin values.
npm run migrate
# Supply PROVISION_EMAIL, PROVISION_NAME and PROVISION_PASSWORD securely.
npm run provision
npm run dev
```

Then set the root's ignored `.env.local` and restart Vite:

```dotenv
VITE_DATA_PROVIDER=api
VITE_USE_MOCK_AUTH=false
VITE_API_URL=/api/v1
```

Verification:

```powershell
npm run build
npm run lint
npm test
npm run test:client-boundary
npm run validate:migrations
npm run test:security
cd server
npm run build
npm run lint
npm test
```

API browser checks require the isolated localhost PostgreSQL fixture (`server npm run test:serve`), a separate API-mode Vite at port1422 and `npx playwright test --config playwright.api.config.ts`. Fixture credentials are test-only and never seed a production database. The test server rejects remote administrator URLs. Frontend tests retain the existing local/legacy-adapter coverage and add actual NestJS/PostgreSQL browser flows.

## Deployment and remaining validation

The continuation now also includes a native Android staff host in `mobile/android/`. It reuses the current React mobile routes, accepts the configured shop origin, supports native camera/photo selection and handles short-lived pairing links. `npm run build:apk` runs Android assemble/unit/lint validation; `npm run dev:mobile` provides an isolated same-origin LAN preview on1423. This test app is debug-signed; release signing and physical-phone acceptance remain separate. See `mobile/android/README.md` for exact installation and camera checks. The test APK permits private-LAN HTTP before hosting; release requires HTTPS. It uses foreground WebSocket/poll updates; native background push is not claimed.

Mobile navigation has a focus-trapped side drawer with backdrop, Escape dismissal, grouped modules, search and permission filtering. Bottom navigation, safe-area spacing, camera Requests/Sent tabs and touch-sized profile/photo actions use the existing brand. Desktop sidebar, Dashboard and POS structure are preserved. Current Sale places the customer and Custom Service on one row, with duplicated customer avatars removed. Custom Service now asks only for service name and a positive PKR charge, with no minimum field; its editable cart charge does not use the product approval dialog.

This workspace has not been deployed to Hostinger. Docker is unavailable here, so image/Compose execution is unverified. Deployment needs a Node/container-capable server, HTTPS origin, PostgreSQL migration/runtime credentials, server JWT secret, persistent private media and an initial real owner account. Optional push additionally needs VAPID keys and user permission. No Supabase credentials are required for the API.

Browser automation covers phone-size capture with supplied images, rather than physical camera hardware. Real Android/iPhone permission, installed PWA/background push, a physical display, thermal printer/scanner and recovery over an actual shop network need a staging pilot. The receipt QR is an invoice reference unless a public receipt destination is configured; no public receipt server is claimed. Repair advance capture is deliberately unavailable in API mode until a confirmed repair-payment workflow exists.

Local demo remains usable without a backend. API mode does not silently create local sales when offline; retries preserve request identity and uploaded previews. Full offline sync/reconciliation, native executable/installer and second-monitor placement are separate work. The production frontend build currently warns about a main chunk over500kB; it succeeds.

Next: **Phase 4C — physical phone and counter acceptance before hosting**. Install the supplied test APK, pair it to the counter on the same LAN, and verify camera/gallery, retake/retry, sleep/resume, profile photos and exact proof delivery. Then **Phase 5 — HTTPS staging pilot and operational hardening**: deploy together on the intended Hostinger/VPS environment, provision real permissions, exercise two counters and a physical display, and verify session expiry and backup/restore. Receipt hardware and offline synchronization remain separate tested slices.

See [the current verification report](PHASE4B-VERIFICATION.md) for exact results, APK paths and remaining hardware checks.
