# TAHA POS — Phase 4C-1: READY FOR PHYSICAL RETEST

## ROOT CAUSE

Before changes, the exact old LAN URL returned HTTP200 with `isSecureContext=false`, `typeof crypto.randomUUID='undefined'`, the JavaScript error **crypto.randomUUID is not a function**, and an empty body. UI/cart stores called this secure-context-only API during module import, before React's inner error boundary mounted. [API reference](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID).

The old APK remotely navigated to `Shop Address + /mobile-camera`, inheriting this HTTP/Vite startup failure. Its small header deliberately displayed only `Uri.getHost()`; normalization did not remove dots/port from the real URL. There are no phone logs to characterize the reported visual label more precisely or exclude another router/firewall issue. The same LAN browser now renders login with zero page errors. The APK also received the architectural correction below.

## ARCHITECTURE

UI/fonts/assets are packaged in the APK and intercepted by WebViewAssetLoader at `http://localhost`; no PC/localhost server is needed to render them. Shop Address selects only the backend. Hash routing, no service worker and branded bootstrap/React/native fallbacks prevent blank startup. ShopConnectionStore resolves staff requests dynamically; native HTTP keeps HttpOnly cookies outside JavaScript and restricts requests to the selected origin. Existing approved UI/business flows are preserved.

## NETWORK

- Active Ethernet: **192.168.1.8/24**; inspected Wi-Fi/VPN adapters were disconnected.
- API bind **0.0.0.0**, test API port **3001**.
- Shop API **http://192.168.1.8:3001**.
- Health **http://192.168.1.8:3001/api/v1/health**; public status/database/version/timestamp only.
- Counter Vite **0.0.0.0:1423**; this is not the APK Shop Address.
- Firewall inspection denied without administrator access; no rule added. `scripts/windows-dev-firewall.ps1 -Port 3001 -Apply` creates only a Private/LocalSubnet TCP rule when run as Administrator.
- Same-PC LAN checks do not prove phone traversal. Phone Chrome health is the independent control.

## ANDROID

INTERNET/ACCESS_NETWORK_STATE verified. Separate debug/release network-security XML; configured test HTTP limited to private IPv4 by native URL policy, release HTTPS required. Loopback is intercepted bundled UI. Explicit mobile origin `http://localhost` is allowed by REST/auth/WebSocket; no credentialed wildcard. Native refresh-cookie transport avoids private-LAN cross-site browser-cookie restrictions. Signed media reads retain active authorization and permit embedding in the bundled client.

## ERROR HANDLING

Eight-second health timeout; Connecting/Connected/Invalid Address/Network Blocked/Shop Not Reachable/Server Error/Authentication Required/Timeout. Retry, Change Address and Diagnostics. Diagnostics includes version/build, configured/tested address, parsed host/port, health/latency/auth/network, last success and sanitized errors. Copy excludes secrets. Fatal React/import/native startup paths are branded and recoverable. TEST WebView inspection enabled, release disabled.

## PAIRING

Manual URL changes need no new APK. Counter settings shows backend address, terminal, expiring pair code and Browser/Android App QR. New app links carry shop/terminal/code; a different origin requires confirmation/testing. Manual code entry remains. System QR scanner opens the app; no incompatible camera subsystem added.

## CAMERA

Payment/profile/product/device/repair/customer/damage/document queues retained. HTML capture controls use the native camera/picker. Pause/resume/network events drive health/session/queue and socket recovery, with cleanup and one Activity. Proofs/tokens are not persisted in ordinary localStorage. Foreground behavior is implemented; physical camera/lifecycle acceptance and native background push are not claimed.

## TEST APK

- **0.4C.1-test**, versionCode **2**, `com.tahamobiles.staff.debug`, debug-signed.
- **D:\Inventory system POS\artifacts\android\Taha-Staff-test-4C1.apk**.
- Original: `D:\Inventory system POS\mobile\android\app\build\outputs\apk\debug\app-debug.apk`.
- Download: **http://192.168.1.8:3001/api/v1/downloads/staff-test-4c1.apk**.
- Alternate: **http://192.168.1.8:1423/staff-test-4c1.apk**.
- SHA256 alongside APK; version1 artifact retained separately.
- Final APK: **3,482,785 bytes**. SHA256: `46c85729512ac52b8e8d711482d9a7ca950f0d0f4a8cd30b0c455e2e5821cb59`.
- Delivered HTTP200 download has the same size/hash. Packaged `assets/index.html` matches `dist-mobile/index.html`; bundled JavaScript/CSS/fonts are present. Android badging confirms versionCode2, version name and permissions. The v2 signature verifies and certificate matches the previous APK, permitting an in-place update.

## AUTOMATED TESTS

Strict frontend TypeScript, normal/mobile production build and frontend/backend lint passed. **12/12** production-bundle connection/error tests, **9/9** counter/mobile regressions, **14/14** real API browser workflows, **43/43** backend/PostgreSQL tests and **9/9** Android URL/security tests passed. Final Android assembly/signature passed; Android lint reported **0 errors, 10 warnings** (test cleartext/localization/dependencies). Archive inspection and download hash comparison checked the actual delivered APK.

Final logs: `.4c1-build-address.log`, `.4c1-lint-address.log`, `.4c1-tests-address.log`, `.4c1-counter-regression.log`, `.4c1-api-regression.log`, `.4c1-apk-final-address.log`; backend logs under `server/.4c1-backend-*-final.log` and `server/.4c1-backend-final.log`.

Connection tests use simulated native transport to exercise local UI and responses. Backend tests separately verify mobile-origin authentication/native-cookie rotation, health, transactions, financial isolation and camera/media/display permissions. They do not prove the Android OS cookie store, physical camera or router. The broad root82 suite was not rerun; focused/API regressions were. Frontend >500kB chunk warning remains.

## MANUAL TEST FOR THE OWNER

Follow the ten-step [Android guide](../mobile/android/README.md): phone Chrome health first, install version2, Test Connection/Connect, login, pair, send photo, then sleep/network/server restart. If Chrome fails, investigate LAN/firewall; if Chrome passes but app fails, copy Diagnostics. No Hostinger deployment is needed.

## Remaining limits

No phone/ADB device attached here; **READY FOR PHYSICAL RETEST** only. Windows Rust/MSVC build still unavailable, no new Windows EXE. No hosting. Business actions require API access; full offline sync and native background push remain future work.
