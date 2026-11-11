> Deployment direction superseded by Phase 5A: Hostinger managed Node.js plus external PostgreSQL is now primary. See HOSTINGER_DEPLOYMENT.md; the VPS statements below describe the earlier preparation, not a current requirement.

# TAHA POS — Phase 4E implementation

The approved Dashboard, counter layout, current-sale structure and red/yellow/gold identity remain. This release hardens the existing product, media, checkout, receipts and staff workflows. It does not deploy Hostinger or reintroduce Supabase runtime.

## Product editor

- Compact main/administration columns at 1366–1920px; tablet reflow and dedicated mobile details sheet.
- Sanitized description formatting, organization, supplier, visibility, tags, aliases and suggested aliases accepted explicitly.
- Explicit Save/Discard, sticky unsaved state and navigation confirmation. Friendly codes remain server-generated.
- Owner-only costs are retrieved separately. Mobile and employee POS DTOs exclude costs, valuation and profit. Opening stock creates server movements; editing quantity does not overwrite the ledger.
- Backend saves product metadata and ordered media atomically with version checks. Scoped offline drafts retain opening quantity, queued images and Pending Sync/Conflict/Failed status until server acceptance.

## Media

- Shared ProductMediaManager, 0–12 limit, compact empty state, Upload/Use Mobile, primary tile, +N expansion and add menu.
- Multi-selection, primary, keyboard reorder and drag reorder; swipe/zoom viewer; per-image progress and retry.
- Crop supports pan/zoom/rotate/reset and Free/1:1/4:5/3:4/16:9. Original and edited derivative remain distinct.
- Private server storage holds original/derivative/thumbnail files, never PostgreSQL base64. Store/type validation prevents linking another store's files.
- Android native multi-photo selection is enabled for galleries, with upload concurrency 2. Profile/payment proof remain single image. Mobile gallery has an explicit Save Images action.
- Real phone pairing and authenticated device bridge remain independent of local demo business data. No phone, offline phone and multiple phones have distinct actionable states.

## Controls

AppCheckbox supplies gold check, mixed state, focus and dark styling across visible settings, media, permissions and tables. AppSelect supplies the visual menu while retaining a hidden semantic select. File inputs are hidden behind named actions, and number spinners are removed. Custom Service sits beside the customer selector and uses Service Name, Charge (PKR), and Save as reusable service; it has no minimum price field.

## Receipts and checkout

- Receipt paper stays white in either app theme. Separate 80mm thermal and A4 invoice styles print only the document.
- Upper receipt QR, compact item/variant rows, subtotal/discount/tax/paid/outstanding/change, invoice identity and Taha footer.
- Real A4 PDF export supports wrapped names, repeated table headers, payments and page numbering. A ten-item invoice fits one page; larger invoices paginate deliberately.
- BrowserPrinter implements ReceiptPrinter; ESC/POS remains an adapter boundary awaiting hardware work. Physical printer margins need the shop's hardware test.
- API receipts use expiring signed customer-safe references. Receipt capabilities cannot authenticate as staff, and public projections exclude internal costs, proof files and private credit history.
- Virtual Receipt downloads PDF, copies the safe API link, opens WhatsApp with prefilled text or uses supported native sharing. Browser WhatsApp does not automatically attach/send a PDF. Walk-in phone is optional.
- Tax defaults to zero. Owner-configured inclusive/exclusive profiles apply to products/services/both; backend snapshots are immutable. Tax is excluded from gross profit, refund and void calculations account for it. Zero-tax receipt visibility is configurable.
- Checkout retains cash, digital, credit and split allocations, adds an explicit Review Sale step, and changes require a fresh review. Payment method/account/QR updates customer display live. Actual account details/QR must be configured; missing QR is identified explicitly.
- At 1366x768 and 1920x1080, the customer payment screen presents order and payment QR side by side so instructions remain visible without scrolling.
- Customer display consumes the selected account snapshot; duplicate method names cannot substitute another account's number or QR. Mobile preview uses the same snapshot.
- Payment Proof has phone capture/upload controls and a permitted skip action only when proof is optional. Proof and internal approval controls never appear on customer display.

## Notifications, Dashboard and search

- Top-center animated success/info/warning/error toasts, maximum three visible, 3.5-second dismissal; separate bounded 30-event session history in the bell menu.
- Compact Dashboard controls with Today, 7/30/90 days, this/last year and a custom calendar. Hour/day/week/month/year buckets follow the range, and tooltip values come from the exact focused/hovered point.
- Local/backend normalization, model tokenization, typo tolerance and an owner-editable repair-shop dictionary. Suggested aliases require acceptance. No external AI calls per search.

## Offline/mobile

- Scoped, expiring and cost-free catalog/read cache; financial server operations do not pretend to succeed offline.
- Product drafts sync after reconnect with idempotent identifiers and conflict handling. Images captured during a short outage remain in a bounded private retry queue.
- Native retry queue is limited to 12 images/64MB/30 minutes. Camera requests currently expire after 60 seconds: resume within that window or start a new request. No indefinite background upload or push claim.
- Explicit optional VITE_DEVICE_BRIDGE_URL selects a LAN bridge independently of the cloud business API. Sign in to each trusted host separately; automatic cloud-to-LAN credential transfer is not implemented.
- Bundled Android UI uses dedicated Home/Activity/Scan/Devices/Profile and permission-aware utilities. Auto/QR/Barcode scanner, safe-area layout, keyboard-aware navigation, profile image/crop sheet, reconnect and mobile customer-display preview remain.
- Production mobile can use VITE_MOBILE_SHOP_URL over HTTPS. Test builds retain manual LAN setup; raw IP is kept out of normal production navigation.

## Backend migrations

Under server/migrations, applied in order to the isolated development database:

1. 202610080100_product_hardening.sql
2. 202610080110_tax_snapshots.sql
3. 202610080120_safe_receipts.sql
4. 202610080130_catalog_search_index.sql
5. 202610080140_atomic_product_media.sql
6. 202610080150_immutable_tax_insert.sql
7. 202610080160_product_tags_binding.sql
8. 202610080170_tax_total_constraints.sql

Earlier migrations remain unchanged. NestJS REST/WebSocket, custom auth, PostgreSQL transaction rules, permissions, RLS and non-bypass runtime roles remain authoritative. Product descriptions are sanitized on the server; linked suppliers/files must belong to the current store. Media save conflicts roll back without partially replacing a gallery.

## Hostinger preparation

server/compose.production.yml and server/deploy/Caddyfile prepare HTTPS app/API domains, same-origin web API proxy, WebSocket upgrades, bounded uploads and private PostgreSQL. API containers remain non-root; uploads use a persistent private volume. deploy/backup.sh and restore.sh document/check database and media backups with checksums and explicit restoration confirmation.

Not deployed. Docker is unavailable on this Windows machine, so container/TLS execution and an isolated restore rehearsal must run on the VPS. Required from owner: VPS, domain/DNS, production environment/secrets, database credentials and an encrypted off-VPS backup target. Android release signing and real payment accounts/QR are still required. See server/docs/PHASE4E-PRODUCTION.md for exact deployment and recovery steps.

## Run and validate

From D:\Inventory system POS:

```powershell
npm run dev
npm run build
npm run lint
npm run build:apk
node --env-file=server/.env.mobile-test scripts/start-mobile-preview.mjs
$env:TAHA_PDF_PYTHON='C:\Users\hassa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
npx playwright test -c playwright.phase4e.config.ts
npx playwright test -c playwright.phase4d.config.ts
```

The mobile browser suite requires dist-mobile served on port 4175 and the isolated backend on port 3001. Print tests require Poppler pdfinfo and Python pypdf; the interpreter above is available on this PC, and TAHA_PDF_PYTHON can point to another installed interpreter elsewhere. The APK script uses JDK17+, Android SDK35 and Gradle8.11.1, runs TypeScript/native tests/lint and verifies the debug signature.

In server/:

```powershell
npm run build
npm run lint
npm test
```

Backend integration tests require the private isolated PostgreSQL fixture environment. They run serially because their role provisioning shares a fixture cluster.

## Test artifacts and physical retest

Validation: frontend build/lint and backend build/lint pass; 12 desktop browser tests, 13 mobile browser/API tests, 65 backend tests and 23 native Android unit tests pass. Customer-display QR fit is additionally verified at both desktop monitor sizes. Android lint reports zero errors and 13 existing warnings. APK debug signing is verified. Print/PDF outputs were rendered and manually reviewed, including white paper in dark mode, long names, four payment types, tax/discount, one-page thermal output and multi-page A4 headers. Six responsive viewport sizes are covered (1920, 1440, 1366, 1024, 390 and 412 widths).

- Visual screenshots: docs/screenshots/phase4e/; retained mobile coverage in docs/screenshots/phase4d/.
- Print/PDF matrix: artifacts/print/phase4e-*.pdf (isolated test invoices only).
- Android: artifacts/android/Taha-Staff-test-4E0.apk, matching SHA256 and validation JSON.
- Test version 0.4E.0-test, build6, package com.tahamobiles.staff.debug.
- Current LAN API http://192.168.1.7:3001; counter http://localhost:1423/dashboard.
- Download http://192.168.1.7:3001/api/v1/downloads/staff-test-4e0.apk.
- Physical phone, native camera/gallery and actual receipt printer remain READY FOR PHYSICAL RETEST, not reported as passed. Follow the seven steps in mobile/android/README.md.

Next: PHASE 5 — HOSTINGER PRODUCTION DEPLOYMENT + HTTPS + PRODUCTION DATABASE + ANDROID RELEASE CONFIG + WINDOWS NATIVE/HARDWARE.
