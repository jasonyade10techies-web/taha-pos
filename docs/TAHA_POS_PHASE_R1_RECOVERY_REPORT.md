# TAHA POS — Phase R1 recovery and acceptance report

Date: **11 November 2026, Asia/Karachi**. Existing project: `D:\Inventory system POS`. This phase implements the owner's emergency recovery request. No UI redesign, cloud deployment, purchase, DNS change, owner-database reset or production import was performed.

## 1. Recovery outcome

**MediaService was reconstructed, not recovered as an intact latest file.** The original was 33,538 NUL bytes, SHA256 `5B7ED60BE63DDB4BC05B5D90E86A62CC0E066093526D90A958B9AD6A902EBF3C`. A byte-identical forensic copy plus original metadata were secured before overwrite. Its corruption cause remains unknown.

Latest intact candidate was `artifacts/managed/taha-api-0.5.0/src/media/media.service.ts` from 8 October, 22,176 bytes, SHA256 `88C51B5F067A0F3FEF075FF4FA9D4980FEC991367F0B0DF7CBF51DC15A76F89A`. Its ZIP/source/compiled representations matched. It was used as a baseline, **not copied blindly as the final implementation**.

Surviving 29 October sources provided later behavior: `.test-postgres/phase6a-20261029/media-grant-methods.tmp`, `refactor-media.py`, `fix-media.py`, `fix-media-drafts.py`, controller/storage contracts, private upload-grant schema and media/enrollment/integration tests. Targeted editor history/backups and nearby snapshots yielded no intact newer service. Compiled source maps had no embedded source; audit build had regenerated the broken compiled media file. Exact search/provenance is in `r1-media-recovery-evidence.md`.

Reconstruction preserves multipart product/customer/profile/proof/device/repair/damage/document/payment-QR upload, real image processing, original/thumbnail storage, crop derivatives, gallery list/order/primary/detach, protected signed reads, avatar, deletion/reference protection, camera capture/diagnostic flows and upload/capture retries.

Reconstructed later behavior includes private S3 direct grants/completion/cancellation, exact actual-byte/MIME/hash checks, expiry, actor/store/request binding, per-profile outstanding quota serialization, row-locked concurrent completion, unbound draft media and same-transaction persistence. Nested transaction/context/audit work was moved outside held transactions where needed, preserving pool-1 operation. Companion direct/general upload remains denied; camera media reads reauthenticate, check request scope and require actual TLS.

Frozen reconstructed source: **34,082 bytes**, SHA256 `B5DB3723B534C0E00371A0F0D15A8289B20A12D58E0BCDB61622DC8D2B6C0D3F`. Existing red tests and compiler diagnostics were retained before replacement; three focused recovery assertions add actual-byte bound, companion cleartext denial and general-upload scope coverage. No endpoint stub, compiler suppression, feature removal or relaxed assertion was used.

## 2. Backend status

- Backend TypeScript validation: **passes**.
- Backend lint: **passes**.
- Managed production build: **passes** (`dist/main.js` and compiled tools).
- Complete real Nest application initializes and listens on isolated loopback 3306.
- Direct health and frontend-proxied health both return HTTP 200, `application:taha-pos`, `status:ok`, `database:connected`.
- Full current backend suite: **203 passed, 0 failed, 0 skipped**,340.96 seconds,13:48:20–13:54:02PKT. Tests explicitly use disposable databases on 55459, never saved 55439.

The tests instantiate the actual Nest application, authenticate, execute HTTP/SQL operations and assert stored state. These results are stronger than the prior SQL-only audit. They are still **local isolated acceptance**, not hosted or physical production certification.

## 3. Fresh tests and actual scope

Evidence root: `.test-postgres/r1-20261111/`. Do not add overlapping counts into an inflated total.

| Gate | Result / evidence |
|---|---|
| Pre-recovery checks | NUL/TS1127 and failing scope import captured in media-recovery red logs. |
| Focused media/camera/enrollment/API |35 passed, 0 failed, 82.9s; `media-recovery-focused.log`. Included again in full suite. |
| Media scope/recovery checks |4 passed, 0 failed; existing companion scope plus3 new assertions. Included in full suite. |
| **Complete backend `npm test`** |**203 passed, 0 failed, 0 skipped**; `backend-full-regression.log`, `backend-full-result.json`. |
| Isolated launcher |8 passed; `isolated-launcher-tests.log`. Rejects occupied ports/foreign DB/process/session, verifies health/proxy before readiness and stops only owned failed-start children. |
| Real API/browser journeys |**3 passed**, 1.2 minutes; final fresh-fixture rerun `api-browser-current.log` (14:39:45–14:40:57 PKT). Actual forms/navigation plus real repository operations, no HTTP business mocks. |
| Persisted database verification |All assertions passed; `browser-persisted-db-verification-current.json`, read-only query of exact disposable fixture IDs. |
| Frontend/backend targeted dependency checks |Typecheck/lint/build and existing 9 product-hardening tests pass in dependency work; fresh runtime audits 0 findings. Final broader gates recorded in logs. |
| SQLite source/SQL evidence tests | **7 passed, 0 failed**; `sqlite-acceptance.log`. This is not native Rust/Windows acceptance. |
| Full existing local browser regression | **188 discovered: 186 passed, 1 failed, 1 skipped** in 27.4 minutes; `frontend-full-browser.log`. Failure was the default Python missing `pypdf`, after the preceding PDF assertions passed. The unchanged case passed using existing bundled Python: `frontend-print-rerun.log`, **1 passed** in 19.8 seconds. Across those runs **187 unique tests pass**; one API-only password-dialog case is intentionally skipped in local/demo mode. No assertion was disabled. |

Full backend coverage includes ordinary/manual electronic/split/credit/coupon/tax sale logic; compound material/labor/floor/approval/idempotency; actual stock/receiving/transfers/adjustments/conditions/test-out; classified sellable/damaged restoration/recovery/write-off; collections/credit/reversals/reminders/immutable history; auth rotation/logout/revoke/cost permissions; private product/gallery/crop/original/thumbnail/camera/direct-upload operations; quota/completion races; offline cash capture/recovery/lost acknowledgment/refund/posting and frozen shifts. Separate-connections tests exercise concurrent material stock consumption and duplicate requests. See actual named cases in the full log; no automatic payment gateway or physical bank settlement is claimed.

Cloud-storage contract tests use the existing independent HTTP S3 fixture. They verify real application HTTP/database behavior and provider contracts, **not acceptance against a purchased live object-storage provider**. Local product uploads/retrieval were exercised through the running application and real filesystem storage.

Final typecheck/lint gates pass for both frontend and backend; timestamps and exit codes are in `final-checks.json`. The fresh SQLite source/SQL tests pass **7/7**. These do not establish a native Rust/Windows test result. Existing frontend and backend production builds pass; a full-suite rerun was unnecessary after correcting only the PDF test's interpreter environment.

To run the unchanged PDF case in this environment, set `TAHA_PDF_PYTHON` to `C:\Users\hassa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`, then run `node node_modules/@playwright/test/cli.js test --config playwright.local.config.ts tests/phase4e.spec.ts --grep "physical print matrix"`. Despite the historical test name, this is browser-generated PDF inspection, **not physical printer acceptance**. No Python package or system software was installed.

Browser journeys used the intended launcher's new explicit isolated mode. Product form used actual image upload/save/reload; receiving/return and credit collection used real repository calls while navigating the relevant application screens; checkout and receipt were exercised in UI. This is not a claim that every receiving/refund field was manually clicked or physically printed.

Persisted assertions:

- Product received 5, sold 1, sellable return 1: movement quantity **5**, one tested sale and one return.
- Product image remained attached and decoded after reload; one active metadata row for the tested product.
- Credit 3600, collection 1000: ledger **2600**, two linked entries.
- Combined service 2500: product revenue **2000**, labor **500**, one customer line, retry same saleID, material stock 6→5 and exactly one `REPAIR_USE`.

Early browser attempts failed on test setup/selectors: old `Product name`/`Upload product photos` labels, missing required canonical brand selection, ambiguous customer headings, repository invocation before auth restoration, and duplicate material names across retained fixture reruns. These logs/traces remain. Corrected tests use current accessible labels, real brand selection, heading level, rendered readiness and unique explicit material identity; no product assertion was removed. TypeScript caught missing test shape fields; normalized ShopConfiguration and explicit payment reference fixed the test without unsafe `any` or suppressed checking.

## 4. Data safety and backup

Private recovery folder: **`D:\Taha-Private-Recovery\R1-20261111-1336`**, ACL restricted to current Windows user and SYSTEM. Contains:

| Artifact | Verified state |
|---|---|
| `media.service.ts.corrupt` + forensic manifest |33,538 original bytes, exact hash above; original size/creation/write/access metadata retained. |
| `source-config-artifacts-before-R1.zip` |2,876 files, 123,531,123 source bytes; every archive entry SHA256 verified. Archive 96,923,026 bytes; hash `a87e99fbf5ceff9fa9197add1b828cbd77672b995f98f70272348d9fc2bae2ef`. Includes source/config/media/reports/migrations/delivered important artifacts and selected recovery evidence, excluding regenerable tools/caches. Private credentials remain only inside private backups, not published/Git. |
| `saved-development-postgres-offline-before-R1.zip` |Stopped cluster `.test-postgres/data`: 60,378 files, 1,329,358,054 source bytes, every archive entry verified. Archive 197,545,888 bytes; hash `4058fe838c836fea2d430d7b7fb41632251068f7ea294287aa29f4e211d82067`. |

Both archives/manifests/forensic files have hash-verified copies on the **other physical disk**, at `C:\Users\hassa\.taha-private-recovery\R1-20261111`. These are local recovery copies, not offsite backups. A clean external/offsite recovery plan and actual restore rehearsal remain production gates. No unique original was deleted.

The saved development PostgreSQL on 55439 remained stopped: no query, migration, reset, seed or account change against it. Only existing isolated PostgreSQL17.11on 55459was started; financial tests create their own disposable databases. The owner-test fixture created a separate new database, retained for testing. Its name/process proof is in `local-acceptance/processes.json`.

Corruption scan: 524 relevant source/configuration files; only the known MediaService contained NUL bytes. Initial free space was about 4.31 GiB on C and 253.12 GiB on D. Both current disks/NTFS reported Healthy/OK. Historical disk 51 warnings refer to `Harddisk2`, whereas current C/D map to disks 1/0; this does not prove the warnings caused this corruption. No destructive disk repair or storage cleanup was performed. C free space is low and changed with build/browser/pagefile activity; use the roomy D drive for build/test artifacts.

Final measured free space at 14:46 PKT was approximately **0.97 GiB on C** and **252.70 GiB on D**. Resolve C capacity before installing native toolchains or running large builds. R1 does not attribute the corruption to this observation or authorize deletion of private recovery assets.

## 5. Localhost

Run from the existing project:

```powershell
node scripts/start-local-acceptance.mjs --isolated
```

Verified isolated frontend: **`http://127.0.0.1:1423/dashboard`** (also loopback localhost).

Verified API: **`http://127.0.0.1:3306/api/v1/health`**.

Verified frontend proxy: **`http://127.0.0.1:1423/api/v1/health`**.

Mode is real API/real authentication; browser assertions verify `dataProvider=api` and `mockAuthEnabled=false`. The launcher pins isolated cluster directory/role/port, refuses foreign/occupied 1423 or 3306, requires unique runID/PID/disposable DB proof and checks actual connected Taha health before announcing ready. Existing default saved-development launcher behavior is preserved; **omit `--isolated` only when intentionally using saved development data**.

Services are detached/hidden and kept available for owner localhost testing. This isolated mode binds 127.0.0.1, so it is **not a physical-phone LAN hosting claim**. No APK was rebuilt and no phone/firewall/network configuration was changed. Fixture login values are test-only and intentionally separate from saved owner credentials/production provisioning. The fixture now generates a fresh random signing secret rather than retaining a development constant that matched the private saved environment.

On a second launch, occupied ports are refused rather than silently replacing the current test environment. Inspect the recorded owned process IDs before deliberately stopping/restarting an isolated fixture. The launcher never initializes/resets missing PostgreSQL clusters.

## 6. Source control and recoverability

A new **local-only Git repository** is initialized on branch `recovered-r1`. It has **no remote** and will not be published/pushed. The recovered-baseline commit follows final verification/secret scanning; its exact ID and bundle verification are recorded in `.test-postgres/r1-20261111/git-baseline.json` and the final owner response. This record remains outside Git so the snapshot does not need to contain its own commit hash.

`docs/SOURCE_PROVENANCE.md` states that prior history was unavailable and this is a new snapshot, not recovered historical commits. `.gitignore` excludes env secrets, DB/dumps/WAL, uploaded media, signing keys, tools/caches/builds/installers/APKs, generated logs/screenshots and platform deployment metadata. Blank/public examples and intentional test fixtures remain source.

Staged inspection compares content with actual private development credential values and private-key/provider-secret patterns. It caught a pre-existing fixture signing constant matching private dev config; the fixture now generates random signing material. The final scan reports **zero findings**, with the deliberately nonfunctional credential-rejection sentinel reviewed separately. This scan is not a guarantee against every possible secret. Raw scan results are private evidence. A post-recovery Git bundle/snapshot is retained privately after commit as an additional source recovery point. Pre-existing formatting warnings are retained rather than rewriting unrelated source or historical Markdown.

## 7. Hostinger discovery and compatible architecture

**Verified selected plan:** browser hPanel displays **Unlimited**, expiry **20 October 2027**. Owner explicitly confirmed this is the Taha target. It is managed Web hosting; Cloud Startup is displayed as an upgrade, and no VPS was established. Two WordPress sites are visible on that browser surface; neither is an approved Taha domain.

The newly available Hostinger connector returned a different inventory: one active `hostinger_business_v3` order with 7 different sites, 3 detected as Node. This does **not** match the browser inventory. Do not assume its account/app availability is the selected Unlimited plan. Resolve connector account alignment before using it for Taha changes. Only read-only list operations were performed.

Published Business/Unlimited Node limits: 5 Node apps, 120 processes, 60 entry processes and 120-second request ceiling; no incoming WebSockets, custom extra services or independent always-running workers. Current-v6resource docs list 2 CPU, 3 GB RAM, 50 GB storage; account-specific version/resource details were not opened successfully, so those are **published defaults, not verified allocation**. Supported Node includes 22/24, matching existing server `>=22<25`. Official sources: [Node limits](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/), [plan resources/version caveat](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/), [Nest/Vite deployment](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

**Recommended next staging architecture:** one eligible Hostinger managed Node application serves the existing Vite build and `/api/v1` on one HTTPS origin; external managed PostgreSQL retains existing RLS/role/functions/locks; private object storage retains originals/thumbnails/proofs; authenticated durable revision/device polling replaces cloud socket dependence. Local Windows/Android UI remains bundled; the separate LAN bridge and desktop SQLite authority remain distinct.

Serving the existing frontend from Nest with ordered API/static/SPA fallback is a future bounded deployment adaptation, **not added during R1**. Vercel rewrites are not a Hostinger configuration. Same-domain refresh/cookies/receipt/asset behavior must be accepted on real HTTPS. Managed PostgreSQL must support current migrations/role grants/pgcrypto/verified TLS/pool semantics; private storage must actually support the exact SigV4 formPOSTpolicy/CORS and private lifecycle. No such resources were provisioned or connected here.

HTTPS/domain/env/ZIP or Git build are supported in relevant managed plans; exact purchased resource entitlement, Taha domain, external database/storage connectivity and backup/restore still require verification. No MySQL migration, DNS/SSL change, deployment or purchase occurred. If the selected plan proves unsuitable, independently hosted API/PG is a fallback; VPS is only a deliberate owner choice.

## 8. Security changes

Targeted compatible patches only:

| Package | Before → after |
|---|---|
| DOMPurify | 3.4.16 → 3.4.17 |
| `@nestjs/platform-express` | 11.2.7 → 11.2.9; core/common remain 11.2.7 |
| body-parser | 2.3.0 → 2.4.0 |
| multer | 2.4.0 → 2.5.0 |
| qs | 6.16.0 → 6.17.1 |
| sanitize-html | 2.18.0 → 2.18.1 |
| deepmerge | 4.3.1 removed through patched sanitizer dependency|

Fresh frontend/backend `npm audit --omit=dev` both exit 0 with**zero known runtime package findings** at the check time. This is not a penetration-test or “no vulnerabilities anywhere” claim. No major-force upgrade was used. Exact advisory IDs, primary references, versions and call-path analysis are in `r1-dependency-evidence.md` and `dependencies/` evidence.

An actual bounded malformed-iframe input reproduced the prior sanitizer stack overflow at function level and passed after patch. No deployed exploit was performed. DOMPurify usage did not enable several advisory-specific modes; Multer had no custom async fileFilter; those findings were patched without claiming proven exploitability. Existing authentication/private-media/permission controls were preserved and tested.

## 9. Remaining product defects

R1 deliberately does not redesign UI or complete the unimplemented 5D.3 scope. Updated `TAHA_POS_REMAINING_WORK_CHECKLIST.md` classifies all 15 requested corrections. Confirmed remaining defects: short-prefix/dictionary search; desktop blank-charge presentation; POS damaged count; sole return-item default; refund/credit explanation; clipboard fallback; service unlink; cloud repairs/shifts revisions; comprehensive cloud readiness; Android corrupt-photo recovery; lost historical media.

Actual WhatsApp receiver behavior, Android process recreation, Windows build/offline/DPAPI/printer/customer-display and physical scanner/camera acceptance remain unverified/hardware-dependent. Repair deposits/parts settlement are not complete and remain required before using that flow for real money. Mobile checkout still requires onlineAPI; desktop SQLite does not make offline phone sales implemented. Full expenses remain a closing amount rather than a complete expense ledger.

R1 proves backend/local regression recovery, **not daily-shop or production readiness**. No Windows installer, new Android APK, hosted TahaURL, externalPG/bucket or physical acceptance was manufactured.

## 10. Smallest next phase

**R2: counter workflow correctness and staging readiness**, bounded into two independently reviewable slices:

1. Exact search/blank-charge/POS-condition/return-default/refund-preview/clipboard-opener/template-unlink corrections, with real API/browser regression and no layout redesign. Financial preview must reflect the actual ledger/payout; do not classify money errors as cosmetic.
2. Permission-scoped repair/shift revision coverage and complete schema/private-object readiness, plus same-origin managed-host packaging. In parallel align the selected Hostinger account, approved Taha domain and external PostgreSQL/private-storage decisions. Deployment is a later explicitly authorized isolated staging step.

Android queue/process-death durability and Windows toolchain/native acceptance can be separate parallel tracks after the source baseline. Launch waits for actual restore/hardware/offline/pilot acceptance.

## Final gate record

- Backend: **203 passed, 0 failed, 0 skipped**; complete real Nest application and persisted database assertions.
- Existing browser suite: **186 passed / 1 environment failure / 1 intentionally skipped**; the original failure then **passed unchanged** with bundled Python. Combined accepted coverage: **187 unique passing cases**, one API-only skip.
- Additional R1 real-API browser journeys: **3 passed** on the fresh isolated fixture; persisted assertions pass afterward.
- Isolated launcher: **8 passed**. SQLite source/SQL tests: **7 passed**.
- Frontend/backend typecheck, lint and production builds pass. Frontend/backend runtime dependency audits: **0 known findings**.
- Saved shop database remains stopped; all mutations were restricted to disposable test databases.
- Source baseline, bundle recovery check, final health and listening-port evidence: `.test-postgres/r1-20261111/git-baseline.json` and `final-local-verification.json`.
- No cloud deployment, physical phone/printer test, Windows installer or updated APK is claimed.
