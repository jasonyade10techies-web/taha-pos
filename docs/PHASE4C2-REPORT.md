# TAHA POS — Phase 4C.2 implementation report

**READY FOR PHYSICAL RETEST.** The user physically confirmed Phase 4C.1 loading and connection. This report describes the new 4C.2 implementation and local verification; no Android handset was attached to ADB, so physical camera/scanner/Wi-Fi success is not claimed.

The approved Dashboard, New Sale layout, custom-service/customer row and red/yellow/gold identity remain intact. Local IndexedDB demo mode and computer uploads continue working. No hosting was started.

## QR SCANNER

- Global gold **SCAN** action in Home / Requests / SCAN / Alerts / More navigation. Android opens the native QR scanner directly.
- One closed parser handles Taha pairing, camera-request and receipt-reference types. Pairing has an explicit confirmation; an authorized camera QR opens its assigned request. Unknown QR codes show a clear message and never open arbitrary sites.
- Camera permission denial offers **Open Settings**. The selected shop still passes the central URL/security validator. Raw capability tokens are removed from the route after claim.
- Six-digit pairing codes are hashed, single-use, expiring and rate limited per active profile/store. Previous codes remain compatible.

## MOBILE HEADER

- Normal connected UI shows **TAHA MOBILES · Main Branch · Connected**, without a prominent IP.
- Address, parsed host/port, latency and errors remain under **Settings → Shop Connection / Diagnostics**. Addresses can change without rebuilding the APK.
- Connected Devices provides reconnect, change-counter QR and disconnect actions. Requests and Alerts have distinct active navigation states.

## CAMERA UX

- **Open Camera** invokes Android's camera immediately. **Choose Existing Photo** opens the selected-photo picker.
- Accepting the OS photo automatically compresses and uploads it. There is no extra Taha **Use Photo** or **Send** step.
- A single successful request closes after about 1.1 seconds. Product/device/repair galleries support up to eight captures within one request; each image appears at the counter immediately, with **Take Another / Done** on the phone.
- Cancellation and expiry stop further captures and return to the queue. Request queues group new, in-progress and recently completed work.
- One reusable mechanism covers product, payment proof, profile, customer, used device, repair, damage and document photos. Profile phone captures save/update the avatar automatically. Required payment proof continues gating checkout confirmation.

## FAILED TO FETCH

**Reproduced cause:** the old upload path called `fetch(data:image/...)` to convert a local image. The exact APK CSP does not allow `data:` connections. Chromium reproduced the CSP rejection and **Failed to fetch** before the authenticated multipart request began. Health checks could pass while this local conversion failed.

**Fix:** local `atob` / `Uint8Array` / `Blob` conversion replaces that fetch. The CSP was not weakened. Multipart uses the centralized native HTTP bridge with the browser-generated FormData boundary, active authentication and the selected shop API.

Native transport accepts only the configured shop's API, refuses redirects, keeps HttpOnly cookies natively and retains access tokens in memory. FileProvider/picker content URIs are delivered as selected files with narrow read grants until conversion completes. No public upload endpoint was introduced.

A real LAN diagnostic authenticated and uploaded multipart against **192.168.1.8:3001**, using Android's `http://localhost` Origin, then retrieved the private thumbnail and deleted the test image. This PC control verifies the API/network path; physical Android URI/permission behavior still requires the retest below.

## DESKTOP

- **Take Photo with Phone** immediately selects the only online paired phone. Multiple phones use a small one-click selector; offline choices are disabled. The preferred phone is remembered per counter/user.
- Compact waiting/receiving/success states stay within the image field. **Use Another Phone** opens a secure QR fallback.
- Authorized completion inserts into the exact initiating field/gallery without refresh or acceptance. Capture IDs prevent duplicate insertion.
- A shared scoped WebSocket watcher and short active-request polling recover missed events. A handed-off request disappears from the old phone even when its cancellation notification was missed. Foreground/network recovery rechecks the queue without accumulating sockets.

## BACKEND

- Atomic endpoint: `POST /api/v1/stores/:storeId/camera/jobs/:id/captures`, multipart `file` plus UUID `captureId`.
- Server validates active staff, branch, exact assigned device/session, request status/expiry/capacity, request permissions and the immutable target entity/slot. Phone-supplied targets cannot retarget a capture.
- Transaction locking combines media/capture records and request state. An identical committed retry returns the existing result; a reused ID with different bytes/job is rejected.
- Existing private FileStorage abstraction remains. Sharp handles rotation, strips metadata, compresses bounded images and creates private 360px thumbnails. Product/device/repair images use 1800px; profile 640px; proof/document 2400px with higher text detail. Images are binary files; realtime messages contain metadata only.
- Diagnostic requests use the same capture path, then verify the thumbnail and permit deletion only of the current session's test image.
- Applied versioned migrations:
  - `server/migrations/202610060108_instant_camera_bridge.sql`
  - `server/migrations/202610060109_camera_diagnostic_audit.sql`
- Existing business RLS remains. Camera capture data stays private to the authenticated API, with PUBLIC/anon/authenticated access revoked. Tests use a non-superuser runtime without RLS bypass.

See [camera API documentation](../server/docs/CAMERA-BRIDGE.md) for endpoint and storage details.

## RETRY

- Compressed retry photos use binary app-private temporary files: eight files maximum, 8MB/file, 32MB total and 30-minute retention, bound to the selected shop.
- **Try Again** sends the same capture ID. Success, cancellation, logout and shop changes clean the relevant files. Camera originals are released after compression.
- No photos, passwords or tokens are persisted in ordinary localStorage. This is a narrow camera retry mechanism; system-wide offline sync and background push remain separate work.

## TEST APK

- Version **0.4C.2-test**, build **3**; Android 8/API26+, debug-signed package `com.tahamobiles.staff.debug`.
- Exact path: `D:\Inventory system POS\artifacts\android\Taha-Staff-test-4C2.apk`.
- LAN download: **http://192.168.1.8:3001/api/v1/downloads/staff-test-4c2.apk**.
- API listens on **0.0.0.0:3001**; current Ethernet IPv4 is **192.168.1.8**. Counter is **http://192.168.1.8:1423**. Shop Address uses port3001, not Vite1423.
- Health: **http://192.168.1.8:3001/api/v1/health** returns connected. No Windows Firewall rules were changed.
- APK size/SHA256 and build/restart commands are in [the Android guide](../mobile/android/README.md). The downloaded APK was compared with the generated artifact. Old 4C1 remains separate.

## TESTING

| Area | Result |
| --- | --- |
| Frontend production build, TypeScript, lint | Passed |
| Backend build and lint | Passed |
| Backend automated tests | 45 passed, 0 failed |
| Bundled mobile camera/scanner tests | 9 passed: exact APK CSP/native multipart, gallery selection, retry, multi-photo, QR, permissions, cancellation, expiry and missed handoff |
| Connection tests | 12 passed: normalization, persistence, login/logout, timeout, recovery, route refresh and visible error fallbacks |
| Local UI regression checks | 9 passed, including approved POS, custom service, customer selection and customer display |
| API browser workflows | 16 distinct workflows passed across baseline and targeted reruns; depleted isolated stock fixtures were replenished through audited movements before affected POS reruns |
| Android unit tests | 13 passed, 0 failed |
| Android assembly, lint, signature | Passed; lint has 0 errors / 13 nonblocking warnings; APK v2 signature verified |
| LAN multipart / thumbnail / cleanup | Passed against the real LAN API with Android Origin |
| Responsive browser checks | Phone widths360/390/600/767; existing POS/display/profile viewport regressions retained |
| Physical Android 4C.2 | Pending user retest; no attached handset |

The frontend reports a nonblocking large-chunk warning. Android lint includes localization/deprecated API warnings. Native camera/scanner, system picker URI behavior, phone sleep/resume and Wi-Fi interruption need physical verification. Browser scanning needs a secure camera context; the APK uses native scanning on the local HTTP test network. Production HTTPS/signing/hosting and background notifications remain future work.

## MANUAL PHYSICAL RETEST — eight steps

1. On the same router, open **http://192.168.1.8:3001/api/v1/health** in phone Chrome; expect `ok` / `connected`.
2. Download/install the APK above over the test app and check **0.4C.2-test**, build **3** in Diagnostics.
3. Connect to **http://192.168.1.8:3001**; use the existing isolated test account `owner@taha.test` / `Secure test password 2026!` if sign-in is required.
4. On the counter open **Settings → Devices → Pair Staff Phone**. On the phone press gold **SCAN**, grant Camera, scan the Android App QR and tap **Pair**.
5. In **Add/Edit Product**, press **Take Photo with Phone**. On the phone press **Open Camera** and accept the system photo. Verify automatic gallery insertion; use **Take Another / Done** for multiple images.
6. Repeat with **Choose Existing Photo**, digital checkout **Payment Proof** and a **Profile Photo**. Verify each correct field updates without refresh or extra Use/Send actions.
7. Test **Use Another Phone** QR, counter cancellation, phone lock/unlock and brief Wi-Fi loss during upload; **Try Again** must produce one image.
8. Run **Settings → Diagnostics → Test Photo Upload**; check receipt/size/duration/thumbnail and **Delete Test Image**. Share sanitized diagnostics for any failure.

Next: physical 4C.2 acceptance on the staff phone, followed by Phase 4C.3 production HTTPS/session/storage hardening and signed release preparation. Hosting begins only after the physical counter-camera flow is accepted.
