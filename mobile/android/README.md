# Taha Staff — Phase 5D.2 physical retest

This is a TEST package, not a production release or a claim that a physical phone passed.

- Version: **0.5D.2-test**, build **10**; package `com.tahamobiles.staff.debug`, Android8/API26 or newer.
- APK: `D:\Inventory system POS\artifacts\android\Taha-Staff-test-5D2.apk`.
- Download: [Phase5D.2 APK](http://192.168.1.3:3001/api/v1/downloads/staff-test-5d2.apk).
- Alternate: [Counter download](http://192.168.1.3:1423/staff-test-5d2.apk).
- Counter: [Localhost](http://localhost:1423/dashboard).
- Existing staff-account connection: `http://192.168.1.3:3001`.
- Passwordless companion connection: `https://192.168.1.3:3443`, configured/authenticated by scanning the PC enrollment QR.
- Chrome network control: [HTTP health](http://192.168.1.3:3001/api/v1/health).

The Ethernet IPv4 above was verified on22 October2026. It is not embedded in the APK. Port1423 serves the counter preview, not the shop API. The staff UI is bundled in the APK and opens when the server is unreachable. See the adjacent `.validation.json` and `.sha256` files for final artifact evidence.

## Physical retest — seven steps

1. Run `.\scripts\start-local-acceptance.ps1` on the PC. Open localhost1423, sign in, and open **Settings → Devices → Connect Phone**.
2. Put the phone on the same LAN; open the HTTP health link in phone Chrome and require `status: ok` / `database: connected`.
3. Install build10 over the existing TEST app without uninstalling/clearing data. Check version/build in Diagnostics.
4. On the phone select **Scan to Connect**, scan the PC QR, compare the displayed identity/fingerprint, and approve that phone on the PC. No password is entered on the phone for this flow.
5. Send a test request, then request a photo for a disposable product. Test Camera and Choose Existing Photo; verify the image reaches the intended desktop field.
6. Lock/unlock, interrupt Wi-Fi during an upload, and reopen the app. Check reconnection, retained photos/recovery, QR/Barcode modes and both themes. Revoke the phone on the PC and verify access is rejected.
7. To test authorized mobile Sales and receipt sharing, use the existing staff-account sign-in instead of the camera-only companion session. Test combined services, cash, permissions, receipts/PDF and reconnect; report failures before accepting the build.

## Authorization and offline boundaries

Passwordless enrollment creates a separate **camera companion** credential; it does not grant the owner's full business permissions. Business Sales uses existing authorized staff sign-in. QR enrollment is short-lived/single-use, requires PC approval and native proof of possession, and pins the counter TLS key. Refresh material is encrypted with AndroidKeyStore and is not returned to JavaScript. PC sign-out/session replacement and device revocation invalidate the companion session. Companion delivery uses protected HTTPS polling, not unpinned HTTP WebSockets.

The separate custom NestJS LAN service and PostgreSQL must be running. Internet is not required for that reachable local service, but real hotspot/router and native offline financial acceptance have not been demonstrated. Phone sales do not independently own desktop SQLite authority. Existing conservative offline cash/reconciliation gates remain; unsupported financial operations fail with a reason.

Pending native photos are bounded to12 images/64MiB and retained until acknowledged or explicitly discarded. Expired/cancelled request photos can be recovered from Activity; they are not silently assigned to a different request. Changing shop address retains origin-isolated photos. Return to the original connection to recover photos for that origin. Confirmed sign-out explicitly clears private local data, including pending photos. Save Copy uses Android10+ MediaStore; older devices retain the photo and explain if export is unavailable.

## Local TLS, discovery and firewall

`scripts/configure-lan-tls.ps1 -Address <current-PC-IPv4>` creates/renews a private local certificate and saves the preferred live interface. It preserves the counter key when the IP changes. The normal launcher reads this configuration. Do not install a global CA or bypass Android certificate checks; the QR supplies the pin. Renew for a new router/hotspot address when necessary.

Android NSD/mDNS lists genuine nearby counters as hints; scanning the authenticated QR establishes trust. Router isolation, multicast blocking or Windows Firewall can prevent discovery. QR/manual connection remains available. TCP3443 is needed for protected enrollment; TCP3001 supports the existing HTTP test connection. Optional discovery uses UDP5353. No firewall rule was silently applied. Inspect the narrow helper first; an administrator may explicitly apply it:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/windows-dev-firewall.ps1 -Port 3443 -Apply
powershell -ExecutionPolicy Bypass -File scripts/windows-dev-firewall.ps1 -Port 3001 -Apply
# Optional discovery only:
powershell -ExecutionPolicy Bypass -File scripts/windows-dev-firewall.ps1 -Port 5353 -Protocol UDP -Apply
```

Rules are limited to Private profile and LocalSubnet. A successful PC-to-own-LAN test does not establish phone/router/firewall acceptance.

## Build and evidence

`npm run build:apk` type-checks, builds the dedicated React staff UI into `dist-mobile`, packages it using AndroidX WebViewAssetLoader, runs Java unit tests and Android lint, verifies the debug signature, and writes the SHA256 sidecar. The approximately4MiB compressed APK is not evidence of missing UI; compare packaged assets with `dist-mobile` in the artifact validation record. Prior versioned APKs remain available.

Fresh logs: `.test-postgres/phase5d2-20261022/android-build10.log`; Java XML: `mobile/android/app/build/test-results/testDebugUnitTest/`; lint: `mobile/android/app/build/reports/lint-results-debug.xml`. Full implementation and limits: `docs/PHASE5D2_REVISED_IMPLEMENTATION.md`.

The TEST package is debug signed; production signing, cloud ingress/deployment, Windows installer and physical camera/scanner/receiver-app acceptance remain separate gates. Do not claim an installed Windows EXE from the browser preview.
