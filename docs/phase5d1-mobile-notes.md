# Phase 5D.1 mobile sales implementation notes

The existing Android Java/AndroidX WebViewAssetLoader shell is preserved. Mobile sales use `/mobile/sales`; no desktop POS, sidebar, counter draft or display publisher is mounted by this screen.

## Implemented

- Sales is an obvious bottom destination beside the existing central Scan, Devices and Profile actions. Other saved modules remain in the drawer. The persisted mobile-sales feature and server sales permission gate access.
- Compact search and product rows, image fallback, live/cached availability, quantity controls, sticky cart summary, optional searchable customer and existing quick customer creation.
- Custom service name and one PKR charge. Existing saved suggestions, explicit ambiguous-material selection and per-location allocation are reused; stock is consumed only by accepted checkout.
- Unknown physical products and custom services have separate actions. Quick product creation uses the normal API catalogue repository with zero opening stock; receiving remains necessary before sale.
- Cash, electronic, credit and split allocations use the existing API sale/payment-proof/tax/receipt logic. Electronic verification permission and proof/reference requirements are enforced in UI and remain enforced by the server.
- Proof comes from this phone's system camera or gallery file input. It never creates a camera request to this phone.
- Mobile drafts and request IDs are independent, scoped to shop/store/actor. A new mobile cart uses its own UUID. No desktop cart/customer changes or automatic customer-display publishing occur.
- Offline lookup/drafts are allowed. Finalization calls the shared API only, sends `clientChannel: mobile` and persistent app-install `deviceId`, and requires backend acceptance. The backend coordination guard is owned by the parent implementation.
- Unknown checkout responses retain the exact submitted request and idempotency key across reload. Uploaded proof paths are saved before posting, preserving the backend request hash on retry. Definitively rejected client requests can be corrected.
- Completion shows invoice and recorded amounts, white receipt paper in both themes, PDF sharing, receipt-link copy, new sale and manually prepared WhatsApp composer.
- PDF generation reuses `createInvoicePdf`. Android receives validated PDF bytes, writes only to its private receipt cache, and launches ACTION_SEND through a receipts-only FileProvider with a content URI and temporary read grant. No private filesystem path is shared. WhatsApp opens a validated `wa.me` ACTION_VIEW because the WebView deliberately blocks external page navigation.

## Verification and limits

The scoped browser suite is `tests/phase5d1-mobile-sales.spec.ts`, with `playwright.phase5d1-mobile.config.ts` on port 1449. It uses deterministic API responses and never inserts fixtures into the owner's database. API transaction persistence/concurrency must be verified separately against the isolated backend acceptance database.

Initial runs exposed fixture setup problems: the connection gate was sampled before hydration; an overly broad mock returned an array for Dashboard; the refresh-session endpoint needed its proper context; a digital-method fixture was initially applied to the product endpoint; and same-hash navigation correctly retained the payment step. These harness failures were corrected rather than suppressing assertions. The initial base source had no mobile sale destination/route.

Focused checks cover: mobile/desktop cart isolation and absent display events; real PDF generation passed into the native bridge interface; custom service draft retention; electronic proof requirements and identical checkout retry after reload; light/dark search/cart/payment at 390×844 and 412×915 with no horizontal overflow. Screenshots are under `docs/screenshots/phase5d1/mobile-*`.

Fresh result: **5 passed in 22.9 seconds** using `node node_modules/@playwright/test/cli.js test --config playwright.phase5d1-mobile.config.ts`. The expected HTTP 503 in the retry scenario is deliberate. ESLint on the owned mobile page/dialog/service/nav/scanner/routes/runtime/preferences completed with exit 0. Whole-project TypeScript checks reported other concurrently edited files; no mobile implementation diagnostic was emitted. Parent must repeat the final project typecheck after integration.

Physical Android camera/gallery permissions, receiver-app PDF readability, Sharesheet behavior, WhatsApp composer and installation/update continuity require a real device. Browser bridge interception confirms PDF bytes and invocation, not physical Sharesheet acceptance. APK version/signing/build and the isolated final-unit concurrency test are reported by the parent task.

The existing Windows offline policy uses expiring authorizations and durable capture reconciliation. A mobile connection alone cannot prove the counter has no offline promise. The server guard therefore conservatively blocks unsafe mobile checkout; synchronize/reconcile the counter and retry. This work does not introduce another offline financial engine or guarantee stock availability offline.
