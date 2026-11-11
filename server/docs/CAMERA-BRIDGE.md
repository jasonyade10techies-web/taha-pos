# Instant camera bridge — Phase 4C.3

See [DEVICE-BRIDGE.md](DEVICE-BRIDGE.md) for independent shop authentication, persistent counter/phone registration, pairing and presence. Business data may remain local while this bridge uses the real backend.

All paths below are relative to `/api/v1`. Use the existing bearer/counter-session authentication. The bundled Android REST/WebSocket origin is explicitly `http://localhost`; production API and desktop origins require HTTPS. No public upload path was added.

## Requests, assignment and captures

- `POST /stores/:storeId/camera/pairing` with `{terminalId}` returns a six-digit code, expiry and public shop origin. Codes are hashed, single-use and branch scoped. Pairing attempts are limited per active profile/store to10 per15minutes; the previous eight-character format remains accepted for compatibility.
- `POST /stores/:storeId/camera/pair` with `{code,deviceName,deviceId}` associates the registered, authenticated phone with the selected counter. Its stable device ID allows pairing to survive renewed sessions.
- `GET /stores/:storeId/camera/devices?terminalId=...` returns authorized pairings and online state (registered device heartbeat within60seconds or an active authenticated socket; legacy unregistered sessions retain a2-minute fallback). The counter auto-selects one usable device; multiple online devices use a selector. Offline devices are disabled.
- `POST /stores/:storeId/camera/jobs` accepts existing type/label/reference/amount/entity/terminal fields plus `deviceId`, `fallback`, `maxCaptures` and `targetSlot`. Server checks requester permissions, store and pairing. It records the immutable requester/device/session/entity/slot and a10-minute expiry. Gallery types can accept1–8 photos; proof/profile/customer/document fields accept1.
- `POST /stores/:storeId/camera/jobs/:id/qr` releases an unused request to QR fallback without cancelling it. The old phone receives an assignment-change event and loses access to that request; the counter keeps the same request ID. Handoff after an accepted capture is rejected. Claim capabilities contain24 random bytes, are stored only as digests and expire with the request.
- `POST /stores/:storeId/camera/jobs/:id/claim` with `{token}` is limited to active staff with devices.pair/media.upload in the same store. An unused, unassigned, unexpired request is assigned once to this exact session/profile. Tokens never grant anonymous upload access.
- **`POST /stores/:storeId/camera/jobs/:id/captures`**, multipart `file` + UUID `captureId`, validates the active branch/session/profile and exact assigned request. Phone-supplied entity/slot fields are ignored; request context is authoritative. File limit10MB; accepted JPEG/PNG/WebP are decoded and bounded to50million pixels. Existing storage compression limit2MB applies after conversion.
- Capture write locks the request row, checks status/expiry/capacity, creates private file/media/capture records and transitions state together. Same capture ID + same input returns the committed result, including after a lost acknowledgement. Another image/job reusing the ID returns409. Concurrent retries cannot create duplicate images.
- Response includes the request and capture metadata: captureId, mediaId, opaque logical imagePath, signed imageUrl/thumbnailUrl, size and creation time. No Windows filesystem/storage-root path is returned. Other phones/branches and cancelled/expired new captures are denied.
- `POST /stores/:storeId/camera/jobs/:id/finish` closes a multi-photo session with at least one capture.
- Existing `PATCH /stores/:storeId/camera/jobs/:id` progress/cancel endpoint remains compatible; uploads now use the single atomic captures route, not a split upload/acknowledgement sequence.
- `GET /stores/:storeId/camera/jobs?terminalId=...` lists only requests belonging to the current requester or assigned phone profile/session. It is the reconnect/missed-event fallback.

## Files and targets

Types normalize through one implementation: product, payment-proof, profile, customer, device, repair, damage and document. Default slots are images.gallery, payment.proof, avatar, photo, device.photos, intake.photos, damage.photos and document.photo. Repair categories use validated repair.before/after/damage/customer-provided slots. Frontend component instances deliver only their own request/capture IDs and deduplicate insertion.

FileStorage remains the private abstraction; current provider is LocalFileStorage. Images are binary files, not database JSON/base64. Sharp auto-rotates, strips EXIF and exports bounded WebP: product/device/repair1800px, profile640px, proof/document2400px with higher text-detail quality. A360px thumbnail is generated beside each image. Signed thumbnail/full-image links require an active authorized session. Image fields load thumbnails initially and keep the full signed URL for View.

## Realtime and recovery

CounterGateway emits metadata-only camera.request.created/requested/updated/request.completed/completed events to the exact requester/assigned sessions. Every recipient is reauthorized, including current counter employee context. No image bytes, claim token or credentials are broadcast.

The frontend has one reference-counted watcher per store/profile/counter. While a counter request is active it polls each second as a missed-event fallback and stops after completion/failure/cancel/expiry. Phone queues also refresh periodically and on foreground/network recovery. A request removed from a phone's authorized queue is cancelled locally (e.g. QR handoff missed while asleep). No new request created during an in-flight poll is discarded. Resume handlers reconnect existing sockets and clean up listeners/watchers on teardown.

Android capture returns a narrow content URI from FileProvider/system picker to WebView's selected-file callback; it is read as a File, not passed to fetch(content://). Compression precedes upload. Native pending-capture storage uses binary files and metadata in app-private files: max8,8MB/file,32MB total,30minutes. Success, cancel, logout and shop changes clean files. Original camera files are released after conversion. Native HTTP constructs authenticated multipart with Request/FormData's real boundary, scopes URLs to the selected API and refuses redirects. No token/password/photo bytes are persisted in ordinary localStorage.

## Diagnostics

`POST /stores/:storeId/camera/test` creates an authorized self-assigned diagnostic request. It uses the same compression/native transport/atomic upload path, then verifies the signed thumbnail. `DELETE /stores/:storeId/camera/jobs/:id/test` removes only that session's diagnostic image/files; it cannot delete business evidence.

Optional PC-side LAN control: `scripts/check-mobile-upload.ts` requires TAHA_TEST_SHOP_URL (private192.168 origin) and TAHA_TEST_PASSWORD for the existing owner@taha.test fixture. It creates/deletes only a diagnostic request, logs sanitized results and signs out. It verifies real multipart/CORS/thumbnail behavior using Android's Origin; it does not substitute for physical Android camera/URI testing.

## Migrations

- `202610060108_instant_camera_bridge.sql`: optional QR device assignment,10-minute expiry, capture limit, target slot, hashed claim capability, diagnostics flag and private camera_captures table with indexes/FKs.
- `202610060109_camera_diagnostic_audit.sql`: narrowly allowlisted diagnostic cleanup audit action.
- `202610060110_device_bridge.sql`: private persistent terminals/staff devices, pairing uniqueness, registration/presence and connection-test requests.

Run the existing migration runner with separate migration/runtime connections. Existing business RLS remains; camera tables remain private API-only data, revoked from PUBLIC/anon/authenticated. The dedicated server runtime is not superuser and cannot bypass public business RLS. AuthGuard/service checks enforce the normalized business permissions; the frontend has no direct private-table access.

Physical 4C.3 retest is still required. Background push and production hosting/signing are outside this phase.
