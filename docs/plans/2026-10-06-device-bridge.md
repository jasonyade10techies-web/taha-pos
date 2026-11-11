# Phase 4C.3 — device bridge correction

The user's Phase 4C.3 specification is the implementation brief. Preserve approved business screens, local data and private authenticated upload security. Business repositories remain independently selectable. A configured custom device bridge must work in the normal local-data desktop.

## Design

Use one DeviceBridgeService with its own configured API origin, real authenticated context, stable terminal/device identities, scoped socket and foreground heartbeat. API business sessions can reuse their existing authenticated transport when origins match; a demo desktop restores or requests a real shop sign-in for device access only. A mock identity never authorizes backend access. No credentials are persisted in ordinary storage.

Persistent private backend terminal/device rows bind validated staff/store/session. Expiring hashed pairing codes and QR capabilities retain existing camera routes; registered devices survive refresh/restart and rebind only for their authorized profile. Assignment and request lifecycle are distinct. QR handoff retains the request and changes assignment without cancelling it.

Native Android scanning uses a real decoder with a square QR frame by default, separate horizontal barcode mode and dark/gold controls. Web fallback keeps the same closed parser. Requests arrive in a global foreground sheet even away from the queue.

## Implementation and verification

- [x] Reproduce local-data Settings pairing rejection with a failing browser test.
- [x] Add backend terminal/device registration, presence, pairing events, handshake test and safe QR assignment tests; preserve old route callers.
- [x] Implement independent bridge configuration/client/store and route all pairing/camera transport through it.
- [x] Build simple desktop Devices, pairing modal, no-device/offline states and compact status; remove mode instructions.
- [x] Wire persistent mobile identity, pairing confirmation, device screen, incoming requests and diagnostics.
- [x] Replace native scanner layout and add geometry/mode tests; version0.4C.3-test/build4.
- [x] Verify local-data desktop → real API → independently authenticated browser/native-HTTP client → capture → original local gallery insertion, including missed events, QR handoff, offline/cancel/expiry and isolation. Physical handset verification remains pending.
- [x] Run frontend/backend build/lint, relevant regression suites, native assembly/unit/lint/signature; verify downloaded APK hash and leave a seven-step physical retest guide.

## Review focus

Authenticated bridge context must not overwrite the local business identity. Same-site credential restoration must work through the counter proxy. Unauthorized device IDs, another store and stale sessions must never rebind a device. QR handoff must not cancel the requester UI. Phone sleep/restart must restore pairing without duplicate socket/heartbeat listeners. Reset Pairing must not touch products/accounts/database.
