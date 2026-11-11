# Phase 5A — managed hosting preparation

No Hostinger deployment has been performed. The production counter is the locally bundled **Taha POS Windows application**. The NestJS service supplies authenticated shared data, synchronization and private files. A browser preview is a development tool.

## Recommended path: managed Node.js + external PostgreSQL

Confirm the actual Hostinger plan includes managed Node.js applications. Hostinger currently documents GitHub and ZIP deployment, build/start configuration and Node 22/24 support; NestJS is supported. See [Hostinger deployment instructions](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/). This path requires no Docker, root SSH, systemd, Caddy or VPS firewall administration.

1. Select the HTTPS API domain, a managed PostgreSQL provider and private S3-compatible object storage. Require encrypted database connections and provider backups. Do not use the local physical-test database in production.
2. Run `npm run package:managed` in the project root. Upload `artifacts/managed/Taha-API-managed-0.5.0.zip`, or select `server/` as the GitHub application root. The ZIP includes source, compiled code, versioned migrations and package manifests; it excludes `.env`, accounts, tests, uploads and local database files.
3. Choose Node 22 or 24. Install with `npm ci`, build with `npm run build`, start with `npm start`. The compiled entry point is `dist/main.js`; the managed launcher starts it on the platform's `PORT` and `0.0.0.0`.
4. Configure private environment values using `server/.env.managed.example`. Set `DATABASE_URL` to the restricted runtime account and `MIGRATION_DATABASE_URL` to a distinct schema owner. `MIGRATE_ON_START=true` applies checksummed migrations before opening the API. Never give the runtime account owner/superuser/BYPASSRLS privileges. For upgrades, take backups and run one migration job before switching traffic; do not scale simultaneous migration runners.
5. Set `PUBLIC_API_URL` to the public HTTPS origin, `NODE_ENV=production`, `COOKIE_SECURE=true`, an independent random `JWT_SECRET` and explicit browser/mobile CORS origins. `tauri://localhost` is the fixed native client origin. Production Swagger and APK fixture downloads are disabled. No wildcard credentialed CORS.
6. Select `STORAGE_DRIVER=s3` and configure the private endpoint, region, bucket and server-side credentials. Signed API media links continue to enforce authorization. Use `local` only if the selected plan guarantees persistent private storage and backups.
7. Provision the owner using the existing trusted `provision` tool from a controlled administration machine against the external database. There is no public signup or default production password. Set public `TAHA_API_URL` to the final API origin when building the Windows release; it contains no server credentials.
8. Check health, login/refresh/logout, RLS, cost isolation, concurrent stock changes, cash sales, offline import retries, receipt identity, revision polling and private media. Rehearse restore into a separate staging database and storage bucket.

## Realtime transport

Incoming cloud WebSockets are optional. Business changes use `GET /api/v1/stores/:storeId/sync/changes?after=<revision>`, with permission-scoped identifiers and per-store commit-ordered revisions. Changed catalogue rows are fetched separately. Active polling is four seconds, inactive polling thirty seconds, with immediate refresh after mutation/resume. Cash outbox synchronization uses HTTPS and exponential retry. Foreground cloud device notifications also poll.

The independent same-LAN Device Bridge retains Socket.IO for fast phone delivery. Native Windows can operate it through an owner-confirmed local connection. The existing LAN NestJS service must still run on the shop PC; this phase does not package a bridge daemon into the EXE. Cloud/LAN identities remain separate and are never silently forwarded to another host. An away-from-shop phone can connect to the cloud HTTPS bridge, but changing bridge hosts requires explicit sign-in/pairing; transparent cross-host session handoff is not implemented.

## PostgreSQL compatibility decision

**Option A is recommended:** managed Hostinger NestJS plus external managed PostgreSQL. Keep the existing engine and its security/concurrency tests.

The engine uses PL/pgSQL functions, SECURITY DEFINER and `search_path`, PostgreSQL RLS/policies, transaction-local identity via `set_config`, role switching, `jsonb`, UUID types, partial indexes, `ON CONFLICT`, `RETURNING`, advisory transaction locks, row locks, sequences, SQL triggers and PostgreSQL error codes. The server depends on `pg`; permissions, stock and financial posting execute in those database functions.

**Option B:** managed Hostinger NestJS plus Hostinger MySQL requires replacing `pg`, rewriting PostgreSQL functions/policies/helpers and identity mechanisms, translating JSON/UUID/index/upsert/returning syntax, reproducing locks/idempotency, rebuilding migrations, migrating data and repeating authorization, stock, tax, credit, return and concurrency tests. Plan several engineering weeks and a dedicated staging/restore rehearsal after a schema-by-schema inventory. It is not a connection-string change. No MySQL migration has begun.

## Optional VPS path

[Optional VPS instructions](HOSTINGER_VPS_OPTIONAL.md) and Compose remain available for an explicit future VPS decision. They are not managed-hosting prerequisites. Confirm the plan, domain, PostgreSQL, storage and credentials before deployment.
