# R2A test results and evidence

Evidence date: **11 November 2026, Asia/Karachi**. Private root: `.test-postgres/r2a-20261111/`. These are fresh local checks, not historical R1 claims or physical production acceptance.

## Results

| Gate | Actual result | Evidence |
|---|---|---|
| Archived PostgreSQL restore | **PASS**: 60,378 extracted file hashes; 64 matching migrations; 73 application tables; 195 FK relationships, no orphans; 398 catalog indexes, none invalid; sale/return checks consistent | `restore-extraction.json`, `restore-database-verification.json`, private schema/log |
| Complete backend regression | **224 passed, 0 failed, 0 skipped**, 243.85 seconds; 19:13:53–19:17:59 PKT | `backend-full.log`, `backend-full-result.json` |
| New search/preview focused checks | **10 passed**; frontend/backend prefixes/model/SKU/barcode parity, refund rounding/labor/tax and phone normalization. Included in full backend count | `preview-search-verified.log` |
| Financial/template checks | Current cases included in 224: credit-only and partially paid credit returns, other invoice debt, exact manual bank payout, stale preview rollback, retries, damaged projection and immutable template history | Named R2A cases in `backend-full.log` |
| Fresh real-API browser run | **9 passed**, 2.7 minutes: eight required journeys plus real private-image upload/reload. Additional credit-only return browser case **1 passed**, 13.6 seconds; **10 unique cases** covered | `api-browser-final.log`, `api-browser-final-result.json`, `credit-only-browser.log` |
| Actual reminder/customer clipboard | **PASS**; enabled only in disposable shop/account policy; actual clipboard contains current balance | `api-customer-copy-final.log`; also included in final nine-test run |
| Existing complete local/demo browser suite | **188 discovered: 186 passed, 1 failed, 1 intentionally skipped** in 25.6 minutes; then failed case corrected and passed as described below. Effective covered result: **187 unique passing cases**, one API-only skip | `frontend-full-browser.log`, `frontend-full-browser-result.json`, `whatsapp-regression-final.log` |
| Final WhatsApp API/browser recheck | **1 passed** after restoring approved message wording; actual popup URL, clipboard/fallback and blocked popup behavior | `api-whatsapp-final.log` |
| Isolated launcher | **9 passed**, including phase-specific evidence containment and refusal of foreign processes/databases/health identities | `launcher-tests.log` |
| SQLite source/SQL tests | **7 passed**, 0 failed; not native Windows acceptance | `sqlite-final.log` |
| Frontend typecheck/lint/build | Pass; final post-correction results/timestamps recorded separately | `final-checks.json`, `frozen-frontend-checks.json`, `release-frontend-checks.json` |
| Backend typecheck/lint/managed production build | **PASS**, all exit 0 | `final-checks.json`, backend final logs |
| Persisted browser database verification | **PASS: 10 workflow groups**, read-only SQL against the current disposable fixture; verified stock/return rows, product/labor allocation, credit balances, no credit-only payout, template unlink and media reference | `browser-persisted-db-verification-current.json` |
| Saved shop DB and MediaService | Original DB not started/migrated; frozen MediaService remains unchanged | final verification/source scan records |
| Native/physical | **NOT TESTED**: Windows EXE/installer/OS clipboard, physical Android/WhatsApp/camera, USB scanner, printer and second monitor | Outside R2A; no APK/installer was built or installed |

Do not add focused/subset/rerun counts to inflate the complete-suite totals. Real bank/gateway settlement and WhatsApp sending/delivery were not tested or claimed.

## Why the complete browser run initially failed

The older `tests/phase5d-whatsapp.spec.ts` stubbed `window.open(url)` to return null and immediately inspected that first URL. R2A deliberately reserves `about:blank` during the user click, then navigates the real popup, and treats null as blocked. The old stub therefore observed `blank` instead of the final destination.

The test now opens an actual browser popup and intercepts its external request, verifying final HTTPS host/path, the **same original normalized-phone and branded-message assertions**, and the receipt link. No message leaves the test. Approved “Thank you for shopping at Taha Mobiles.” wording was restored. The affected test passes; the actual API sharing journey was rerun and passes. The original full-run failure is retained and is not relabelled a green full-run exit. A redundant 25-minute rerun of unrelated passed cases was not used to hide this history.

The one intentional skip is the API-profile password-dialog reopening case inside the local/demo configuration. Real authentication/authorization tests are in the complete backend suite; no new counter test is skipped.

## Browser journeys and persisted expectations

1. **Fast sale:** one/two/three-character and whitespace search, exact SKU/barcode, arrow/Escape/HID-style Enter; cash checkout, receipt reload and one stock deduction.
2. **Unpriced custom service:** blank remains empty and Add disabled, zero remains explicit, sub-cent precision is rejected, reviewed PKR 500 service persists without material usage.
3. **Damaged stock:** received synthetic inventory, sold one, returned it through the authorized damaged/quarantine flow; two available plus one damaged, no implicit recovery; touch-compatible 1024×768 counter and existing history/location view. This is not a physical phone or a newly invented available-to-quarantine adjustment workflow.
4. **Partial return:** sole line defaults, one of three sold units returned, identical request retry creates no duplicate, excess quantity is blocked, financial/history columns persist.
5. **Credit/collection:** real API credit sale PKR 3,600, UI partial collection PKR 1,000, ledger PKR 2,600 after reload; customer-info and current reminder text verified through the clipboard.
6. **Combined service:** first-character mention, explicit product selection, blank/entered charge distinction, PKR 2,000 product + PKR 500 labor, checkout retry with one material deduction.
7. **Sharing:** actual clipboard values for receipt link/invoice; actual browser popup with intercepted `wa.me` destination and normalized number/message; denied clipboard opens selectable fallback, blocked popup reports an error. No automatic customer contact.
8. **Unlink:** UI detach-on-save, current linkage removed, old invoice unchanged, subsequent unlinked service sale consumes no prior physical material, service remains searchable.
9. **Media regression:** actual product form uploads a PNG through the running API/filesystem; private thumbnail decodes after save/reload/edit. Full backend tests cover originals/crop/gallery/direct-upload/privacy/camera contracts too; external S3 uses the existing HTTP fixture, not a live purchased bucket.

10. **Credit-only return:** actual UI shows PKR 3,600 debt reduction and PKR 0 payout, no payout method/checkbox. Confirmation restores stock, reduces debt to zero and records zero payment rows. The suspected hidden virtual-Credit method issue did not reproduce; no speculative application patch was added.

Synthetic setup sometimes calls real repositories to create products, stock, customers or baseline sales; the specified counter interactions, checkout, returns, collection, copying, opening and unlink controls are exercised in the browser. No business HTTP responses are mocked. Only the external WhatsApp destination is intercepted to avoid contacting a service/customer. Fresh fixture/process proof, PID, provider=`api` and mock-auth=false checks precede mutations. Financial tests use disposable databases on **55459**, never preserved **55439** or the restored-copy records.

## Reproductions and test-harness corrections

- Six initial frontend/backend short-search assertions failed before the search correction; all pass with unchanged expectations.
- Explicit-null template unlink failed before validator correction. Omitted fields still preserve linkage; missing configured money is not coerced to zero.
- Initial SQL test setup incorrectly treated virtual Credit as a table row and attempted a product price above its configured list price. Fixtures were corrected to the existing virtual method and a properly priced credit product; financial expectations were retained.
- Initial browser selectors assumed native comboboxes for custom dropdowns and a desktop shell at phone width. Tests now operate the real custom menu buttons and use a touch-capable counter width; mobile auto-routing was preserved.
- The enhanced reminder check initially had global reminders disabled, then read the clipboard before asynchronous current-obligation validation completed. The fixture now opts into manual reminders and waits for the actual clipboard value. No permission guard or balance assertion was bypassed.
- A local text-write encoding failure interrupted the return-page edit. That file was restored from the protected R1 Git blob, the correction reapplied as UTF-8, and TypeScript/browser/source-byte checks were rerun. No database operation was involved. Final source scanning verifies nonempty valid UTF-8 with no NUL corruption.

## Reproduction commands

Start the supported isolated launcher using the correction report's exact command. Then:

```powershell
# Server directory; explicit disposable cluster only
$env:TAHA_TEST_POSTGRES_URL='postgresql://taha_phase5c@127.0.0.1:55459/postgres'
npm test
npm run typecheck
npm run lint
npm run build

# Project root, identity-verified fixture already running
node node_modules/@playwright/test/cli.js test --config playwright.r2a-api.config.ts
$env:TAHA_PDF_PYTHON='C:\Users\hassa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
node node_modules/@playwright/test/cli.js test --config playwright.local.config.ts
node --test scripts/test-isolated-local-acceptance.mjs
npm run test:desktop
```

The existing bundled Python supplies `pypdf`; no Python/system dependency was installed. Schema export, aggregate restored-record evidence, test traces and capability-bearing receipt URLs remain in private ignored storage. Never publish raw runtime evidence or restore real records into public staging without separate authorization.
