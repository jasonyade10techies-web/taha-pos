# TAHA MOBILES — Phase 4D implementation report

Status: implementation and automated verification completed; **READY FOR PHYSICAL RETEST**. Physical Android camera, keyboard, lock/resume and gallery behavior require the owner's phone test. No Hostinger deployment, Supabase reconnection or Rust/Tauri work was performed.

## Mobile shell

The Android APK has a dedicated bundled mobile entry, authentication provider, curated router and mobile shell. Its interface opens without Vite or a reachable shop server. Home, Activity, Devices, Profile, Products, Inventory, Reports, Customer Display, Settings, Receipt lookup, Shop Connection and Diagnostics are included. Camera/alerts legacy links redirect into Activity. Desktop sale creation, checkout, stock receiving and bulk management routes are excluded from the APK; an unknown desktop route returns to mobile Home.

Default navigation is Home / Activity / central gold Scan / Devices / Profile. Owners can choose up to four permitted pinned modules; Scan remains fixed. The drawer is searchable, permission-aware and contains account/settings controls. Headers show brand, branch and connection status; IP addresses belong in Shop Connection/Diagnostics.

## Profile

Profile has an editable avatar, personal details, account, appearance and security sections. Photo capture/selection enters crop preview; remove is supported. Password change uses current/new/confirm fields and a 12-character minimum. Devices, employee switching and sign-out remain distinct. The phone layout scrolls above safe-area navigation and exposes the last security actions. Dark/light/system selection persists.

## Pairing

An authenticated, permitted phone scanning a valid same-shop pairing QR connects automatically with its persistent device identity. Device names can be edited afterward; disconnect/reset affect pairing only. The desktop shows a green success check and closes after approximately 1.1 seconds. Pairing, presence and photo delivery continue to use the real custom API independently of local IndexedDB business data. Local demo identity grants no server authorization.

## Photo flow

Product, repair and device galleries have a prominent Take Photo with Phone action. Profile/payment proof remain single-image jobs. Product/used-device/repair jobs support up to 12 photos, multiple existing-photo selection, repeated camera capture, Take Another and Done. Processing/upload concurrency is bounded to two. Cancelling native capture returns to the existing result instead of automatically reopening the camera. Short toasts report success/cancellation.

The server enforces one active request per device/session, assignment and authorization, 60-second operational expiry, idempotent capture IDs and scoped delivery. Private pending-photo storage is bounded to 12 images, 64 MB and 30 minutes, with Send Now and online/resume retry. Logout/shop changes clear private retries. Expired or cancelled jobs cannot accept late uploads: after a long outage, create a fresh request. Timings record processing, upload, storage, thumbnail and desktop receipt stages; physical transfer speed has not been measured.

Optional save-to-device-gallery defaults off. Android 10+ uses scoped MediaStore; Android 8/9 retain photos privately for upload and do not copy them into the public gallery.

## Image gallery

The reusable gallery supports drag reorder and touch move controls, Primary, replace, remove, preview, previous/next, zoom and swipe. Crop supports Free, 1:1, 4:5, 3:4 and 16:9, drag, zoom, rotate and reset. API crops are derivatives of a retained original; repeated edits use that original. Originals, optimized images and thumbnails have separate storage metadata and permission-checked access. Gallery/list thumbnails use the smaller server image; previews/crops use the full image. Local demo galleries preserve editable originals separately.

## Scanner

Auto is the default. QR uses a gold square frame; Barcode uses a wide horizontal frame. Native ZXing decoding and the browser fallback share the closed Taha parser. Pairing, camera request, product, location and receipt payloads are supported, including existing printed TM-P/TM-L/TM-INV references. Product codes open product lookup, location codes open inventory, invoice references open receipt lookup. Unknown QR does not navigate to arbitrary websites. Permission errors expose Open Settings.

## Offline

The bundled shell remains visible when the shop is unreachable. Read-only cached shop/account/product/activity data expires after eight hours and is scoped to shop/profile. Costs/profit, session tokens and signed media URLs are excluded. Writes require a live authenticated connection and cannot report fake success offline. Online, foreground and app-resume events restore checks, authorized data and bridge connections without duplicate socket subscriptions. Full offline financial synchronization and background push/upload are outside this phase.

## Dashboard

The approved desktop cards/chart/activity structure and POS layout are preserved. Date presets include Today, last 7/30/90 days, this/last year and custom calendar range. Reporting uses Karachi dates and adaptive hour/day/week/month/year buckets. The chart's tooltip aligns with its real SVG point and shows the correct PKR values/date. Range labels and metrics describe the selected period. Server reporting preserves permission-based profit access and accounts for reversal/return financial effects.

## Customer display

The paired phone has a read-only live customer-display preview with connection status and reconnect. Local counter business data can publish through the independently authenticated API bridge. Cart/payment/cash/credit/digital instructions and completion snapshots are restricted to customer-facing fields and a specific terminal. Sensitive costs, profit, stock/location data and internal controls are rejected by the server preview DTO. This is a preview; it does not expose mobile cashier checkout.

Mobile product/report totals read the server database. The current desktop demo sales remain in IndexedDB, so those financial totals do not mirror the mobile server ledger. Pairing, photos and live display preview work across these modes; Phase 5 production configuration uses shared API business repositories.

## Responsive and UI polish

Phone checks cover 360/390/600 widths and 390×844; tablet checks cover 1024×768; desktop checks cover 1366×768, 1440×900 and 1920×1080. VisualViewport keyboard detection hides bottom navigation while editing and restores it when the keyboard closes. Layout uses dynamic viewport height, safe-area padding, readable mobile density and touch controls. Drawer/dialog/dropdown/combobox/toast transitions animate both entrance and exit, respecting reduced motion. Review screenshots are under `docs/screenshots/phase4d/`.

Desktop management screens now load on demand. Development/test/preview dependency caches are separated to avoid interfering with simultaneous servers. The approved shell remains visible while its requested screen loads.

## Hostinger readiness

`server/Dockerfile`, `server/compose.yml`, migration runner, restricted runtime database role, persistent PostgreSQL/private-media volumes, healthchecks, HTTPS/reverse-proxy example and consistent backup/restore instructions are prepared. Nginx covers REST and Socket.IO's `/socket.io/` transport path. See `docs/HOSTINGER_DEPLOYMENT.md` and `server/deploy/`.

Docker is unavailable on this PC. Compose YAML was parsed and configuration reviewed; a Docker image/stack build and restore rehearsal were not performed. Those are Phase 5 staging gates, not a claimed deployment.

Four versioned migrations were applied to the existing isolated test database without replacing it:

- `server/migrations/202610070100_mobile_quality.sql`
- `server/migrations/202610070110_dashboard_ranges.sql`
- `server/migrations/202610070120_mobile_read_tools.sql`
- `server/migrations/202610070130_counter_preview.sql`

## APK and physical guide

Version **0.4D.0-test**, build **5**, package `com.tahamobiles.staff.debug`, minimum Android 8/API26. The debug-signed test build preserves separate prior APK names.

File: `D:\Inventory system POS\artifacts\android\Taha-Staff-test-4D0.apk`.

LAN download: `http://192.168.1.11:3001/api/v1/downloads/staff-test-4d0.apk`.

Shop address: `http://192.168.1.11:3001`. Health: `http://192.168.1.11:3001/api/v1/health`. Counter preview: `http://127.0.0.1:1423`. The API listens on `0.0.0.0:3001`; the current Ethernet IPv4 is `192.168.1.11`.

Use the seven-step physical test in `mobile/android/README.md`. Test pairing/communication first, then photos/gallery/scanner, keyboard and offline/resume. The isolated owner test credentials are documented there, not in APK assets or production UI. If the PC IP changes, update Shop Connection; no new APK is required.

## Automated verification

| Check | Result |
| --- | --- |
| Frontend production build / TypeScript | Passed |
| Frontend ESLint | Passed |
| Existing frontend regressions | 75 cases verified across the full run and corrected reruns |
| Dedicated mobile and real API bridge | 12 passed |
| Connection, logout, timeout, resume and crash recovery | 12 passed |
| Native-transport camera and scanner browser regressions | 7 passed |
| Final desktop responsive/date/tooltip review | Passed |
| Server build / TypeScript / ESLint | Passed |
| Server PostgreSQL/auth/device/media/transaction tests | 55 passed |
| Android unit tests | 23 passed |
| Android debug assembly / lint / signature | Passed |
| Physical phone | Awaiting owner retest |
| Docker container build / restore rehearsal | Not run; Docker unavailable locally |

The initial full frontend run reported 70 passes and five failures in startup timing and old UI/test selectors. All five corrected cases passed together afterward; the final responsive/range review also passed after the desktop startup change. Tests retain the existing business and image-processing assertions. Browser native-transport doubles exercise actual REST/WebSocket integration where indicated, but do not establish physical camera performance.

Validation logs are `.4d-build-final.log`, `.4d-lint-final.log`, `.4d-frontend-final.log`, `.4d-corrected-regressions.log`, `.4d-mobile-final.log`, `.4d-mobile-home-final.log`, `.4d-desktop-final.log`, `.4d-camera-final.log`, `.4d-connection-tests.log`, `.4d-backend-tests.log` and `.4d-android-final.log`. The APK checksum is in `artifacts/android/Taha-Staff-test-4D0.apk.sha256`; the LAN download was checked against the built artifact.

## Next phase

**PHASE 5 — HOSTINGER PRODUCTION DEPLOYMENT + HTTPS + RELEASE HARDENING.** First accept the physical Phase 4D retest, then validate the Docker staging stack, domain/TLS configuration, restricted database roles, backup restore, private uploads, socket reconnect, production account provisioning and signed Android release configuration before deployment.
