# Taha Staff Android release system — R3A

## Scope and boundaries

The owner will host manually. This phase does not configure Hostinger, DNS, a public domain or a hosting credential. The private source repository is `jasonyade10techies-web/taha-pos` (the owner explicitly changed the initial account choice on November 14). Source history is retained; APKs, signing keys, databases, local media and recovery archives remain outside source commits.

Two independent products are prepared:

1. **Downloads:** `distribution/server.mjs`, a small Node22+ service with no PostgreSQL, authentication or business-storage dependency. Generated ZIPs contain the runtime and approved APKs. A missing release produces a useful unavailable page.
2. **POS:** the existing React/NestJS application, PostgreSQL financial engine and private business storage. `npm run build:hostinger` builds same-origin API/UI; `npm run start:hostinger` starts the existing API. No Vite process or startup migration is used.

## Versions and signing

`mobile/android/release.properties` is the version source for Gradle and bundled mobile UI. R3A introduces versionName `0.5R.3a`, test suffix `-test`, versionCode12. Test package: `com.tahamobiles.staff.debug`. Stable package: `com.tahamobiles.staff`.

The existing test certificate SHA256 is public identity metadata:
`fe4bd258ec8f80aa5aeb2fcc608e7fe42c2dd0af3931767ca8bfd84af3618a38`.

It matches builds10/11. This development identity supports current TEST installations; it is not a controlled production signing identity. Stable publication is intentionally not enabled. Never uninstall the app to update, or silently change signing identity. Build11 has no in-app updater: installing R3A over build11 is a one-time manual step. Actual Android installer/data retention must still be tested on a physical phone.

## Public download contract

- Page: `/downloads/taha-staff`.
- Manifest: `/downloads/taha-staff/releases/test.json`; analogous `stable.json` when a stable release is approved.
- Convenient download: `/downloads/taha-staff/latest.apk?channel=test`.
- Versioned APK: `/downloads/taha-staff/apks/test/<versionCode>/<filename>.apk`.

These are paths, not a claim that a public domain exists. The owner adds the selected HTTPS origin after manual deployment. The installation QR opens the download page; pairing and receipt QRs remain separate.

`distribution/manifest.mjs` validates schema, package/channel, version, API/Android minimums, size, SHA256, certificate, release notes and a strict same-origin APK path. Manifests/pages are no-store; verified versioned APKs are immutable. Requests are anonymous and never forward shop cookies. The public optional `/status?channel=test` endpoint returns200 with available:false when no channel is published; it does not invent a release. Only public software metadata permits credential-free cross-origin reads. Shop APIs retain their authenticated CORS policy. Development builds query automatically only when an explicit valid HTTPS `VITE_ANDROID_DOWNLOAD_ORIGIN` is configured; hosted builds default to same origin. For a separate download website, set matching `VITE_ANDROID_DOWNLOAD_ORIGIN` at frontend build time and `ANDROID_DOWNLOAD_ORIGIN` at backend runtime so CSP permits that explicit public origin. Only GET/HEAD are served; no upload/admin endpoint exists. Unrecognized paths, traversal, symlinks escaping the release root and unavailable/corrupt bytes fail closed.

## Local release generation

1. Commit verified source, increment the committed version and build the bundled APK with `npm run build:apk`.
2. Run `npm run release:android -- --apk <verified-apk> --output artifacts/android-release --channel test --notes docs/r3a/ANDROID_RELEASE_NOTES.txt`.
3. Optionally pass `--previous-manifest <json> --previous-apk <apk>` to include a verified known-good previous version.

The generator checks the actual APK through Android `aapt` and `apksigner`, verifies identity/signature continuity and exact bytes, writes APK/history before changing current metadata, and refuses immutable collisions. Generated ZIP entries are explicitly allowlisted; real environment files or unexpected files abort packaging. ZIP contents are read back and hashed.

Output includes `release.json`, canonical APK, `sha256.txt`, `artifact-manifest.json` and `Taha-Staff-downloads-test-<code>.zip`. A development-only `--allow-dirty-dev` option is explicit and must not be used for a published release. Production artifacts should be built from a clean commit. Rebuilding an exported APK requires preserving the previous candidate; the PowerShell build refuses to overwrite its versioned export.

## Native updater

`AppUpdater.java` centralizes HTTPS checks, app-private downloads, verification and Android installer handoff; `UpdatePolicy.java` holds testable policy. `ShopBridge.java` exposes a small native bridge. The UI is `src/features/mobile/app-updates-page.tsx`.

- Settings → App Updates; update route remains accessible without shop connectivity.
- Explicit HTTPS download origin is persisted natively. Otherwise the selected HTTPS shop origin is used. A local HTTP shop can continue operating while a separate HTTPS downloads origin is configured.
- One automatic check per six-hour browser-session window; explicit checks remain available. Updates never replace or navigate away from the bundled UI.
- Bounded metadata (32KiB), APK (64MiB), requests, same-origin redirects and transfer time. No WebView credentials are copied into update requests.
- Verify exact size/hash, actual package/version and the **installed** signing certificate set. Verify again immediately before installer handoff. A manifest alone cannot authorize a different signer.
- No downgrade or silent installation. Android unknown-source permission is requested only following Install. After permission grant, press Install again. Cancellation/failure remain visible.
- The UI defers installation during checkout/an active cart; native code blocks an open camera, photo picker or scanner. Update files live separately from photo queues/session storage. No logout, queue clearing, pairing reset or business migration is performed by the updater.
- Verified download metadata survives ordinary Activity recreation. Physical process-death/installer behavior remains a separate acceptance gate.

`required` is release metadata, not permission to bypass Android or erase data. Current API contract is v1; future incompatible server changes need explicit compatibility/upgrade handling and regression, rather than assuming an old APK will work.

## GitHub automation

`.github/workflows/ci.yml` runs PR/branch regression and a validation-only Android build. Validation APKs use ephemeral runner signing and are never published. Signing/release runs only through `.github/workflows/android-release.yml`, explicit approval input, verified private repository and main/staging branch, increasing committed version and passing regression.

The protected `android-test-release` environment should hold:

- `ANDROID_TEST_KEYSTORE_B64`
- `ANDROID_TEST_STORE_PASSWORD`
- `ANDROID_TEST_KEY_ALIAS`
- `ANDROID_TEST_KEY_PASSWORD`

Do not paste values into chat or source files. Configure environment/branch restrictions before authorizing CI signing. If the GitHub account cannot enforce private-repository protections, that limitation must be reported; a workflow file alone is not enforcement. No new production signing key is generated here.

The workflow retains the previous verified repository APK where available, builds/tests/lints/signs, generates a complete site ZIP, uploads a **private draft** release, downloads every uploaded asset to verify size/hash, then publishes a private test prerelease. Failed verification leaves the draft unpublished. Hostinger publication is an owner action. No private GitHub token is embedded in the download app. The initial build11 recovery copy remains local; subsequent packages retain the immediate previous approved channel version. Keep older whole-site packages for rollback; archive older immutable files before replacing a hosting directory if their direct URLs must remain available.

## Rollback and physical acceptance

Keep the last verified site ZIP, manifests, APK and private signing backup. Roll back the website as a complete verified package; do not change APK bytes at an existing versioned path. Installed apps will not be downgraded: publish a corrective higher version if needed.

On a physical Android phone verify: install over build11, retained login/pairing/photos, check/download/cancel, unknown-source approval, installer cancellation/retry, lock/resume, process recreation, active-camera/cart deferral, offline update-site behavior and successful newer same-certificate installation. Automated JVM/browser tests do not prove those OS behaviors.
