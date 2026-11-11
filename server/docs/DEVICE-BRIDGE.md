# Phase 4C.3 — independent staff device bridge

The business repository provider and device bridge are independent. `VITE_DATA_PROVIDER=local` keeps IndexedDB business records; `VITE_API_BASE_URL=/api/v1` connects staff devices to the custom API through the development proxy. For a separate origin use its HTTPS API base ending in `/api/v1`; debug LAN HTTP is restricted to private hosts. No Supabase adapter is used for pairing or camera jobs.

The LAN launcher defaults to local/demo business data and a real authenticated device bridge. It prints the actual LAN address. Current test API: `http://192.168.1.11:3001`. Port1423 is only the desktop preview. The Android UI remains bundled and uses its configured Shop Connection for all API calls.

## Authentication and identity

Local/demo desktop users sign in to the shop once when pairing. This is a real account session, not the mock business identity. The bridge keeps access tokens only in memory and refreshes using the server's HttpOnly cookie. API business mode shares the existing authenticated API session. Android retains its refresh cookie in native HTTP storage and uses its existing login.

The browser persists a UUID terminal identity and readable name, not a WebSocket ID. Android persists a private native UUID device identity across restarts. Re-registering the same owned device restores its pairing to a renewed session; another profile or store cannot hijack it. Pairings are scoped to their store, counter owner, registered device and current authenticated phone session.

`202610060110_device_bridge.sql` adds private `terminals` and `staff_devices`, stable device references, active-pair uniqueness and connection-test jobs. Private tables are denied to PUBLIC/anon/authenticated; only the existing server runtime has access. Business RLS remains unchanged.

## API contracts

All routes start `/api/v1/stores/:storeId/camera`; existing conventions are preserved.

| Method/path | Purpose |
| --- | --- |
| POST `terminals/register` | `{terminalId,name}` registers/refreshes the owned counter |
| GET `terminals/register?terminalId=...` | Counter registration and pairing summary |
| POST `devices/register` | `{deviceId,name,platform}` registers the owned phone; restores pairing |
| POST `devices/heartbeat` | Current-session deviceId or owned terminalId presence |
| POST `pairing` | `{terminalId}` returns QR, six-digit code, shop/counter context and expiry |
| POST `pair` | `{code,deviceId,deviceName}` verifies code and pairs authorized staff |
| GET `devices?terminalId=...` | Authorized paired devices including online/offline state |
| PATCH `devices/:id` | `{deviceName}` renames the owned pairing/device |
| DELETE `devices/:id` | Disconnects that pairing and cancels its unfinished assigned jobs |
| DELETE `pairings?terminalId=...` | Resets only the owned counter's pairing and unfinished jobs |
| POST `devices/:id/test` | Harmless connection-test request |
| POST `jobs/:id/confirm` | Assigned phone acknowledges a connection test |
| POST `jobs` | Creates a typed authorized camera request |
| GET `jobs`, GET `jobs/:id` | Authorized queue/request recovery |
| POST `jobs/:id/qr` | Converts the same unused request into claimable QR assignment |
| POST `jobs/:id/claim` | First authorized staff session claims the current capability |
| POST `jobs/:id/captures` | Atomic private multipart capture; idempotent capture UUID |
| POST `jobs/:id/finish` | Completes a gallery session |
| PATCH `jobs/:id` | Progress/cancel using existing endpoint |

Pairing codes expire in10minutes, are hashed, single-use and attempt-limited. The QR is a closed `taha-mobile://pair` payload with store/terminal/code/expiry; it contains no password or authentication tokens. Camera QR uses a random24-byte short-lived capability, stored as a digest and rotated on handoff. Scanning does not authorize an arbitrary URL. All claims still require current staff authentication, same-store membership and permissions.

## Presence, events and camera handoff

Authenticated `/counter` WebSockets revalidate subscriptions and outgoing recipients. Rooms are scoped to store, terminal, registered device and session; camera and pairing events never go to every store member. A heartbeat runs every10seconds while foregrounded. Online means a valid current session plus a heartbeat within60seconds or an authenticated live device socket. Server presence reconciliation runs every15seconds. Loss detection can therefore take up to~75seconds.

Pairing completion, online/offline, rename and unpair refresh the desktop. One reference-counted frontend socket/poller exists per identity/counter. Resume and network recovery reuse/reconnect it; teardown removes listeners and sockets. Registration acknowledgement precedes successful subscription status.

Assignment states are UNASSIGNED, ASSIGNED, CLAIMED, IN_PROGRESS, COMPLETED, CANCELLED and EXPIRED. `Use Another Phone` preserves the request ID, removes only its assignment and rotates its QR capability. It does not cancel the request. Another authorized phone can claim it without permanent pairing. The old phone loses its authorized queue entry and closes its capture sheet. Cancel/reset is separate and counter scoped.

Camera fields select the sole online paired phone or offer a chooser. No paired phone and offline phone states are explicit; they never create a misleading waiting request. QR fallback creates an unassigned request only after the employee chooses it. Incoming foreground requests appear even on Profile or other tabs; Requests owns its own sheet so two dialogs are never stacked.

Photo capture/gallery selection auto-compresses and uploads through existing native HTTP. Local business records store only `taha-media:<opaque path>`; private images resolve through authorized short-lived URLs in memory. No photo bytes or signed tokens are saved to ordinary localStorage by the bridge.

## Validation and remaining physical test

Run `npx playwright test -c playwright.bridge.config.ts` with the LAN API, counter1423 and bundled mobile preview4175 running. It uses the real API/PostgreSQL and an emulated native HTTP boundary; it is not a physical handset test. `server/test/device-bridge.test.ts` covers independent identities, permissions, expiry, reset, handoff, persistent renewal and scoped WebSockets in an isolated database.

See `mobile/android/README.md` for the seven-step physical retest. Foreground delivery is implemented; background push, production signing and hosting remain later work.
