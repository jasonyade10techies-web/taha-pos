# Taha POS — local release hardening, 14 November 2026

## Scope and status

The owner paused hosting and asked for remaining local work and hosting preparation. No hosting account was accessed, no cloud resource was changed, and nothing was deployed in this phase. No DNS, paid service, saved shop database or historical recovery archive was modified.

Work is on `codex/release-readiness`, based on `8851ac9be012387a9def620aaf661de7789640b0`. **Verification is in progress. The final evidence and immutable release reference will be recorded here before completion.** Local preparation is not daily-shop production certification.

The approved desktop/mobile designs, custom NestJS backend, PostgreSQL financial engine, recovered MediaService, IndexedDB demo mode, SQLite/Tauri foundation, LAN bridge and existing private provider configuration are preserved. This phase does not implement repair-job financial settlement or install Windows system software.

## Application changes

### Browser authentication

`src/lib/api/client.ts` previously deduplicated refresh only within one document. Two browser tabs could submit the same single-use refresh cookie concurrently. A real-API regression reproduced a successful rotation followed by HTTP401 and a revoked session.

Cookie-changing operations now serialize through a Web Lock scoped to the API address. Refresh uses browser keepalive. A navigation can destroy the document while the response is still in flight, so a **nonsecret** local marker retains a random operation ID and a bounded 17-second deadline. A successor document waits for completion/deadline rather than immediately replaying the old cookie. The marker is not cleared by a departing document. Normal completed requests remove it immediately; ordinary startup has no fixed delay.

No access token, refresh token, password or PIN is stored in this marker. PostgreSQL token hashes, strict single-use rotation, replay-family revocation and session authorization are unchanged. A truly lost response or unavailable network can still require sign-in. Browsers without Web Locks retain document-level deduplication; native transports retain their existing policy. These environments require their own acceptance testing.

`scripts/test-refresh-coordination.mjs` uses the isolated real API and a loopback proxy which delays actual upstream response headers. It tests two tabs, reload after the server has committed rotation, and rejection/revocation for a genuinely replayed old token. The equivalent secure-cookie case is included in `scripts/test-r2c-clean-shop.mjs` for the compiled production-style package.

### Android photo safety

`mobile/android/app/src/main/java/com/tahamobiles/staff/PendingPhotos.java` now:

- Handles damaged metadata/missing binaries individually, retaining healthy captures and ambiguous original bytes.
- Treats capture IDs as immutable. Retrying identical bytes/request succeeds even at capacity; conflicting reuse cannot overwrite an earlier photo.
- Records new SHA256/length metadata, validates shop origin and UUID paths, and retains bounded app-private binary files.
- Uses flushed binary/metadata writes and a recovery journal to finish intact interrupted commits. It does not pretend to reconstruct damaged bytes.
- Reports damaged entries instead of silently hiding them. Legacy records without a checksum cannot gain retrospective integrity proof.

`OriginalCaptures.java`, `MainActivity.java`, `ShopBridge.java` and the restricted FileProvider path preserve external camera originals in **app-private files**, not an automatically age-deleted cache. Activity/WebView destruction cannot resurrect a file-input callback; the replacement UI therefore offers explicit copy/discard rather than assigning the image to an arbitrary/new request. Empty/cancelled originals can also be reviewed/discarded. A successfully retained processed capture acknowledges its specific original; an unrelated upload acknowledgement no longer deletes the latest camera original.

`src/features/mobile/saved-photo-recovery.tsx` shows retained camera originals and damaged-queue warnings. Copy keeps the private original. Discard requires confirmation. Gallery export decodes image bounds before exporting and requires Android10/API29+. On older supported Android versions export failure is reported and bytes remain retained. Ambiguous legacy cache photos are no longer age-deleted, but are not automatically associated with a shop/request. Confirmed logout or employee change still clears private photos under the existing warning/privacy policy.

Physical Android process-kill, permission, gallery/camera, pairing and reconnect acceptance remains required. JVM filesystem tests are not OS lifecycle or physical phone tests.

### Repeatable verification and APK delivery

- `npm test` runs `scripts/test-frontend.mjs`: it checks existing Python/pypdf and pdfinfo **before** the complete local and separate API-reconciliation profiles. It can use the existing bundled runtime and honors an explicit `TAHA_PDF_PYTHON`; it installs nothing and skips no PDF assertions.
- The default `playwright.config.ts` points to the owned isolated local fixture. Real-API profiles remain explicit; no test files or financial assertions were removed.
- `scripts/release-checks.mjs` provides `npm run verify:release` with logs and results per run. It refuses remote databases, saved shop port55439, query-string host overrides, unexpected roles/databases and the wrong actual PostgreSQL data directory. `--android` includes test-APK build/lint/JVM/signature checks.
- `scripts/test-concurrency.mjs` no longer defaults to the saved-shop cluster. It requires the explicit isolated PostgreSQL target and checks the actual server identity before creating its disposable database.
- Managed startup now emits only stage names and monotonic timings, identifying whether cold delay occurs during imports, application initialization or listening. Failure logs omit private exception text; two regression tests verify this.
- Android version is `0.5R.3-test`, build11. Existing build10 artifacts remain preserved. The development-only current APK alias serves build11; production returns404.

## Fresh verification evidence

Evidence root: `.test-postgres/release-readiness-20261114/` (private/ignored, not shipped).

| Check | Current result / boundary |
|---|---|
| Frontend complete suite | Final rerun pending. First run:188 passed, one intentional skip, one environment failure: default Python lacked pypdf. Tests/assertions preserved; preflight corrected. |
| API reconciliation | Included after the full local suite by `npm test`; final result pending. |
| Backend | Final full280/280 passed (0 failed/skipped); two newly added startup timing/privacy regressions also pass in their targeted run. |
| Frontend/backend TypeScript and lint | Passed during this phase; final checks retained in the evidence root. |
| Backend production compilation | Passed; current compiled entry and migration tools exist. |
| Real browser auth | Three cases passed twice after the fix; no replay grace. Secure production-package rehearsal is pending. |
| Android |35 JVM tests, debug assembly, Android lint and v2 signature verification passed. No physical phone pass. |
| SQLite |7/7 schema/transaction/outbox/reopen tests passed using a fresh temporary database; no Tauri hardware acceptance. |
| SQL security/inventory/finance |20 +14 +25 checks passed with isolated PGlite fixtures. |
| PostgreSQL concurrency |2/2 passed with distinct real server connections on port55459, one final-unit sale and idempotent retry. |
| Release-runner isolation |4/4 guards passed. Default browser selection is190 tests in34 files. |
| Frontend credential boundary | Passed: privileged client credentials rejected before bundling without printing their values. |
| Runtime dependency advisories | Fresh `npm audit --omit=dev --json`:frontend0, backend0 reported. This is not a claim of zero application-security risk. No dependency upgrades were required. |
| Production-style package | Current candidate generated and scanned; complete26-case rehearsal is running. Final immutable clean-commit package pending. |
| Tauri |CLI configuration/schema/icons validated. `tauri info` confirms missing MSVC/Windows SDK. No native build/installer pass. |

Initial failures were retained rather than hidden. The standalone concurrency command initially attempted its legacy default port55439 and received connection-refused before any DDL; it did not start or modify the saved server. The implicit default was then removed, isolation guards added, and the real concurrency cases rerun successfully on55459. Auth red runs exposed both cross-tab replay and interrupted-navigation races before the final fixes. Intermediate TypeScript inference and PDF-runtime failures were corrected without disabling checks.

## Artifacts and localhost

APK: `artifacts/android/Taha-Staff-test-R3-build11.apk` —4,188,896 bytes, SHA256 `df6acbc4d5a58d85763e15533bafd44cc025c6952d13f32948f38e03df0b21e5`.

Sibling `.sha256` / `.validation.json` record CRC, version/build,58 exact bundled-asset matches and explicit `physicalAcceptance:false`. The HTTP download was byte/hash-compared against this artifact:

`http://127.0.0.1:1423/api/v1/downloads/staff-test.apk`

The running local acceptance frontend is `http://127.0.0.1:1423/dashboard`; real API health is `http://127.0.0.1:3306/api/v1/health`. Both are **loopback-only isolated test services**, using a generated synthetic PostgreSQL database on55459. They are not the saved shop database or a publicly/phone-reachable deployment. The normal development launcher remains available. An authorized LAN test must use its verified backend address, not the Vite UI port.

The APK is not part of the managed web-server ZIP. Deployment packaging excludes real environment files, credentials, private keys, databases, media, recovery archives and local logs.

## Data and source protection

Recovered `server/src/media/media.service.ts` is unchanged: Windows working-copy SHA256 `b5db3723b534c0e00371a0f0d15a8289b20a12d58e0bcdb61622dc8d2b6c0d3f`. Existing private recovery directories and provider/keyring configuration were preserved. Only disposable test databases/files were used for mutation and outage tests. No public Git push or new repository was created.

## Remaining gates and next bounded work

1. Finish exact-source package rehearsal and final local regression baseline; record commit/artifact/evidence below.
2. Physically retest build11: native camera/gallery, interrupted Activity/process, retained-copy/discard, offline upload retry, QR/barcode, pairing, lock/resume and cloud/LAN transitions. Production signing remains separate.
3. Windows: install separately authorized Visual Studio Build Tools with MSVC x64/x86 and Windows SDK, then compile/accept Tauri EXE/installer, native secure sessions, SQLite cash/outbox/reconnect/conflict behavior and customer display. Rust/Cargo/WebView2 already exist; nothing was installed in this phase.
4. Controlled repair accounting: job parts usage, deposits, settlement, refunds/reversals and ledger/profit integration. Do not treat job status changes as financial posting. Smart combined POS services are a separate tested transaction workflow. Expense-adjusted net profit remains separate from current gross profit.
5. Real printer/HID scanner/second monitor; historical missing-image restoration from genuine backups; production signing, recovery/monitoring and off-machine restore acceptance.
6. Hosting/public browser/provider acceptance stays paused. The local ZIP prepares the existing React/NestJS/PostgreSQL/private-storage architecture; it is not a deployed shop or a production certification. Resume account/deployment actions only when the owner requests them.

See `TAHA_POS_REMAINING_WORK_CHECKLIST.md`, `mobile/android/README.md`, existing R2C reports and `TAHA_POS_HOSTINGER_STAGING_RUNBOOK.md` for historical architecture and subsequent operational gates. Earlier hosting instructions do not override the owner's current pause.
