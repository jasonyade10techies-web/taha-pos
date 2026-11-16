# Taha Staff Build 14 — phone product creation and photos

Date: 2026-11-16. Branch: `codex/mobile-product-capture`.
Base source: `ac11dd8f8ac8719fb0275a756015b50879b55c12`.

## Delivered behavior

- Home → Add Product, or Products → Add Product.
- Required name and blank required selling price; optional minimum price and category/brand/model/grade/color/aliases/notes.
- Take Photo uses the existing Android camera file chooser. Upload uses the existing gallery picker. Up to 12 images, with existing primary/order/crop controls.
- Save stages private media, then commits product details and gallery membership through the existing atomic backend endpoint. No new server endpoint or migration is required.
- Each open draft keeps one UUID. Ambiguous save responses require matching authoritative product AND gallery readback before showing success. PostgreSQL decimal-string prices are compared by value. Failed readback never counts as success.
- Upload failures keep the open draft/photos for retry. Invalid image preparation blocks saving until the failed photo is retried or removed. Inputs are locked during saving.
- Products start with zero stock and unknown purchase cost. Receiving stock remains a separate existing workflow. This feature cannot silently add stock or assign a zero purchase cost.
- Existing product editing and photo-gallery tools remain available. Other approved mobile navigation is retained.

## Installation and use

The APK is a **test update**, version code **14**, version **0.5R.3b-test**, package `com.tahamobiles.staff.debug`, Android 8.0/API 26 or newer.

Install over the previous Taha Staff TEST app; do not uninstall or clear application data. Connect using:

`https://digital-greenyellow-hyena-70.hostingersite.com`

Use the existing shop login. No passwords or provider credentials are embedded in the APK. Direct authenticated product/photo uploads do not require counter camera pairing or the PC to be switched on. Internet access and a functioning hosted API/storage are required. Staff accounts need appropriate inventory/product-create/media-upload permissions; owners already have these rights.

## Fresh automated verification

- Frontend TypeScript passes in the Android build script.
- Targeted ESLint passes for changed frontend components, service, browser tests/configuration and backend integration test.
- Mobile browser suite: **5 passed**, no failures. Covers camera/gallery input, product reload, upload retry, decimal-string lost-acknowledgement readback, forbidden create UI and corrupt selected image. These use mocked HTTP fixtures; they are not physical camera acceptance.
- Real NestJS/PostgreSQL integration suite: **26 passed**, no failures. Uses a newly created disposable database through local port **55459** and temporary private filesystem media. The new case checks product fields, zero stock movements, absence of purchase cost, ordered photos, original/thumbnail retrieval, unsigned denial, duplicate-ID rejection and employee permission denial. Saved development/shop databases and hosted shop records were not changed.
- Android JVM suite: **43 tests**, zero failures/errors. APK assembly and Android lint pass; lint reports **0 errors, 17 existing warnings**.
- Final APK v2 signature verified; Build 13 certificate retained: `fe4bd258ec8f80aa5aeb2fcc608e7fe42c2dd0af3931767ca8bfd84af3618a38`.
- All **58 bundled frontend files** inside the APK match the final `dist-mobile` output byte for byte. Archive integrity, package ID and version metadata verified.
- Final APK size: **4,210,231 bytes**. SHA-256: `593fe668bddcdd219257ad9a37652fc22da97aa851cec3fe4fb2040d6d7a9ac5`. Downloads copy hash matches the artifact.

Evidence is retained under `.test-postgres/mobile-product-capture/`: `ui-final-verified.log`, `api-release.log`, `android-final.log`, `lint-final.log`, `backend-lint.log`, `signature-final.log`, `add-product-phone.png`, and `artifact-verification.json`.

The first API rehearsal exposed decimal-string price handling in uncertain-save readback; this was corrected and the real integration suite rerun successfully. A test fixture also returned the wrong dashboard shape during connection; that fixture was corrected and the full focused browser suite rerun successfully. Earlier logs/candidate APKs are retained separately; deliver only the final verified APK.

## Files and limits

- APK: `artifacts/android/Taha-Staff-test-R3a-build14.apk`, with adjacent SHA-256 file. A verified copy is placed in the owner's Downloads folder as `Taha-Staff-test-build14.apk`.
- Product form: `src/features/mobile/mobile-product-create.tsx`.
- Product API projection/retry readback: `src/lib/mobile/product-service.ts`.
- Entry points: `src/features/mobile/mobile-products-page.tsx`, `src/features/mobile/mobile-home-page.tsx`.
- Photo preparation failure callback: `src/components/media/product-media-manager.tsx`.
- Tests: `tests/mobile-product-capture.spec.ts`, `server/test/integration.test.ts`.

No phone installation or physical camera capture has been claimed. Required owner acceptance: install over Build 13, allow camera, create a synthetic product with one camera photo and one gallery photo, save, reopen the product on the phone and authenticated desktop, then retry after a network interruption. The open new-product draft is not promised to survive Android force-stop/process death. Existing native camera recovery is preserved; new durable catalog drafts were not added. Native offline product creation is outside this change.

This is a scoped mobile release, not a production-readiness certification. No hosting deployment, live configuration, DNS, paid resource, production signing, database schema or saved business data was changed.
