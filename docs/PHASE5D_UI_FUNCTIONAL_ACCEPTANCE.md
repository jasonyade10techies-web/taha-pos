# Phase 5D — UI, functional audit and localhost acceptance

Work: 16–17 October 2026, Asia/Karachi. Specification: `docs/PHASE5D_REQUIREMENTS.md`. Progress: `docs/PHASE5D_PROGRESS.md`.

**Implementation and acceptance review completed; final execution results are recorded below.** Local owner testing uses the saved development database, with the historical missing-media limitation described explicitly. No Windows EXE/installer development, deployment, dependency upgrade or production database reset is part of this phase. The existing Dashboard/POS layouts, Manrope and red/yellow/gold branding remain. This is browser/development acceptance, not production or physical hardware certification.

## A. Feature audit and actual verification boundaries

| Module | Before | Changes / verification in this phase | Remaining boundary |
|---|---|---|---|
| Dashboard and sales/profit ranges | Implemented | Preserved structure; existing range/point, contrast and responsive regressions rerun; source-derived financial aggregates retained | Actual owner catalogue/reporting acceptance required |
| POS search/cart/bargaining/coupons | Implemented | Existing functional browser scenarios rerun; persistent cart/customer-service row preserved | Native HID/touch acceptance separate |
| Smart Custom Service | Implemented | Existing exact/fuzzy/variant/component scenarios retained; no minimum-charge field added | Stock-dependent consumption remains online |
| Checkout cash/digital/credit/split | Implemented | Review/idempotency/proof gating preserved; cash/digital customer display and signed receipts exercised through separate test layers | No external payment-provider verification is implied |
| Products/editor/gallery | Implemented, unknown cost could become zero | Fixed absent purchase cost in editor/local repository; explicit zero preserved; image/persistence checks and current gallery tests | Physical phone capture remains unverified |
| Product bulk selection | Broken mouse selection | Checkbox click bubbled into row navigation; shared table now ignores interactive controls. Native mixed state added | Large-list pagination/caps remain existing boundaries |
| Available/damaged/test stock | Implemented | Classified-return/condition and idempotency checks retained; source audit confirms available/quarantine separation | Historical unlocated damaged evidence requires owner review |
| Receiving/transfers/locations | Implemented online | Existing atomic movement and hierarchy regressions rerun | No new offline stock administration |
| Customers/credit/ledger | Implemented, earliest-due and older-receipt navigation gaps | Earliest actual due date selected; complete filtered/paginated receipts reachable beyond first 100; collection/ledger checks | Existing list projections have size caps |
| Reminders/WhatsApp | Manual workflow implemented; virtual receipt mishandled0092 | Reused central phone normalizer; intercepted correct92300… WhatsApp target without sending; real enabled reminder previews current1500 balance/Pakistan due time | Staff sends manually; no automatic PDF attachment/delivery |
| Returns/refunds/void | Implemented online | Existing classified restoration/overreturn/retry checks retained; real API cases separate from browser demo | Actual cash handover/physical print not certified |
| Reports/export | Incorrect tab exports; empty API Inventory; partial Sales list unlabeled | Tab-specific CSV data; sample export explicitly labeled recent25; complete date-range transactions link; API Inventory directs to Stock with export disabled | Full aggregated/paginated API inventory report intentionally unavailable |
| Employees/PIN/permissions/shifts | Implemented online | Current backend authorization/financial tests rerun; sidebar/palette no longer offer forbidden pages | PIN switching is not an offline login mechanism |
| Repairs/jobs | Partial operational workflow | Existing pages/actions inspected; unavailable repair settlement is not converted into fake success | Full repair financial settlement deferred |
| Used devices/suppliers | Baseline implemented | Existing route/transaction regressions retained | Full inspection/warranty workflow not certified |
| Global quick search | Page-only | Existing Ctrl+K extended to grouped authorized products/customers/receipts/services/locations/pages; debounce, caps, partial-source retry, keyboard/focus checks | Existing API list caps bound completeness; no universal backend search endpoint added |
| Profile/menu/settings | Implemented with repeated-action and wording defects | Repeated Devices/Password actions reopen; notification entries use keyboard menu semantics; real/demo/offline copy corrected | Native advanced controls remain installed-app only |
| Customer Display | Implemented browser/native source | Existing sanitized live-state/terminal-isolation regression retained | Real second monitor/native window remains unverified |
| Dedicated Taha Staff app | Implemented | Separate bundled staff entry tested at phone widths; screenshots/fixtures distinguished from physical device | APK, actual camera/gallery permissions/background lifecycle not accepted here |
| Offline cash/reconciliation | Phase5C.1 implemented/tested | Immutable evidence, actor separation and cash closing architecture preserved; SQLite/server regressions rerun | Native Windows/DPAPI/crash/printing acceptance separate |
| Import/export/public website/hardware | Partial/deferred | Existing unavailable actions remain explicit; no mock success substituted | XLSX production import, public website, ESC-POS/native releases not built |

“Implemented,” “automatically tested,” “physically verified,” and “deployed” are different. A visible route/button alone is not evidence that a business workflow is complete. Source/action inspection and targeted journeys cover representative daily workflows; this is not a claim that every possible action/input combination or hardware device has been exhaustively accepted.

## B. UX corrections

1. **P0 financial semantics:** `src/features/inventory/products-page.tsx`, `product-editor.tsx`, `src/lib/local/catalog-repositories.ts` previously coerced unknown cost to zero. An unrelated product edit could persist a free-item cost and overstate future profit. Empty cost now means preserve existing/unknown; zero requires deliberate entry. The local read projection returns NULL for missing cost.
2. **P1 selection:** `src/components/ui/workspace.tsx` no longer invokes row navigation when a child checkbox, button, link, label, select or other interactive control is clicked. Product bulk selection now displays a native/visual indeterminate state through `AppCheckbox`.
3. **P1 report accuracy:** Sales/Profit/Inventory/Credit exports previously often exported top-product rows. `reports-page.tsx` now exports the selected data. API inventory is explicitly unavailable rather than an empty fake report; API Sales explicitly identifies its25-receipt sample and links to the complete paginated date-range list.
4. **P2 credit/navigation:** earliest due sorting, full customer receipts link, URL-aware transaction date-range filters and invalid-range feedback.
5. **P2 discoverability/accessibility:** grouped Ctrl+K results, permission-aware sidebar/page search, repeated profile hash cleanup, notification keyboard menu items and visible select-label associations using existing `Field`.
6. **P2 testing clarity:** a compact development-only Local Test Data indicator identifies real local API persistence. Synchronization/About/Data settings no longer describe API mode as IndexedDB demo or claim all offline sync is future work.
7. **P2 mobile/chart rendering:** an empty mobile chart emitted the number0 between the KPI grid and paired-counter card because of a numeric JSX conditional. It now uses a boolean conditional. The zero-sales desktop axis also rounded four ticks to repeated0k/1k; compact numeric labels now remain distinct. Both were observed in screenshots and reproduced in focused regressions. The Sales legend retains gold when Profit is unavailable; the profit color now applies specifically to the second legend item rather than whichever item happens to be last.
8. **P2 receipt contact:** Virtual Receipt previously transformed0092 phone numbers into920092…/92092… destinations. It now uses `normalizeWhatsapp()` and explains invalid numbers. The regression records the intended URL without contacting WhatsApp.
9. **P1 development-media persistence:** the saved development configuration used a Windows Temp directory. The local acceptance bootstrap now copies every readable source file to `server/data/local-acceptance-media`, refuses different destination content, checks SHA256 and retains the original files. This prevents newly tested uploads from depending on Temp. It does not reconstruct missing historical photos.

## C. Search and keyboard

`src/components/navigation/workspace-search.ts` uses existing authorized projections, current staff/store/permission-scoped query keys, existing Roman Urdu product matching/Fuse, a200ms debounce and capped result groups. A record result opens its actual record. No sale/payment mutation originates from search. Source failures preserve other groups and provide Retry search. Ctrl+K, arrow keys, Enter and Escape/focus restoration are tested. Sales-only staff retain the existing POS product search; inventory-only record destinations are not offered to them.

The API customer list is currently bounded to250 and some other lists are capped; global search must not be represented as a complete server-wide search beyond those projections. Receipt lookup uses its existing server search/pagination. Transaction range links preserve the prior exact `date` URL convention.

## D. POS, receipts and money

The left search/product area, persistent Current Sale panel, Walk-in Customer plus Custom Service row and yellow checkout CTA remain. Service inputs have one employee-set charge. Product/component stock changes only when the sale engine commits. Existing cash/digital/credit/split, review, proof, coupon/tax and customer display behavior is preserved.

Thermal and A4/PDF are separate render modes; receipt paper stays white in either theme. Browser PDF verification checks actual generated output. Print-dialog invocation/preview is narrower evidence than successful physical printing. Virtual receipt/WhatsApp opens a prepared link/message; no claim of automatic delivery or PDF attachment.

## E. Backend, data safety and localhost

The saved local development configuration identifies `taha_api_browser_1791211953496` on loopback PostgreSQL55439. Before migrations, a custom-format backup was created and inspected:879 archive entries,698323 bytes, SHA256 `FB523280F052B70493137D024ED1B25935C5A3C028C915F5493766070265D5A0`. It is retained at `.test-postgres/phase5d-20261016/owner-dev-before.dump`; verification manifest is alongside it.

All48 existing migration hashes matched source. Seven pending Phase5C/5C.1 migrations and dedicated-runtime grants were applied only to that intended development database. Existing accounts/business records were retained. No production data was reset or replaced. `server/scripts/prepare-local-acceptance.ts` rejects non-loopback/non-fixture database URLs and refuses changed applied migration hashes.

Launcher: `scripts/start-local-acceptance.ps1` or `node scripts/start-local-acceptance.mjs`. Backend bootstrap: `server/scripts/local-acceptance-api.ts`. They retain the saved local accounts/configuration, wait for crash recovery, use environment variables, avoid printing secrets, do not reset or seed, and do not terminate unrelated listeners. Logs/PIDs: `.test-postgres/local-acceptance/`. Frontend1423 uses current Vite source and real custom API3001. The optional LAN address is determined from current adapters, never an old hardcoded IP.

Windows rebooted during this phase, including **17 October at01:20:32**. The interrupted first full browser run stopped after54 successful cases and has no complete-suite result; `browser-full-current.log` is retained. Services and verification were restarted. Availability is rechecked at completion; no claim is made that a launcher survives a Windows reboot without being run again.

The owner database completed PostgreSQL's ordinary recovery at01:55:09 without a reset. The independent test cluster remains separate on55459. Authentication smoke checks write their normal sessions/audit records, but the owner-data smoke does not create/edit products, sales, credit or stock. Business mutation journeys run only on disposable API3002 and a separate seeded database.

### Historical media finding — not silently repaired

The saved owner-development database contains132 undeleted media metadata rows. Only two primary files were readable in its configured Temp media directory. The other130 had no matching file in the seven `taha-api-browser-media-*` Temp directories or the existing `server/data/media` and project `data/media` roots checked. This is a bounded evidence check, not a full-machine recovery search. Metadata and financial evidence were neither deleted nor replaced. The database dump does not contain file bytes.

Six physical files (two primary files and their original/thumbnail variants;1,964,330 bytes) were copied and hash-verified in durable development storage. See `server/data/local-acceptance-media/local-copy-manifest.json` and `.test-postgres/phase5d-20261016/media-recovery-check.json`. Source files remain in place. The132 count is media metadata rows, potentially including staged/orphaned uploads; a complete attachment-level recovery assessment has not been performed. The two readable primary files are unattached historical camera captures (`entity_id` NULL); a new standalone owner session correctly does not get signed URLs outside the old request session. Disk hashes verify their preservation; access rules were not relaxed to force a download. See `media-final-diagnostic.json` and `preserved-media-verification.json` in the evidence directory. Existing missing-media requests still fail and can generate network/console errors; product thumbnails fall back to schematic placeholders. These errors are not a CORS/auth bypass to fix by granting public access. Original files or an appropriate file backup are required to restore those historical records. New isolated upload/edit/reload and proof upload paths pass independently.

## F. Verification record

Evidence directory: `.test-postgres/phase5d-20261016/` (work continued on17 October).

| Check | Current recorded evidence | Boundary |
|---|---|---|
| Backend baseline |150/150,449.1s on16 October (`backend-baseline.log`) | Isolated PostgreSQL55459 |
| Backend recheck |150/150,270.4s on17 October (`backend-current.log`) | Current engine/auth/security; no hosted backend |
| SQLite/evidence |16/16,498.5ms on17 October (`sqlite-evidence-final.log`) | `node --test scripts/test-desktop-sqlite.mjs scripts/test-cash-evidence.mjs`; actual SQLite/shared SQL, not Rust IPC/native power loss |
| Products/controls |4/4,22.8s (`product-controls-final.log`) | Browser demo fixture; cost and selection regression |
| Reports/credit/history |10/10,58.6s (`.test-postgres/phase5d-workflows/final-green.log`) | Includes API-shaped transport/aggregate cases; not real cloud persistence |
| Search/profile/notifications |7 local passed,1 API-only skipped; separate API password1 passed | Dedicated fixtures; scoped logs in phase5d-controls |
| Full serial browser |136 passed,1 failed,1 skipped,23.3m (`browser-full-after-reboot.log`) | Failure was Python missingpypdf; intentional skip is API-only password case in local fixture. First interrupted run is not a pass |
| Print failure rerun |1/1 passed,40.6s (`print-runtime-green.log`) | Correct existing bundled Python viaTAHA_PDF_PYTHON; no install. This is a targeted rerun, not a claim the first full run was clean |
| Reconciliation UI |5/5,40.8s (`reconciliation-current.log`) | API-shaped isolated transport fixture, not live owner reconciliation decisions |
| Final products/chart/WhatsApp |6/6,3.1m (`final-focused-six.log`) | Separate targeted cases, overlap with broad suite; do not add as distinct grand total |
| Real API browser persistence |4/4,3.4m (`api-final-four.log`) | Disposable API3002 + separate PostgreSQL database, not owner financial records |
| Dedicated staff visual checks |2/2,56.9s (`mobile-acceptance-final-green.log`) | Two phone sizes, each both themes; mocked transport/fake camera preview, no physical handset claim |
| Frontend build / TypeScript |Passed `npm run build` (`npm-build-accepted.log`; delivery CSS recheck recorded below) | Includes strict TS build then Vite; test fixture JSX setup corrected |
| Frontend lint |Passed `npm run lint` (`npm-lint-accepted.log`) | Zero reported errors |
| Backend build / lint |Passed `npm run build` and `npm run lint`, including final media-manifest/LAN-origin startup (`server-build-final-verified.log`, `server-lint-final-verified.log`); separate no-emit TypeScript check also passed | Managed package created locally only; not deployed |

Cold-start fixture failures, an incorrect mobile loopback test address (correctly rejected by the app), and mistaken test labels are retained as failed test executions. They are corrected in the fixtures without inflating every timeout or hiding an application failure. Actual regressions such as unknown cost and checkbox row navigation were reproduced separately and fixed at source.

The API fixture also initially reloaded immediately after Save and queried stock immediately after clicking Complete Sale. Those reads raced the asynchronous mutations. It now waits for the saved record navigation and Sale Complete before checking persistence. The payment button's complete accessible name and authenticated-route readiness are respected. A report screenshot that only caught “Opening workspace…” was rejected during review; final captures wait for the successful session refresh, exact heading and data loading to finish. Test-source import/JSX setup failures are retained separately from application defects.

Representative real API arithmetic: opening36 panels; cash sale3 =>33; sellable return1 =>34 available; damaged return1 =>34 available plus1 quarantine; credit sale1 =>33; linked service1 =>32. Credit2000 less collection500 =>1500. Adding the linked service to the cart leaves quantity unchanged; completed checkout consumes once. Product name-only edit retains NULL purchase cost. No actual payment transfer, cash refund handover or WhatsApp delivery is claimed.

## G. Visual, responsive and accessibility review

Screenshots are stored under `docs/screenshots/phase5d/`. Required desktop sizes1920×1080,1440×900,1366×768,1024×768 and phone sizes390×844,412×915 are covered by current suites. The approved layout is preserved. Screenshot inspection, actual loaded headings, menu/dialog bounds, root overflow, keyboard/focus, bundled font and semantic contrast checks are separate evidence, not interchangeable.

Reviewed representative files include `dashboard-api.png`, `live-dashboard-1366.png`, `pos-empty.png`, `pos-populated.png`, `checkout-cash.png`, `checkout-digital.png`, `custom-service.png`, `product-empty-media.png`, `product-with-image.png`, `live-products-1366.png`, `damaged-stock.png`, `customer-ledger.png`, `receipt-lookup.png`, `return-form.png`, `credit-reminder-enabled.png`, `receipt-dark.png`, `virtual-receipt.png`, `live-profile-1366.png`, `staff-mobile-light-390.png`, `staff-profile-dark-390.png`, `staff-devices-dark-390.png` and `staff-scanner-390.png`. After the final API pass, `checkout-digital-proof.png`, `settings-dark-1024.png`, `profile-light-1024.png`, `receipt-light.png`, `dashboard-dark-1366.png` and `live-header-settings-1024.png` were also inspected. `return-form.png` includes lookup/history; classified return mutations were exercised through the real repository/API, with separate existing UI regressions for the return wizard.

- POS1366: persistent totals/checkout remain visible, Custom Service stays beside customer, minimum product price remains present, purchase cost is absent.
- Product/media: empty/add tile and uploaded thumbnail use existing compact gallery; saving unknown cost no longer invents zero. Long forms scroll within the content area.
- Desktop themes/sizes: exact headings, authenticated content, loading completion and no document horizontal overflow are asserted. Tables can have their own purposeful scroll area.
- Phone390/412: dedicated staff shell, bottom navigation, Home/Activity/Devices/Profile in both themes and square QR target captured. Home's stray zero is gone. Camera frames use synthetic preview in this suite.
- Tablet1024: visual review also caught the profile control clipped at the header's right edge even though document overflow checks passed. The existing1150 breakpoint now compacts the staff-phone text to its icon/status dot, retaining the full accessible name and menu. Header bounds and an updated screenshot verify the correction separately from root-overflow tests.
- Credit/receipts:1500 balance agrees with collection and reminder, normalized Pakistan phone/date; receipt paper stays white in dark mode; reminders are preview/manual actions. Temporary top-center toasts can cover a heading while visible, but do not cover the checkout CTA.
- Performance: owner-data full-page navigation after warmup was approximately1.4–8.4s under concurrent tests/low-memory disk pressure. These are development observations, not a production performance guarantee. Search debounces200ms; actual scoped keyboard/search regressions pass. No paid AI or new large chart library was introduced.

Native selects are intentional hidden form/automation mirrors; visible controls are custom. Ordinary toasts remain top-center and do not replace persistent actionable inline errors. Reduced-motion handling is preserved. Native printer/scanner, Android on-screen keyboard, gallery, camera and real monitor behavior remain physical acceptance items.

## H. Known limits and deliberately unavailable work

- **P1 historical local media:**130 undeleted development metadata rows lack their file bytes in the checked locations. Originals/file backup must be recovered; no records were discarded. Combined database+private-file backup/restore acceptance remains a pre-production gate.
- Native Windows and physical Android/printer/second-monitor acceptance remain outstanding. No EXE/MSI/NSIS/APK was built in this phase.
- API Inventory report is explicitly unavailable with a Stock-page alternative. API Sales export is a labeled recent25 sample; complete receipts are available through filtered pagination.
- List-based global search has documented existing projection caps. A dedicated complete paginated backend search is a later bounded improvement.
- Browser shared-backend transactions require connectivity. SQLite durable offline cash/reconciliation remains a Windows-native acceptance item; no unsafe offline credit/stock/permission actions were enabled.
- Existing mobile photo queue/request expiry and foreground-only lifecycle limits remain; this UI phase does not certify durable long-outage/reinstall recovery.
- Production repair settlement, XLSX import, managed backup/restore and actual hosting configuration remain deferred/partial. Legacy Supabase compatibility code was neither reconnected nor opportunistically removed.
- Production payment account/QR information and operational printing require owner setup; test fixtures are explicitly synthetic.

## I. Owner checklist (maximum15 steps)

1. Open the localhost Dashboard and sign in with the existing development owner account. Confirm the Local Test Data indicator.
2. Switch light/dark theme; check Dashboard date ranges and chart points.
3. Press Ctrl+K; find a product, customer and receipt, and open the selected result.
4. Open Products; select several checkboxes without opening a record. Add/edit a test product with photos and rack/shelf/box.
5. Confirm an unknown purchase cost stays blank after a name-only edit; use zero only for a truly free item.
6. In New Sale, search a local alias/typo, add products, adjust quantity and permitted price.
7. Choose/add a customer; add a Custom Service beside it. Try a saved part-consuming service.
8. Complete a test cash sale with change; verify the prominent invoice number and total.
9. Preview the white80mm receipt and A4 invoice, download PDF, and open Virtual Receipt. WhatsApp sending remains manual.
10. Find that invoice by its final digits; return one item as sellable and another as damaged. Review the correct stock history.
11. Create a credit sale, receive a partial payment, and compare outstanding balance with the customer ledger.
12. Preview a payment reminder; check the customer number, Pakistan due time and message before opening WhatsApp.
13. Test a digital payment account/QR and attach a proof; inspect Customer Display for customer-safe information.
14. Check Reports/exported CSV, complete dated Transactions and employee history; inspect Synchronization Exceptions.
15. Open Devices/Profile and the staff mobile preview; check pairing/camera UI separately on the real phone before accepting physical integration.

## J. Inventory, ledger and accounting verification detail

- **Inventory:** real API product creation with one uploaded image, rack/shelf/box, aliases and opening36 units; name edit and reload preserve photo and unknown cost. The three-unit cash sale and two classified returns reconcile34 available/1 quarantine. Existing broad gallery tests cover batch selection, crop, primary/reorder, invalid image retry and unsaved changes. Existing stock/locations/transfer/adjustment regression layers remain online. Receiving, costs and stock administration were not enabled offline.
- **Smart services:** typing and adding linked work leaves stock unchanged. Confirmed sale consumes the selected component once and records the invoice; employee enters one charge with no service minimum field. Unknown material cost stays unknown in financial projections. Reusable catalogue suggestions and removal/replacement/variant behavior are covered by existing service tests.
- **Credit:** actual PostgreSQL credit sale2000, cash collection500 and customer outstanding1500; ledger and reminder agree. Due time is presented in Pakistan time. Earliest-due account selection and date-filtered receipt navigation were repaired. The API reminder fixture explicitly enables shop/customer reminders, checks the current message and enabled Open WhatsApp control, then closes without sending.
- **Accounting:** current150-case backend suite includes financial permissions, idempotency, concurrency, returns, void/reversal, credits, stock conditions and offline reconciliation. Collected offline cash evidence remains separate from posted revenue; owner exception decisions remain protected. This phase changes no transaction functions or schema rules beyond applying already-written migrations to the saved development database.
- The coherent API Dashboard screenshot reports6500 net sales and5000 cash collected: sales6000 minus4000 returns plus2000 credit sale plus2500 service; cash6000 minus4000 refunds plus2500 service plus500 old-debt collection. The500 collection is cash, not new sales. Gross Profit correctly remains unknown because the panel cost snapshot is NULL.
- **Receipts/display:** actual cash PDF has a valid PDF header; print matrix checks thermal single-page size and long A4 pagination with Poppler/pypdf. QR account selection/customer display privacy/terminal isolation are included in the browser regression. A synthetic JazzCash QR and uploaded proof were verified against actual API media storage. No real payment was made.

## K. Remaining priorities

| Priority | Issue / boundary | Next action |
|---|---|---|
| P1 | Historical local media bytes absent; active pages can emit image network errors | Recover originals/file backup and reconcile referenced files; retain all metadata/evidence. Validate database+private-file backup and restore together before production |
| P1 | Native offline/printing/camera hardware acceptance not performed here | Bounded Windows build/native offline and physical phone/printer acceptance after owner browser review |
| P2 | Full API Inventory report unavailable; Sales CSV limited to explicitly labeled25 sample | Dedicated aggregated/paginated report endpoints/exports; existing Stock and complete Transactions remain usable |
| P2 | Global cross-record search bounded by existing list projections | Add authorized paginated backend search when real catalogue/customer volume requires it |
| P2 | Long settings section list and selected-option menu semantics | Later bounded settings/accessibility refinement; visible selects and keyboard labels already repaired |
| P3 | Production repair settlement, full XLSX import, public website/other deferred functions | Separate approved phases; no fake success added |

## L. Localhost delivery and restart

Frontend: `http://localhost:1423/dashboard`. Backend health: `http://localhost:3001/api/v1/health`. The current code uses custom API persistence with saved development owner accounts; it is not mock-owner login or IndexedDB demonstration saving. The Local Test Data indicator remains deliberate. Sign in as `owner@taha.test` using the existing development password; passwords/PINs/tokens are not reproduced here.

Start again after a future Windows restart, from the project root:

```powershell
.\scripts\start-local-acceptance.ps1
```

It starts the saved development PostgreSQL/API/current frontend detached with hidden process windows; logs are in `.test-postgres/local-acceptance/`. Do not run the disposable test seeder against the owner database. The launcher reuses existing listeners and does not stop unrelated processes. Wait for health200 before attempting sign-in if PostgreSQL is recovering.

The requested browser tab was queued through the Codex app's browser opener; the verified URL is also provided directly for owner use.

## M. Final live acceptance — 17 October 2026

| Service / check | Verified result |
|---|---|
| Frontend |`http://localhost:1423/dashboard` returned200; current-source Vite PID2172, bound0.0.0.0 |
| Custom backend |`http://localhost:3001/api/v1/health` returned200, statusok, databaseconnected; final PID17820, bound0.0.0.0 |
| Saved development database |PostgreSQL PID2228, loopback55439; accounts/records retained |
| Existing development owner login |201, roleowner, Taha Mobiles context; no password/token output |
| LAN observation |Active Ethernet192.168.1.5; shop API address `http://192.168.1.5:3001` returnedhealth200 from the PC. Local bootstrap derives this origin from active private interfaces, preferring Ethernet/Wi-Fi and excluding common virtual/VPN adapters. QR/media links advertise it instead of localhost. Physical phone/firewall path not accepted in this phase |
| Final frontend build |`npm run build` passed after final CSS correction,23.23s Vite stage; `npm-build-final-verified.log` |
| Final frontend lint |`npm run lint` passed; `npm-lint-accepted.log` |
| Final live render |Dashboard/POS/Products/Settings/Profile rendered in the saved owner development data, Manrope, no root horizontal overflow, no JavaScript exceptions |
| Header1024 |Profile control x966,width34,right1000 inside1024 viewport; `live-header-settings-1024.png` reviewed |
| Known live console/network result |Read-only smoke exited1: one expected pre-login refresh401 and12 missing legacy-media requests; **not** a clean console pass. See `live-ready-final.log` and `live-readonly-smoke.json` |

Final live navigation readiness with data loading complete: Dashboard3194ms, POS1803ms, Products3932ms, Settings2182ms, Profile1332ms. These timings were observed under local development load. The tablet header correction, white receipt in light mode, dark Dashboard, enabled reminder, digital proof preview and loaded Settings/Profile screenshots were visually reviewed in addition to the listed captures. The genuine JS exceptions count is0; missing-media errors remain explicit.

**Ready for owner localhost testing: YES, with the known historical-media limitation. UI/functional repairs and automated acceptance are completed within the documented boundaries. Historical-file recovery, native Windows/offline, physical Android camera/pairing and printer acceptance remain outstanding.** Existing processes are left running after the launch commands return. No Windows EXE/installer, new APK, hosting deployment or production configuration was started in this phase.

## N. Recommended bounded continuation

First have the owner run the15-step checklist and record operational feedback. In parallel, recover the missing referenced development media from originals/file backups and validate one combined database+media restore. Then schedule Windows toolchain/build and native offline/receipt/customer-display/phone-bridge acceptance as its own phase. Hosting and final installers follow those acceptance gates; no new broad redesign is recommended.
