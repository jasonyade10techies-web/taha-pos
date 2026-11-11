# Native and offline audit evidence — 11 November 2026

Scope: read-only source/artifact/toolchain audit, isolated SQLite tests, and existing Android JVM unit tests. No application implementation, deployment, installation, owner database access, data reset, native launch, printer operation, or phone installation was performed. Audit output is under `.test-postgres/audit-20261111/`. Gradle regenerated local test/build intermediates; delivered APKs were not rebuilt or replaced.

## Fresh results

| Check performed on 11 November | Result | Evidence |
| --- | --- | --- |
| `node --test scripts/test-desktop-sqlite.mjs scripts/test-cash-evidence.mjs` | **16 passed, 0 failed** | `native-sqlite-tests.log` |
| Existing Android `testDebugUnitTest`, offline/no daemon, rerun tasks/no build cache | **24 passed, 0 failed/errors/skips; 6 suites; 21 tasks executed**, Gradle successful | `android-unit-tests.log`, `android-unit-results.json`; fresh XML under `mobile/android/app/build/test-results/testDebugUnitTest/` |
| Existing build-10 APK signature verification | APK Signature Scheme v2 verifies; one **Android Debug** RSA-2048 certificate | `android-signature.log` |
| Existing build-10 APK manifest metadata | `com.tahamobiles.staff.debug`, version `0.5D.2-test`, code **10**, minSdk **26**, target/compile **35** | `android-apk-metadata.log` |
| Existing APK SHA-256 and sidecar | Match; **3,993,094 bytes**; `e96269314c5bcefe88cc35d8570eaa62634c4e8f52fa9fb714eeae7e0d6e354f` | `android-asset-hashes.json`; `artifacts/android/Taha-Staff-test-5D2.apk.sha256` |
| APK `assets/` compared individually with existing `dist-mobile` | **57 of 57 files match byte-for-byte**, no missing/mismatched files; `dist-mobile` also has 57 files | `android-asset-hashes.json` |
| Windows Rust/Cargo and installed target | Rust **1.99.0**, Cargo **1.99.0**, active stable `x86_64-pc-windows-msvc`; meets manifest Rust >=1.90 | Fresh `scripts/windows-prerequisites.ps1` output; summary below |
| Windows native toolchain/artifact inventory | Standard `vswhere` and Windows SDK Lib locations absent; `cl.exe`/`rc.exe` unavailable; **no EXE/MSI/MSIX under `src-tauri/target`** | `windows-toolchain-artifacts.json` |
| Synthetic Android pending-photo corruption fixture using unchanged `PendingPhotos`/`OriginPolicy` source | Baseline returns 3 photos; corrupt first metadata record, then returns **0**, while **2 valid records remain** | `android-photo-corruption.json`, audit-only `PendingPhotoCorruptionAudit.java` |

APK signer certificate SHA-256: `fe4bd258ec8f80aa5aeb2fcc608e7fe42c2dd0af3931767ca8bfd84af3618a38`. This identifies the existing test signing certificate, not production signing.

Exact Android test invocation used existing repository tools and cached dependencies:

```text
.tools/android/gradle-8.11.1/bin/gradle.bat --offline --no-daemon -p mobile/android testDebugUnitTest --rerun-tasks --no-build-cache
```

Its process environment selected the existing `.tools/android/jdk/jdk-17.0.20.1+1`, `.tools/android/sdk`, and `.tools/android/gradle-cache`. No SDK, JDK, Gradle, Rust, MSVC, or other system software was installed/downloaded. Android lint was not freshly rerun; the prior validation record reports 0 errors/16 warnings.

## Native Windows readiness

`src-tauri/Cargo.toml` declares Tauri 2, bundled rusqlite, Rust >=1.90 and DPAPI dependencies. `src-tauri/tauri.conf.json` points release frontend loading at bundled `dist`, configures splash/main windows and NSIS/MSI targets, and has no updater/release signing configuration. `src-tauri/build.rs` requires a selected public HTTPS `TAHA_API_URL` for release builds. An installer configuration is not an installer.

The standard paths checked were `C:/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe` and `C:/Program Files (x86)/Windows Kits/10/Lib`. Both are absent. The `link.exe` present on PATH is `C:/Users/hassa/AppData/Local/hermes/git/usr/bin/link.exe`, a Git Unix utility, not evidence of the MSVC linker. No native build was attempted. No output exists at the documented expected `src-tauri/target/release/taha-pos.exe` or NSIS/MSI bundle paths.

Consequently Windows compilation/linking, a real native startup, WebView2 interaction, installed AppData lifecycle, DPAPI round trips, customer-display window behavior, native cash retry/reconciliation, and printer output remain **unverified**. The source includes an eight-second splash recovery watchdog (`src-tauri/src/lib.rs`); that is source evidence only.

## Offline financial and credential boundaries

- `src-tauri/migrations/001_desktop.sql` enables WAL, FULL synchronous writes and foreign keys. `src-tauri/src/desktop.rs` opens an AppData `counter.sqlite3`, applies both migrations and returns `SYNCING` operations to `PENDING` at startup. The audit did not open this real database.
- `src-tauri/src/outbox.rs:25` queues a UUID-backed `TM-INV-O-...` invoice, local receipt, reservations, immutable cash evidence, and draft deletion in one SQLite transaction. It checks saved grant expiry/current access, original seller, cash arithmetic, cached stock and minimum price. Original grants are retained separately in per-operation DPAPI files. The fresh tests cover schema/reopen/rollback/idempotency/retry and actual cash SQL; they do **not** execute the Rust IPC path or simulate PC power failure.
- `src-tauri/migrations/002_cash_evidence.sql` retains immutable original cash/receipt evidence and append-only history. Fresh `scripts/test-cash-evidence.mjs` checks shop/account scope, owner projection, preservation across reopen and server acknowledgment, reservation release/refund and closing distinctions.
- `src/components/layout/desktop-sync.tsx` posts cash capture before sale, retains operation identity, backs off transient failures, and sends 4xx conflicts to owner review. `src-tauri/src/cash.rs` plus `src/lib/desktop/reconciliation.ts` handle server-authorized POSTED/REFUNDED outcomes. An active owner or manager with `sync.reconcile_cash` can review cash from the same shop; ordinary staff remain scoped. This supersedes the older blanket statement in `docs/PHASE5A_WINDOWS.md` that cross-employee owner replay is unavailable.
- `src-tauri/src/vault.rs` uses Windows-user-bound DPAPI with UI forbidden and temporary-file replacement. `src-tauri/src/http.rs` restricts requests to configured cloud/LAN origins, disables redirects and filters caller headers; refresh cookies are kept in the native vault. Actual vault files were not read. Access tokens still exist in application memory as required for authenticated requests; DPAPI does not encrypt the SQLite business cache itself.
- `src/lib/desktop/sales.ts` applies cached Cash method, permission/reason, price and tax rules before invoking Rust. Offline native checkout remains limited to catalogue cash; full mobile/service/credit/electronic/manager-override behavior is not established by the SQLite tests.
- The separate NestJS/PostgreSQL LAN service is not bundled into the Windows app. Internet-free LAN access still depends on that service and reachability. Backend current-source build failures are covered by the main audit and prevent calling the overall stack reproducible today.

## Printing and customer display

`src/lib/receipt-printer.ts` creates an isolated white-paper DOM, measures an 80mm receipt page, and calls `window.print()`. `WindowsPrinter` currently inherits this WebView/browser implementation. `EscPosPrinter` only defines an injected transport wrapper; it is not evidence of a configured printer transport, driver, silent printing or cash-drawer integration. Existing `artifacts/print/` PDF/PNG samples are historical rendering evidence. Physical 80mm/A4 output and native print dialog behavior were not tested.

`src-tauri/src/desktop.rs:332` opens the dedicated `customer-display` window. Its commands require the main counter window; outgoing state is recursively filtered by `public_display` (`:375`). `src-tauri/capabilities/display.json` limits the display to event/fullscreen capabilities. Native monitor placement, geometry restoration, disconnect/reconnect behavior and real customer-facing privacy remain acceptance work; browser views cannot prove them.

## Android source and artifact status

The latest versioned artifact is **`artifacts/android/Taha-Staff-test-5D2.apk`**, last modified 22 October 2026. Its adjacent validation JSON is historical (22 October), explicitly says `physicalPhoneVerified: false`, and labels it READY FOR PHYSICAL RETEST. Fresh hashing/signature/assets checks corroborate that artifact's identity, not physical acceptance or a new November build.

- `mobile/android/app/build.gradle.kts` bundles `dist-mobile`. `MainActivity.java:67` creates a restricted WebViewAssetLoader local UI; remote backend URLs are connections rather than frontend navigation destinations. Main-frame remote navigation is rejected; WebView SSL errors are cancelled. No reachable shop is required to display bundled UI.
- Release cleartext traffic is denied. The debug overlay `mobile/android/app/src/debug/res/xml/network_security_config.xml` permits test HTTP; `OriginPolicy.java` restricts configured debug HTTP to private IPv4 and rejects phone localhost, userinfo, query/fragment and non-origin paths. This is a TEST artifact, not a production-hardened release.
- `ScannerActivity.java`, `NativeBarcodeView.java`, `ScannerPolicy.java` implement format filters, mode/crop changes, torch/error handling and pause/resume. Six existing JVM suites test scanner policy/decoding, origins, identity, pin matching and photo persistence. They do not exercise Camera HAL, permission dialogs, real barcode focus, AndroidKeyStore, WebView or device lifecycle.
- `CompanionSecurity.java` implements per-installation proof keys and AndroidKeyStore AES-GCM encrypted refresh material; the native bridge removes enrollment refresh material before returning successful enrollment responses to JS. QR enrollment is HTTPS, pinned to the scanned key, PC approved and camera-companion scoped. Sales use ordinary authorized staff login. Trust/revocation/keystore behavior still needs actual device acceptance; the fresh pin unit test is a pure-Java cryptographic comparison, not a native TLS test.
- `ShopBridge.java` constrains requests to the selected API origin, disables redirects, isolates cookies on origin changes and clears private photos/session on confirmed sign-out. `CounterDiscovery.java` supplies bounded NSD hints; QR approval establishes trust. Router/hotspot/multicast/Windows Firewall were not tested.
- `src/lib/mobile/read-cache.ts` has optional shop/user-scoped, eight-hour read caching, cleared on logout/shop change. Cached permissions do not create authenticated API authority. `src/lib/mobile/sales-service.ts` persists scoped drafts and prepared idempotent input but explicitly requires online completion; **no independent mobile financial outbox or phone-to-desktop SQLite cash authority is implemented**.
- Native retained photos are UUID-addressed app-private binaries, bounded to 12 photos/64MiB with an 8MiB per-photo maximum (`PendingPhotos.java`). Origin changes retain old-origin photos; acknowledgment/discard/sign-out can remove them. Expired jobs appear in `src/features/mobile/saved-photo-recovery.tsx`; Save Copy depends on Android 10+ MediaStore. Receipt sharing uses FileProvider and user-selected receiver apps. These flows need real-device/receiver-app testing.

## Concrete risks and remaining gates

| Priority | Finding | Evidence and consequence |
| --- | --- | --- |
| Blocker | Windows native product has no compiled/delivered artifact and missing C++/SDK evidence | Paths/toolchain inventory above. Rust alone cannot substantiate a buildable Windows handoff. Build, run and installer acceptance are a separate stage after authorized prerequisites/configuration work. |
| Blocker | Android is debug signed and physical acceptance is still open | Build-10 signature plus historical validation. Production signing/release configuration and actual phone installation/camera/scanner/share/lock/reconnect/revocation are not accepted. |
| Blocker for an offline-phone-sales promise | Phone does not own the desktop financial queue | `src/lib/mobile/sales-service.ts:64` requires online completion; `mobile/android/README.md` and revised implementation report explicitly retain this limit. Do not present internet-free mobile cash via desktop SQLite as delivered. |
| Data-recovery risk, freshly reproduced with synthetic files | One damaged pending-photo record hides other valid pending photos from the returned queue | `mobile/android/app/src/main/java/com/tahamobiles/staff/PendingPhotos.java:16` wraps the entire read loop in one catch. Audit fixture: 3 visible before, 0 after first metadata corruption, 2 valid retained afterward. This demonstrates hidden recoverable data, not physical data deletion. |
| Durability risk, source inspection | Pending-photo binary and JSON metadata writes are separate and unstaged | `PendingPhotos.java:14` writes `.photo` then `.json` without atomic replacement/fsync. An interrupted write can leave a partial/orphan record and interact with the read-loop failure above. No power-cut test was performed. |
| Lifecycle risk, source inspection | Camera result before queue retention has no process-recreation recovery | `MainActivity.java:37-39,44-49,95-105`: callback/file/URI are memory fields, state is not restored, result exits if callback is null, and old capture cache files are deleted after one hour. A process death while the external camera owns the foreground can leave the result outside retained-photo recovery. Not reproduced on hardware. |
| Physical gate | Thermal/A4 printer, native customer display and real offline cash reconciliation | No installed Windows run, printer/second monitor, router/hotspot or phone power/upload interruption was performed. Fresh source/JVM/SQLite checks cannot certify these. |
| Operational risk | Retained media history is not automatically pruned | `src-tauri/src/images.rs` caps unsynced images, while synced files remain. Desktop disk-use/recovery policy still needs operational acceptance. |

The audit found useful automated evidence for isolated SQL correctness and the existing Android source/artifact. It does not establish an installed Windows release, an accepted physical Android workflow, or a reproducible production deployment.
