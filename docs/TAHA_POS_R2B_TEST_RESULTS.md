# R2B fresh test results and evidence

Evidence dates: 11–13 November 2026, Asia/Karachi. **Final corrected release and full backend acceptance PASSED.** Private raw evidence: `.test-postgres/r2b-20261111/`. No production database or physical device is used.

## Completed baseline and frontend gates

| Run | Actual result | Evidence |
|---|---|---|
| Complete unchanged frontend baseline, 12 Nov 14:16–14:45 | **187 passed / 1 intentional skip / 0 failed**, exit 0, 28.1 minutes | `frontend-full-baseline-20261112.log`, matching result JSON |
| Complete frontend after synchronization changes, 12 Nov 20:53:10–21:20:15 | **187 passed / 1 intentional skip / 0 failed**, exit 0, 27.0 minutes | `frontend-full-final.log`, `frontend-full-final-result.json` |
| Intentional skip | API-profile password-dialog case in local-prototype mode; retained, not removed | `tests/phase5d-search-controls.spec.ts:158` |
| Backend unchanged baseline, 11 Nov | **224 passed / 0 failed / 0 skipped** | `backend-baseline.log`, matching result JSON |
| Full backend before the final active-connection fix, 12 Nov 21:19:44–21:25:08 | **261 passed / 0 failed / 0 skipped**, exit 0 | `backend-full-verified.log`, `backend-full-verified-result.json` |
| Active PostgreSQL connection-loss/readiness regression after fix | **10 passed / 0 failed / 0 skipped**, exit 0 | `active-connection-outage.log`, matching result JSON |
| Frontend typecheck | Pass | `frontend-typecheck-final.log`, `frontend-checks-final.json` |
| Post-fix backend typecheck and frontend/backend lint | All pass, exit 0 | `outage-checks.json`, associated logs |
| SQLite source/SQL and isolated-launcher checks | **16 passed / 0 failed** (7 SQLite + 9 launcher); no native EXE claim | `sqlite-launcher-final.log`, `other-tests-final.json` |
| Frontend credential boundary | Pass | `client-boundary-final.log` |
| Runtime dependency audits | Frontend **0**, backend **0** known advisories; no forced upgrades | `security-audits-final.json`, both runtime audit JSON files |

The 11 Nov interrupted frontend run and 12 Nov interrupted post-fix backend run are **not** passing runs. They are retained separately, never combined with targeted reruns. A targeted pass is not substituted for the required full suite.

## R2B automated coverage

- `server/test/r2b-polling.test.ts`: 11 state-machine cases for deduplication, bootstrap/paging, cursor acknowledgment, no unchanged SQLite writes, reconnect/backoff, epoch/lifecycle cancellation, 401/403 and visibility.
- `server/test/r2b-revisions.test.ts`: real Nest/auth/restricted runtime plus durable repair/shift mutations, notification failure, permissions/branch scoping, filtered cursor advancement, bootstrap/reset, no read/heartbeat revisions, rollback, concurrent commit ordering, financial-only changes and installed table-trigger coverage.
- `server/test/r2b-readiness.test.ts`: real restricted database, complete registry, missing/changed migration, missing SQL function, unsafe role/grant, cached/sanitized storage failure, dead connection and active checked-out connection termination; local bytes and missing-object checks.
- `server/test/r2b-hosting.test.ts`: nested SPA refresh and API/asset/dotfile/method exclusions, trusted/untrusted TLS offload, unsafe config/target rejection and real HTTP S3-compatible CRUD/privacy/corruption/denial/outage fixtures.
- Existing full backend suite retains authentication/refresh/revocation, authorization and private costs/media, checkout/idempotency/concurrency, smart materials/returns, inventory/damage/out-for-test, credit/refunds/reversals, migration/seed, cash reconciliation and protected camera/device cases. No assertions were disabled to obtain a pass.

## Production-style local package acceptance

`scripts/test-r2b-package.mjs` uses the actual compiled release and migration/seed tools, clean installed production dependencies, independent desktop/mobile Chromium contexts, real PostgreSQL, real private files and a temporary loopback HTTPS proxy/certificate. Its test application uses `NODE_ENV=production`, `TAHA_RUNTIME=local` deliberately: this is **not** live cloud TLS/S3 or Linux installation acceptance. No Vite, HTTP business mocks, real customer data or gateway charge is used.

The final corrected package must pass all of these checks before local acceptance:

1. Separate compiled migration/seed; immutable seed rerun.
2. Production entry and platform-assigned listener.
3. Real authentication and full deep readiness.
4. Independent desktop/mobile login, secure cookie, nested refresh and missing API/assets denial.
5. Mobile catalog mutation visible from another authorized session without reload.
6. Cash invoice/stock and identical retry.
7. One-line linked-material product/labor accounting and one deduction.
8. Damaged return affects quarantine, not sellable stock.
9. Credit sale plus collection persists PKR 2,600.
10. Real image upload/private denial/decoded thumbnail/reload.
11. Repair/shift mutations arrive on another browser without reload.
12. Disconnected client catches up after reconnect.
13. Process restart preserves sessions, committed data and image bytes.
14. Real isolated database outage leaves liveness available, readiness unavailable, then recovers.
15. Unwritable disposable storage reports degraded readiness and recovers without losing originals.
16. No uncaught browser runtime errors.

Earlier rehearsals are retained: corrected locators reflect mobile Home/table cells; premature document reload was replaced by waiting for actual authenticated/rendered state; the disconnect harness now pauses networking/lifecycle before mutation instead of racing an in-flight response. These are test-harness corrections, not removed assertions. The substantive defect found was the unhandled active PostgreSQL client error, fixed and separately regression-tested in `6bea29a...`. The earlier `5348840...` ZIP remains superseded.

## Final corrected-run record

| Final gate | Fresh result / evidence |
|---|---|
| Complete backend after the outage fix | **262 passed, 0 failed, 0 skipped**, exit 0; **13 Nov 13:31:04–13:36:52 PKT**, 343.7 seconds. `backend-full-20261113.log` and `backend-full-20261113-result.json`. |
| Corrected package production-style rehearsal | **16/16 passed**, exit 0; **13 Nov 13:35:23–13:36:28 PKT**. `package-acceptance-20261113-rerun.log` and result JSON; complete fixture record `taha_r2b_package_1794558926804/results.json`. |
| Package provenance | `0.5.0-r2b.1`, clean implementation commit `6bea29a59a767802635ae0213154c8345c5381c1`; rebuilt 13 Nov and verified using the actual copied release plus isolated clean production dependencies, with module resolution checked. |
| ZIP inspection | **342 entries = 341 hashed payload files + manifest**; CRC and every size/SHA256 pass, no forbidden runtime/private files or exact known private environment value matches. `release-zip-inspection-20261113.json`. |
| ZIP | `artifacts/managed/Taha-POS-staging-R2B-0.5.0-r2b.1-20261113T082433.zip`, **1,899,447 bytes**; SHA256 `907072908d842f14c8ef754df77eb83052b1440d779d62db23d5e1513be1e7eb`. |
| Real localhost | `localhost-verified-20261113.json`: frontend `http://127.0.0.1:1423/dashboard`, API `http://127.0.0.1:3306/api/v1`, actual login, API proxy, authorized deep readiness `ready`, **68 expected/applied/matched**. |
| Source integrity / private baseline | `git fsck --full` pass; 799 tracked text files no NUL/encoding findings; MediaService protected hash unchanged; source ZIP/Git bundle byte-matched across private C/D recovery paths and independently cloned/fsck verified. |

The first 13 Nov clean-runtime rehearsal timed out before its listener appeared. A separate actual-entry startup reproduction then passed; the full unchanged release was rerun successfully through all 16 checks. No cause for that isolated cold-start timeout was established, and it is not silently counted as a pass. Application process restart/outage/storage failure requests intentionally generated failures; required liveness/readiness/reconnect behavior and persisted state were asserted. Initial anonymous refresh 401s are expected before login. Some in-flight requests can return the generic safe 500 during abrupt connection loss; liveness stays available and readiness correctly becomes 503. No failed financial request is automatically retried as a new transaction.

The corrected full backend run before the interruption (`backend-full-outage-fixed.log`) has incomplete/NUL-padded output and no completion record. It is excluded. The explicit final 13 Nov full run above is complete and green. No passing result was inferred from an interrupted process.


## Not verified

Hostinger entitlement/actual Linux startup/proxy, external PostgreSQL TLS and provider role/pool behavior, live bucket signed POST/CORS/durability/backup, public domain/certificate, real Android or Windows native operation, thermal printing, HID hardware, second monitor, camera process death and physical LAN/internet-loss behavior are **not passed** by these tests. Native apps and production deployment remain separate gates.
