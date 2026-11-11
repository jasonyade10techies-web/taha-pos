# Frontend audit evidence — 11 November 2026

Scope: read-only inspection of source, previous test logs, test assertions and one existing demo screenshot. Only this audit document was written. No implementation changes, deployment, database fixture, owner record mutation, real checkout, message send or hardware acceptance was performed by this audit subtask. Root audit owns fresh build/lint/backend execution and native/device evidence.

## Evidence levels and current conclusion

The frontend is a substantial implemented React/Vite application with actual API repository calls and separate local/demo adapters. The smart linked service workflow is implemented beyond a visual mockup, with historical automated coverage of stock consumption, allocation, pricing review and returns. This is **not a fresh November end-to-end acceptance**. The parent audit reported a currently all-NUL backend `server/src/media/media.service.ts`; that prevents treating historical API/browser successes as proof that the present checkout is operable.

Fresh integrity scan: **335 files under `src` read as raw bytes; zero contained a NUL byte and zero were empty**. This does not prove absence of every semantic/truncation defect, but frontend sources do not share the reported all-NUL backend failure. Files examined below have normal source endings.

Latest inspected historical browser evidence:

| Date | Actual retained log | Result and boundary |
|---|---|---|
| 22 October | `.test-postgres/phase5d2-20261022/browser-clean-rerun.log` | 164 passed, 1 skipped, 20.0 minutes. Local/mock regression, not physical acceptance. |
| 22 October | `services-workflows-final.log` in that directory | 9 passed, 1.2 minutes: compound composer/model, price review, Returns tabs/pagination, Settings discard and retained-photo model. |
| 22 October | `accounting-chart-green.log` | 2 passed, 24.7 seconds: local compound checkout/floor/returns and tax/labor chart arithmetic. |
| 22 October | `toolbar-final.log` | 1 passed, 23.2 seconds: six widths and both themes. |
| 29 October | `.test-postgres/phase6a-20261029/frontend-browser-green.log` | 7 passed, 53.8 seconds: browser/mobile landing/auth/settings, polling/revisions and route refresh; transport fixtures used. |
| 29 October | `frontend-real-api-browser.log` in that directory | 1 passed, 49.3 seconds: separate desktop/mobile browser contexts, real isolated API, product creation/receiving, mobile cash sale, stock sharing and both refreshes. It was a disposable fixture, not installed-PC/physical-phone evidence. |
| 29 October | `frontend-local-services-regression.log` | Same focused 9 tests passed again, 1.2 minutes. Do not add overlapping totals into a grand total. |

The local/mock API-profile password test was the explicit 22 October browser skip. The logs are evidence of those runs, not current reruns. Phase5D.1's earlier report explicitly says integration QA in progress; the later 5D.2 report and actual retained logs supersede its unfinished regression checkpoint, within their stated scope.

## Routes and real source-backed modules

`src/app/app.tsx` uses lazy modules, authenticated routes and `PermissionGuard`; browser builds use BrowserRouter, packaged/native builds HashRouter. `src/features/auth/route-access.ts` maps route permissions. Dedicated mobile routes are in `src/features/mobile/mobile-routes.tsx`; production/staging narrow browsers are routed to the dedicated staff shell rather than the desktop POS layout.

| Module | Implemented source and functional boundary |
|---|---|
| Dashboard | `features/dashboard/dashboard-page.tsx`, `components/dashboard/*`, `lib/dashboard-actions.ts`: date range with URL state, KPI destinations, actionable activity, sales/profit chart, low-stock and credit reminders. Historical tests verify chart arithmetic/links; no current live financial reconciliation performed here. |
| New Sale/POS | `features/pos/pos-page.tsx`, `components/pos/*`, `stores/cart-store.ts`: product/alias search, categories, cart quantities/prices, customer selection, custom services, checkout/proof/approval, receipt/display. Checkout sends repository payloads, not fake success. |
| Inventory | `features/inventory/*`: product list/editor/detail/media/drafts/bulk actions, stock/location hierarchy, receiving, transfer and quarantine condition operations. Product conditions are separated from grade and active/archive state. Product and stock projections remain permission aware. |
| Customers/credit | `features/customers/customers-page.tsx`, `features/credit/*`: search, contact summary, account/ledger events, obligations, collection/reversal, reminder preview and manual WhatsApp. Customer workspace uses live/source data adapters; browser opening is not delivery proof. |
| Transactions/Returns | `features/sales/transactions-page.tsx`, `components/pos/receipt-lookup.tsx`: filtered paginated receipt search, selected invoice, returnable quantities, stock disposition, approval, return history. Several known UX gaps remain below. |
| Repairs/services | `features/services/service-pages.tsx`, `service-form-page.tsx`, `repair-media.tsx`: service catalogue, job intake/status/technician/customer/private photos. API mode deliberately omits the editable advance payment field. Intake/status UI does not establish complete repair deposits, settlement, cancellation/uncollected/refund accounting. |
| Other management | Purchasing/suppliers/used devices, employees/shifts, coupon/payment administration, reports/audit, website product/enquiry and Settings modules have routes and repository operations. Existence of a route is not full business acceptance. API Inventory report remains explicitly unavailable; API Sales CSV is labelled recent receipts up to25. Full production XLSX import and repair financial completion remain separate scope. |
| Receipts | `receipt-preview.tsx`, `virtual-receipt.tsx`, `lib/invoice-pdf.ts`, `payment-summary.ts`: white thermal/A4 paper, PDF, customer-safe shared link, QR, received/refunded/reversed/net/outstanding distinction. Actual printer/receiver-app acceptance remains open. |

An old `src/features/inventory/README.md` still calls catalogue/stock workflows deferred. That README is stale relative to the implemented source and later tests; it should not be used as the present feature inventory.

## Smart @Product service workflow

Primary files: `components/pos/service-mention-composer.tsx`, `custom-service-dialog.tsx`, `service-material-allocation.tsx`, `price-dialog.tsx`, `compound-price-breakdown.tsx`, `lib/service-composer.ts`, `smart-services.ts`, `compound-service.ts`, `features/mobile/mobile-service-dialog.tsx`, `mobile-service-price.tsx`, `lib/local/service-materials.ts` and the corresponding API/SQL services.

1. Desktop Custom Service and mobile service dialogs use a structured `{before, mention?, after}` document. The mention contains the selected immutable product ID. Typing arbitrary product-looking text does not consume stock. Only deliberate suggestion selection links inventory; one link is supported. Deleting/removing the token removes the link.
2. `@` at a valid boundary opens a caret-positioned option list, currently capped at5. Keyboard arrows/Enter/Tab/Escape, surrounding edits, atomic deletion, literal plain-text paste, copy/cut, undo/redo and composition guards exist. Selected candidates show SKU name/variant, quantity and price. Known short-prefix and dictionary gaps remain below.
3. The selected material displays current retail and sellable location allocations. Quantity must be a positive integer and allocations sum to it without exceeding available stock. No stock is deducted when typing or adding to cart. No available material locations blocks addition.
4. One entered total produces one customer/cart line. `compoundAllocation()` computes product revenue `min(retail×material quantity,total)`, nonnegative labor `max(0,total−basis)` and product reduction `max(0,basis−total)`. Purchase cost/profit are not that labor value. Example retail2000/total2500 produces product2000+labor500; total1800 produces product1800+labor0+reduction200.
5. Retail/floor checks attach to the actual linked SKU and its current price snapshot. Below-retail reason/permission, configured floor block or manager approval, stale-price review and refreshed material snapshots exist. Desktop cart price dialog obtains a SKU-bound price approval; mobile below-floor editing sends the user to an authorized counter. Checkout repository/SQL must enforce the policy even if a UI path is bypassed.
6. Saved linked templates reopen current material-price review and add current retail plus saved labor. They do not simply insert the old advertised service price and bypass material review. Service-only work has no invented part floor. Linked custom service checkout requires connectivity; it is not accepted as durable offline SQLite checkout.
7. Historical local tests assert single deduction/idempotent retry, preserved split and product-only default return. Source backend tests include floor override binding, stale retail/minimum changes, immutable allocation, classified stock restoration, authorized labor-refund exception and tax/rounding/partial-credit behavior. Those backend tests are not freshly rerun by this subtask.

The retained 9-test logs directly exercise token identity/copy/paste/composition and changed-price floor blocking. They do **not** cover single-letter mention search or physical keyboard/IME/camera/printer behavior.

## Fresh reproducible search defects

A read-only Node command transpiled `lib/product-search.ts` in memory and invoked the function with a synthetic product named `Vivo Y20 Panel`, model `Y20`, alias `y20 lcd`. No database or persistent fixture was used.

| Query | Matched synthetic product? |
|---|---|
| `v`, `vi`, `viv` | No |
| `Vivo` | Yes |
| `y` | Yes, because normalization makes it a complete model word |
| `y2` | No |
| `y20`, `panel`, `lcd` | Yes |
| `panal` | No in shared generic search; mention composer separately rewrites this exact typo |
| partial `TM-0` | No |
| exact `TM-0000001` | Yes |

`lib/product-search.ts:102–115` permits prefix score0.2 only for terms length>=3, but compares it with `floor(length×0.3)`. For length3 that threshold is0, so three-character prefixes also fail. Terms length1/2 require whole-token equality. Code/barcode-looking queries beginning with `tm ` or at least4digits take an exact-only branch (`:82–86`), so partial code and numeric suffix search are not implemented there.

`ServiceMentionComposer` invokes `searchProducts` with its default dictionary and only special-cases `panal`/`panl`. Desktop regular POS and Products list pass the saved `settings.searchDictionary`, but mention composer, mobile sales/products and global product search omit it. A synthetic configured alias matched when the dictionary was passed and failed with the default dictionary. Product-specific aliases still work because they are included in each product's search fields. Whole-alias expansion also means generic fuzzy behavior is not universal: the `panel→screen` canonicalization can remove the close literal word that an unrecognized typo would have matched.

These are current source/pure-function findings, not speculative failures inferred from old screenshots.

## Known issue1–20 assessment

Numbering supplied by the parent audit; native/device issues are cross-referenced to its separate audit.

| # | Issue | Current assessment and evidence |
|---|---|---|
|1|Short mention search|**Unresolved, freshly reproduced.** Shared search rejects ordinary1/2/3-letter prefixes; all consuming views inherit it. Composer has no first-character exception.|
|2|Oversized custom modal|**Bounded source implementation; acceptance partial.** Default dialog max-width470px, max-height90dvh, scroll frame (`styles/globals.css:1798`, `counter.css:87–88`). Compound UI is denser but material allocation/suggestions can still make it long. No fresh loaded modal/keyboard visual measurement performed; the focused services tests do not assert modal dimensions.|
|3|Blank price treated aszero|**Unresolved presentation/state issue, with submission guard.** Desktop `custom-service-dialog.tsx` stores numeric0 and uses `Number(e.target.value)`; empty is0, rendered as empty by `price||''`, while split/floor messaging computes0. Add to Sale is disabled for `price<=0`, so this finding does not demonstrate a posted zero-price sale. Mobile new service keeps a string; editing dialog also explicitly rejects blank input.|
|4|Damaged badge absent fromPOS|**Unresolved.** `components/pos/product-card.tsx:49–53` only shows service/out/low/in-stock. `PosProduct` has no damaged-count field. Products list/detail and Stock have separate damaged/quarantine counts/history; POS does not display them. Sellable quantity filtering is a separate concern.|
|5|Auto-select sole return item|**Unresolved.** `ReturnsPage` initial form values set quantity/destination/location, but no productId (`transactions-page.tsx:435–441`). `RecordForm` always adds a blank Select option (`workspace.tsx:504`). One returnable line still requires a manual choice.|
|6|Confusing manualrefund|**Unresolved UX/partial safeguards.** API Returns unconditionally renders “Manual refund paid (no automatic gateway refund)” and receipt checkbox (`transactions-page.tsx:400`) before showing a resolved payout amount/method or distinguishing credit balance reduction. No external gateway refund is claimed. Source financial protections may be correct while this presentation remains confusing.|
|7|Copy Message|**Implemented, environment reliability incomplete.** Both reminder components call `navigator.clipboard.writeText` directly, with async error UI but no capability/permission fallback. `CustomerReminder` also refreshes source obligation and records “prepared”. Clipboard availability on insecure LAN HTTP/native WebView is not established by the old localhost tests; manual-copy fallback is absent.|
|8|Open WhatsApp|**Implemented, partial acceptance.** Reminder components normalize numbers/encode text, preopen a browser window before awaits, report blocking and use Tauri opener on native desktop. VirtualReceipt uses direct `window.open` with no blocked-window feedback/native opener. Historical `phase5d-whatsapp.spec.ts` stubs window.open to inspect the URL; it does not launch WhatsApp or prove sending.|
|9|Dashboard verticalspace|**Still a density concern, not an asserted functional failure.** Source preserves KPI grid then chart/activity then low-stock/reminders. Re-inspected existing `docs/screenshots/phase5d2-theme/dashboard-dark-1366.png`: KPIs/chart/activity visible, lower dashboard content requires scrolling at1366×768. No fresh owner-data viewport acceptance.|
|10|Productfilter space|**Implemented and historically tested.** `features/inventory/product-toolbar.css` adds compact width/wrap/grid rules; retained toolbar test checks every filter/action, height bounds,1920single row and all six widths/two themes. No current browser rerun.|
|11|Darkmode|**Implemented and historically checked.** Neutral grayscale/gold tokens, semantic contrast, white receipt paper and appearance migration. Theme notes record11tests/88total screenshots including toolbar. Existing1366dark dashboard re-inspected and readable. Physical Android/system-bar acceptance is separate.|
|12|DenseQR|**Partly addressed by payload/reference changes; scanner acceptance open.** Receipt frontend uses secure receiptUrl or invoice, margin4, correctionM,88px thermal/96px invoice; PDF QR is320px source rendered27mm. 5D.2 added opaque receipt references instead of new long JWT links (legacy supported). Enrollment is a different proof payload displayed280px. Density/readability must be tested separately per QR/hardware; no physical decode claim.|
|13|Virtualreceipt|**Implemented, partial.** PDF, link copy, WhatsApp URL and Web Share exist; absent receiptUrl disables link actions with an explanation. Direct clipboard/window.open reliability gaps above persist. Receipts' public projection/security and deployed link reachability require backend/environment evidence.|
|14|Scannerrecognition|Separate native audit. Historical tests validate browser/native boundaries and generated payloads; frontend alone cannot close actual scanner recognition/focus/lighting/safe-area acceptance.|
|15|Mobilenav/settings|Separate native audit. 29October browser fixture tests cover dedicated narrow-browser shell/cloud Settings omissions; this does not replace actual installed Android navigation/keyboard checks.|
|16|Missingimages|**Unresolved operational evidence.** 5D report documented130metadata rows with absent historical bytes and missing-media network errors; no originals were recovered by this audit and current missing count was not remeasured. Media components exist; current backend corruption is an additional root-audit blocker, not evidence those original bytes recovered.|
|17|Pairinglogin|Separate native/security audit. Frontend has companion PC approval/fingerprint/expiry UI and explicitly camera-only scope, distinct from ordinary staff sales sign-in. Source UI does not prove a physical successful pairing.|
|18|Crossdevicestock|**Implemented, historically real API tested.** 29October isolated API test exercised separate desktop/mobile contexts and stock changes surviving refresh. Revision/polling browser tests exist. This is not current November acceptance and not SQLite phone-sale authority or physical multi-device offline acceptance.|
|19|Windowsbuild|Separate native/root audit. A valid frontend bundle or Tauri config is not evidence an EXE compiled/installed or printer/display/native offline flow worked.|
|20|Realoffline|Separate native/backend audit. Existing browser cache/drafts, native SQLite outbox and online/LAN API paths are different authorities. Linked custom services and ordinary API mobile checkout do not become durable counter-SQLite offline checkout because a page is cached.|

## Phase status and practical next evidence

**Phase5D.2 exists:** owner brief, plan, progress, implementation report, source, APK-era artifacts and the actual22/29October logs are present. Its final reported state is ready for physical retest with explicit unaccepted hardware/deployment/offline boundaries, not universal production completion.

**No Phase5D.3 implementation/specification/test/report was found** by case-insensitive `5d3`/`phase5d.3` searches in docs/src/tests/scripts/package metadata. The next visible development work is **Phase6A**, with a29October Vercel-readiness progress report, source changes and browser/API test evidence. Do not invent a5D.3 completion milestone from the5D.2 revised report.

Priorities from frontend findings: restore checkout build/runtime integrity first (root audit), then reproduce loaded owner workflows in an isolated safe runtime; fix prefix/dictionary search, blank-charge semantics, POS condition visibility and Returns defaults/refund explanation; verify clipboard/opener capabilities on actual intended HTTPS/LAN/native runtimes. Retain explicit separation between local fixture success, real isolated API success, physical acceptance and deployed reachability.
