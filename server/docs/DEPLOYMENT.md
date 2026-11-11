# Custom backend setup and Hostinger deployment

The primary target is Hostinger **managed Node.js** plus external managed PostgreSQL. Confirm the actual plan supports Node.js; PHP/static-only plans are insufficient. See [the managed deployment guide](../../docs/HOSTINGER_DEPLOYMENT.md). Docker and a VPS are optional, and cloud correctness uses HTTPS revision polling. No hosted Supabase account is needed.

## Local development

From `server`: `npm ci`; copy `.env.example` to `.env`; provide PostgreSQL migration/runtime URLs and a random `JWT_SECRET` (at least 32 bytes).

Run `npm run migrate`. The runtime role is created as NOSUPERUSER/NOBYPASSRLS/NOINHERIT; it receives authenticated-role membership and narrow private API tables only. Business queries explicitly set the role/validated identity inside transactions and restore the connection after commit/rollback.

Provision the initial owner with trusted console environment variables `PROVISION_EMAIL`, `PROVISION_NAME`, `PROVISION_PASSWORD`, optionally `PROVISION_STORE_ID`; then `npm run provision`. No default production accounts are seeded. Passwords are Argon2id hashes. Terminal accounts use `PROVISION_ROLE=terminal` and require a staff PIN session to access business data.

Run `npm run dev`, or `npm run build` then `npm start`. API defaults to port 3000. Swagger/OpenAPI exists only outside production at `/api/docs` and `/api/docs-json`. Frontend chooses `VITE_DATA_PROVIDER=api`, `VITE_USE_MOCK_AUTH=false`, `VITE_API_URL=/api/v1` with the Vite proxy or same-origin reverse proxy. Local/demo IndexedDB mode remains independently supported.

Allowed web origins are explicitly configured by comma-separated `FRONTEND_ORIGIN`. Login and refresh require an allowed Origin; refresh cookies are HttpOnly, SameSite=Strict, Secure in production. Use same-origin deployment for reliable mobile/counter session cookies.

## Optional Docker / VPS deployment

Set `.env` values for `POSTGRES_PASSWORD`, `API_DATABASE_PASSWORD`, `JWT_SECRET`, HTTPS `FRONTEND_ORIGIN`, HTTPS `PUBLIC_API_URL`, and optional VAPID keys. Percent-encode reserved URL characters in database passwords. Run `docker compose -f compose.yml --env-file .env up --build -d` from `server`.

The migration job has a separate administrator credential. The API container runs as the non-root Node user and does not receive the migration credential. PostgreSQL has no public port. The API binds only localhost:3000; place an HTTPS reverse proxy in front of it.

Compose passes an explicit runtime environment whitelist; it does not load the whole .env into the API container. Keep migration/admin credentials only in the migration operation. If terminating TLS at a reverse proxy, configure a trusted proxy/network deliberately before enabling forwarded client IP handling; never trust arbitrary X-Forwarded-For headers.

Reverse proxy `/api/` to `http://127.0.0.1:3000/api/` and `/socket.io/` to `http://127.0.0.1:3000/socket.io/` with HTTP/1.1 Upgrade and Connection headers. Serve the existing Vite production build at `/`. Keep its SPA fallback away from API paths. Use TLS on mobile phones (camera/PWA/push require HTTPS except localhost).

Back up both PostgreSQL and `media_data`, test restores, rotate credentials, and monitor expiry/storage capacity. Local disk storage implements a replaceable FileStorage interface; object storage can be substituted without publicizing private media.

## Verification

`npm run build` checks strict TypeScript; `npm run lint` runs ESLint. `npm test` runs crypto/unit + real PostgreSQL/HTTP integration checks against an isolated new local database. Start a local test PostgreSQL administrator at `TAHA_TEST_POSTGRES_URL` (defaults `postgresql://taha_test@127.0.0.1:55439/postgres`). The runner refuses a remote administrator URL. It never modifies existing business databases.

`npm run test:serve` creates a separate localhost browser fixture, serves API3000, and prints test-only accounts. It does not create `.env` or production credentials.

## Security boundaries

Frontend role names do not grant access. Every business operation retains granular PostgreSQL authorization. Purchase costs/profit use separate RLS-protected tables/functions. REST uses an explicit allowlist; no caller can choose SQL/RPC functions. Session claims are created by this server. Revocation is checked on each HTTP request and each private WebSocket event recipient.

PIN hashing/verifications remain entirely in the reused PostgreSQL protected credential functions. Refresh token plaintext is never stored; one-time rotation and family revocation block replay. Media is decoded, resized, metadata-stripped and compressed to private WebP before storing. Signed links expire after 5 minutes, and access is checked again on each read. Financial proof files cannot be deleted through the API.

Optional Web Push requires server VAPID keys and browser permission. Push payloads contain a camera-request reference and generic text; private payment/customer details remain behind authenticated APIs. Android/desktop support varies; iOS requires a supported installed web app. Opening the mobile Camera Requests page remains the fallback.

This repository has not been deployed to Hostinger. Docker is required only for the optional Compose path. Windows and offline SQLite are documented in [PHASE5A_WINDOWS.md](../../docs/PHASE5A_WINDOWS.md).

Remote customer displays use a dedicated expiring display capability and REST heartbeat/polling. They receive only validated customer-facing snapshots, not staff auth tokens or internal WebSocket rooms. Same-browser BroadcastChannel still works without this API. A TV/phone on another network requires this API to be reachable over HTTPS; localhost on the counter PC is not a public deployment. Customer displays and camera pairings are bound to the active account/counter session and must be paired again after it ends.
