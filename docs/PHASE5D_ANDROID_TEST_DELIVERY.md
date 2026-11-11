# Phase 5D — Android test delivery

17 October 2026. This follows the owner's explicit APK request after the Phase5D browser acceptance report; its earlier “no new APK” statement describes the prior delivery.

## Artifact

- `artifacts/android/Taha-Staff-test-5D0.apk`
- Version **0.5D.0-test**, versionCode **7**, package `com.tahamobiles.staff.debug`.
- 3,515,787 bytes; SHA256 `a2a5af82907f0d1d8038dc3a0551a88d9af0d12494a9104451e549d47de8eaad`.
- Valid APKv2 debug signature. Certificate SHA256 `fe4bd258ec8f80aa5aeb2fcc608e7fe42c2dd0af3931767ca8bfd84af3618a38`, matching Phase4E build6. In-place update supported; signing material unchanged.
- All47 packaged frontend files match the current dist-mobile byte for byte. Dedicated staff entry is local, with no remote frontend script. Test password is absent from the packaged JavaScript.

## Live URLs

- PC counter: http://localhost:1423/dashboard
- Phone Shop Address: http://192.168.1.5:3001
- Health: http://192.168.1.5:3001/api/v1/health
- APK: http://192.168.1.5:3001/api/v1/downloads/staff-test-5d0.apk
- Backup APK: http://192.168.1.5:1423/staff-test-5d0.apk

Both versioned download bodies and the API staff-test.apk alias returned200, Android package MIME and the artifact's exact SHA256 from the PC. The production API denies the test-download handler. This does not prove ingress from the physical phone.

## Changes

Existing current mobile/shared source is now actually packaged, including the empty mobile chart correction and Phase5D shared UI refinements. Native camera/scanner behavior was preserved. Android/JS versions and the build script were advanced to build7. Development API/Vite downloads include an unambiguous5D0 filename; older versioned artifacts remain. Generic current download aliases now serve5D0. No business-data reset, Hostinger deployment or Windows installer work.

The saved local development server uses the current Ethernet origin for QR/media, durable development media and existing accounts. No password was added to the UI/APK. Login uses owner@taha.test and the existing development password.

## Verification

| Check | Result |
|---|---|
| Frontend TypeScript / mobile Vite bundle |Passed through build-android.ps1; bundle10.85s |
| Android Gradle |assembleDebug, testDebugUnitTest and lintDebug successful;2m38s |
| Native tests |23 passed: DeviceIdentity 3, OriginPolicy 9, PendingPhotoPolicy 4, ScannerDecode 3, ScannerPolicy 4 |
| Android lint |0 errors;13 existing warnings |
| Signature / upgrade |v2 valid; same certificate as4E0; package unchanged; code7 greater than6 |
| Packaged assets |47/47 match current frontend |
| Bundled browser smoke |Connection screen, real API health/login, Home/Activity/Devices/Profile, no document overflow, logout;0 JS exceptions |
| Smoke boundary |Browser replacement for Android native HTTP, real saved development backend; no physical camera/scanner test |
| Backend build/lint |Passed after development-download handler addition |
| Download hashes |API versioned, Vite versioned and API current alias all match |
| Production download guard |404 verified |
| Physical phone |READY FOR PHYSICAL RETEST; awaiting owner |

Evidence: `.test-postgres/phase5d-apk-20261017/build.log`, `apk-inspection.json`, `bundle-smoke.json`, `download-verification.json`, `production-download-guard.log` and adjacent validation JSON. The initial browser smoke used the wrong Profile heading (the screen correctly shows the employee's name); that fixture expectation was corrected. No application change was needed for that failed assertion.

The current non-admin process could not inspect effective Windows firewall port rules. No firewall rule was changed. If phone Chrome cannot reach health, the exact scoped Administrator helper is documented in mobile/android/README.md; it allows only Private-profile TCP3001 from LocalSubnet. Historical missing-image records remain a separate data-recovery issue, not an APK restoration feature.

## Owner retest

Use the seven steps in mobile/android/README.md. Start with phone Chrome health, install as an update, change the saved Shop Address if needed, sign in, then PC Settings → Devices → Pair Staff Phone. Prove the test request before testing product/payment-proof/profile capture.

Do not proceed to the next phase until the owner confirms the physical result.
