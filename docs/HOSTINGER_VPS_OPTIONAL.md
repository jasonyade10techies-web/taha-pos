> OPTIONAL VPS ONLY. This is not the managed-hosting requirement. See docs/HOSTINGER_DEPLOYMENT.md for the primary path.

# Phase 5 preparation — no deployment performed

If a VPS is explicitly selected, this optional procedure uses Docker and PostgreSQL. The current application needs a continuously running NestJS API, PostgreSQL, private file storage and Socket.IO. The approved frontend remains in this repository; build and serve `dist/` separately from the bundled Android UI.

## VPS and domains

1. Prepare a supported Ubuntu LTS VPS, SSH keys and a non-root administrator. Install Docker Engine/Compose, Nginx and Certbot using their official packages.
2. Point `pos.<domain>` and `api.<domain>` DNS A/AAAA records to the VPS. Remove stale AAAA records if IPv6 is not configured.
3. Permit SSH from administrator addresses and public TCP 80/443. Keep PostgreSQL private. Compose exposes API port 3000 only on host loopback.
4. Provision certificates for both domains. Adapt `server/deploy/nginx.conf.example`; validate using `nginx -t` before enabling it. The example forwards Socket.IO's **`/socket.io/`** HTTP polling/WebSocket path as well as REST; the counter namespace is `/counter`.

## Configuration and builds

Create a private `server/.env` from `server/.env.example`. Use independent, long, URL-safe database passwords and a random JWT secret of at least 32 bytes. Restrict file permissions. Never put passwords or JWT secrets into frontend build variables.

Required production values:

```dotenv
NODE_ENV=production
FRONTEND_ORIGIN=https://pos.<domain>
MOBILE_APP_ORIGIN=http://localhost
PUBLIC_API_URL=https://api.<domain>
COOKIE_SECURE=true
POSTGRES_PASSWORD=<migration-owner password>
API_DATABASE_PASSWORD=<restricted runtime password>
JWT_SECRET=<random secret>
```

The bundled Android origin is `http://localhost` even when requests target HTTPS. CORS uses explicit origins for both REST and WebSockets. It is not a wildcard policy. WebView native HTTP uses the same shop origin checks. Swagger and TEST APK downloads are disabled in production.

From `server/`:

```sh
docker compose build
docker compose up -d
docker compose ps
curl --fail https://api.<domain>/api/v1/health
```

The migration service runs once using the migration owner, creates/updates the restricted runtime role and must finish successfully before the API starts. Never use the migration owner for API queries. For upgrades, take a consistent backup first, review migrations, then run `docker compose run --rm migrate` before replacing API containers. `npm run provision -- ...` is the trusted staff-account provisioning entry; review its CLI usage. No public signup is enabled.

Build frontend with `VITE_DATA_PROVIDER=api`, `VITE_USE_MOCK_AUTH=false`, `VITE_API_URL=/api/v1`, `VITE_API_BASE_URL=/api/v1`. Run `npm ci && npm run build`, then copy `dist/` to `/srv/taha/frontend`. Same-origin `/api/` is proxied to the API; no customer or staff credentials are embedded in assets. Hash routing is used inside Android; browser routing needs the Nginx SPA fallback.

The future signed Android release is built with `MOBILE_RELEASE=true`. Release manifests deny cleartext HTTP; connection validation also requires HTTPS. The current TEST APK allows private LAN HTTP only. Shop address remains user-configurable; no production LAN IP is hardcoded. Create a release keystore outside source control and manage signing separately before distribution.

## Private media and persistent data

Compose has separate `postgres_data` and `media_data` volumes. The API runs as a non-root user. Do not expose media as a public Nginx directory: permission checks and expiring signed image URLs are enforced by the API. Originals, cropped derivatives and thumbnails are retained together. Originals referenced by derivatives cannot be deleted. Upload proxy limit is 18 MB; API image validation, pixel limits and request limits remain authoritative.

Review disk capacity and a retention policy for unattached drafts before production. Do not run `docker compose down -v` on live data. A healthy API requires a connected database; Compose includes a database healthcheck and API healthcheck.

## Backups and restore rehearsal

`server/deploy/backup.sh /absolute/private/backup-directory` creates a PostgreSQL custom-format dump, private media archive and checksums. Pause writes during this two-part backup for consistency, then resume. Encrypt backups, copy them to a different host, restrict access and apply retention. Never include `.env` in an unencrypted public archive.

Rehearse restore into a separate staging stack, not the live database:

```sh
sha256sum -c checksums-<timestamp>.txt
docker compose exec -T postgres pg_restore -U taha_migrator -d taha_pos --clean --if-exists < database-<timestamp>.dump
docker compose exec -T --user root api tar -C /workspace/server/data -xzf - < media-<timestamp>.tar.gz
docker compose exec -T --user root api chown -R node:node /workspace/server/data/media
docker compose run --rm migrate
```

Verify account access, RLS, stock totals, an existing invoice, private images and phone pairing before accepting a restore. Keep the original migration/runtime credentials in a secrets manager. Restore cannot recover data absent from the backup.

## Phase 5 gates

Run production frontend/backend builds, full automated tests, migration validation against a clean PostgreSQL instance, dependency review, HTTPS/CORS/cookie tests, Socket.IO reconnect, camera upload and restore rehearsal. Then run the physical Android test and two-counter isolation check against the staging HTTPS domain. Configure monitoring, certificate renewal, restricted log rotation, rate limits and backups before allowing production sales. No VPS, DNS, certificate or remote account was changed in Phase 4D.
