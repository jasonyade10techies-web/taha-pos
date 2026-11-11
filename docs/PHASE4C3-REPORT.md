# Phase 4C.3 — real staff device bridge

Status: **READY FOR PHYSICAL RETEST**. Implemented and validated locally; no physical handset success is claimed.

## Root cause and architecture

The existing pairing and camera transport selected a browser-only local implementation whenever the business repository provider was local. That prevented a signed-in physical Android phone from joining the desktop counter. Pairing also used session/tab identity without durable device registration, and the scanner used a barcode target for QR pairing.

Business repositories and the Device Bridge now have independent configuration and authentication. Local IndexedDB/demo products can use the real custom backend through `VITE_API_BASE_URL`. Mock owner identity never authorizes server operations: the demo desktop requests a real shop sign-in once. Existing API business sessions reuse their authenticated transport. Employee-facing mode instructions were removed. Approved Dashboard, POS structure, custom-service/customer row and branding were preserved.

## Terminal, pairing and presence

- Persistent counter UUID/name and private native Android device UUID survive reload/restart. Backend registration binds each identity to its authorized shop/profile and renewed session.
- Desktop Settings → Devices provides pairing, test request, rename, disconnect and scoped Reset Pairing. Pairing modal contains a black/white 280px QR, six-digit code, expiry and refresh control.
- Mobile confirms the counter before pairing. QR/manual codes are hashed, single-use, store scoped, rate limited and expire after ten minutes; no password or authentication token is encoded.
- Authenticated scoped WebSockets plus foreground heartbeats maintain online/offline presence. Heartbeats run every ten seconds; offline detection may take approximately 75 seconds.
- Reset affects this counter's pairings and unfinished camera requests only. Accounts, products and the database remain intact.

## Scanner and camera

- Native QR scanner defaults to a large square with gold corners, dark preview, flashlight, back control and automatic decoding/vibration. Barcode mode has a separate horizontal target. Unknown QR does not open arbitrary sites.
- A paired online phone receives a camera request immediately. No-phone/offline states explain the problem instead of pretending to wait. Multiple online phones require selection.
- Use Another Phone preserves the request ID, clears assignment and rotates a claimable QR. The first authorized same-shop phone can claim it without permanent pairing; the old phone loses that request and closes its sheet.
- Foreground requests appear even on Profile. Capture/gallery choice auto-compresses/uploads and inserts the image into the originating desktop field. Multi-photo sessions, retry, cancel, expiry and missed-event recovery use one reusable workflow.
- Local business records retain opaque private media paths; signed image URLs stay in memory. Bridge passwords, tokens and photo bytes are not persisted in ordinary localStorage.
- Diagnostics expose safe terminal/device IDs, registration, authenticated user, connection/socket status, heartbeat, pairing/request/upload errors. Android UI remains bundled inside the APK.

## Backend changes

Migration: `server/migrations/202610060110_device_bridge.sql` adds private terminals/staff_devices and stable device pairing references, uniqueness and connection-test jobs. Existing private-table restrictions and business RLS remain.

Registration, pairing, presence, test/confirm, rename/reset and camera endpoints retain `/api/v1/stores/:storeId/camera` conventions. No parallel incompatible endpoint family was introduced. See `server/docs/DEVICE-BRIDGE.md` and `server/docs/CAMERA-BRIDGE.md`.

## APK and network

- Version: **0.4C.3-test**, build **4**, package `com.tahamobiles.staff.debug`.
- File: `D:\Inventory system POS\artifacts\android\Taha-Staff-test-4C3.apk`.
- Size: **3,894,310 bytes**.
- SHA256: `25618bbda84c7bda1dcffd0c91100923f109411761782630f29a1019e3e0c6f3`.
- Download: http://192.168.1.11:3001/api/v1/downloads/staff-test-4c3.apk — downloaded bytes match the built file.
- Ethernet IPv4 verified: **192.168.1.11**. API bind: **0.0.0.0:3001**. Health returned status ok/database connected.
- On October 7 the PC address changed from 192.168.1.8; the interrupted test PostgreSQL instance recovered normally and the existing backend was restarted. Change the phone's Shop Address; no APK rebuild is needed for IP changes.
- Counter: http://127.0.0.1:1423 or http://192.168.1.11:1423. Phone Shop Address: http://192.168.1.11:3001.
- Android INTERNET/ACCESS_NETWORK_STATE/CAMERA permissions, debug private-LAN HTTP, production HTTPS and explicit credentialed CORS remain configured.

## Validation

| Check | Result |
| --- | --- |
| Frontend TypeScript/production build | Passed; existing large-chunk warning |
| Frontend/backend lint and backend build | Passed |
| Backend complete suite | 51/51 passed |
| Device UI/no-device/offline/two-device tests | 7/7 passed |
| Core Dashboard/POS/theme/customer-display/responsive suite | 9/9 passed |
| Camera/native-HTTP/CSP/QR/retry/cancel/expiry suite | 9/9 passed |
| Shop connection/logout/resume/routing/error-boundary suite | 12/12 passed |
| Real API/PostgreSQL browser integration | 3/3 passed |
| Existing management UI regressions | 37 selected checks passed, including reruns of five viewport checks after correcting anonymous-session probing |
| Android native tests | 22/22 passed |
| Android assembly/signature/download | Passed; APK v2 signature verified and download SHA matches |
| Android lint | 0 errors, 13 existing warnings |

The real integration tests use separately authenticated browser clients and emulate the Android native HTTP boundary. They decode actual generated QR images and verify local-data desktop → real backend → mobile request/gallery upload → desktop insertion, reload persistence, QR handoff, reset and LAN startup. Backend tests separately validate authenticated WebSocket rooms/delivery and cross-store/session isolation. These do not substitute for physical Android camera permission, focus, capture URI or Wi-Fi sleep testing.

## Physical retest — seven steps

1. Desktop counter → **Settings → Devices → Pair Staff Phone**. Sign into the shop if asked and leave the QR open.
2. Phone Chrome → http://192.168.1.11:3001/api/v1/health, then download/install the new APK. Confirm **0.4C.3-test/build4** in Diagnostics.
3. Taha Staff → Shop Address **http://192.168.1.11:3001** → Test Connection/Connect → sign in with the existing `owner@taha.test` account.
4. Center **Scan** → allow Camera → scan desktop QR → **Pair Device**. Alternatively enter its six-digit code. Desktop must show the phone Online.
5. Desktop **Send Test Request** → phone **Confirm**. Desktop must show **Device communication working ✓** before testing photos.
6. Desktop Add Product → **Take Photo with Phone** → phone capture/accept. Confirm automatic upload and desktop image insertion; repeat with Choose Existing Photo.
7. Test **Use Another Phone** with an authenticated phone, then lock/unlock and toggle Wi-Fi briefly. If anything fails, copy Diagnostics from both devices.

Known limits: foreground delivery only; physical retest pending; production signing/Hostinger deployment/background push remain later work. Next phase: physical pairing/scanner/camera acceptance on the actual handset, then production deployment and release signing.
