> OPTIONAL VPS ONLY. This is not the managed-hosting requirement. See docs/HOSTINGER_DEPLOYMENT.md for the primary path.

# Phase 4E production preparation

Not deployed. No VPS or domain credentials have been provided. Docker is unavailable on this Windows machine; container startup and live TLS validation must run on the VPS.

## Required environment

Keep the private `.env` out of version control. Set `APP_DOMAIN`, `API_DOMAIN`, `ACME_EMAIL`, `FRONTEND_ORIGIN=https://<app-domain>`, `PUBLIC_API_URL=https://<api-domain>`, independent strong `POSTGRES_PASSWORD`/`API_DATABASE_PASSWORD`, and a randomly generated `JWT_SECRET` of at least 32 bytes. Passwords embedded in database URLs must be URL-encoded.

Build the existing frontend with `VITE_DATA_PROVIDER=api`, `VITE_USE_MOCK_AUTH=false`, `VITE_API_URL=/api/v1`. The web app uses its same-origin `/api/` proxy. Do not bake a private LAN IP or test password into a production build.

Production Android uses `MOBILE_RELEASE=true` and `VITE_MOBILE_SHOP_URL=https://<api-domain>` when running `npm run build:mobile`. Its bundled UI is local; HTTPS connects to the API. Release signing is a separate protected step. The generated Phase 4E APK remains a debug/test build with manual LAN setup.

## Deployment

1. Use an Ubuntu VPS with Docker Engine and Compose; point the app/API DNS records at the VPS and open only HTTPS/HTTP plus restricted administration.
2. Build the frontend to `dist/`. From `server/`, run `docker compose -f compose.yml -f compose.production.yml --env-file .env config` and review it privately; resolved configuration includes credentials.
3. Run the same Compose command with `up --build -d`. Migrations run before the API. Caddy obtains TLS certificates and automatically proxies WebSocket upgrades. Uploads are limited to 20 MB. Database port 5432 is never published; runtime API port 3000 is localhost-only.
4. Provision a real owner through the trusted provisioning command. There is no default production password.
5. Verify health, HTTPS login/refresh/logout, permission denial, stock/sale atomicity, device pairing, photo upload, display synchronization and signed receipt links. Never use a test database as the live shop database.

## Backups and recovery

Run `deploy/backup.sh /absolute/private-backup-directory` daily using a systemd timer or cron from the server directory. It captures a PostgreSQL custom-format dump and private uploads with checksums. Pause mutations for a coordinated snapshot, or schedule during shop closure; independently copying a busy database and filesystem is not a transactional snapshot.

Suggested retention: 7 daily, 4 weekly and 12 monthly copies. Encrypt and copy to an off-VPS destination. Retention is intentionally documented rather than an automatic script deleting backups. Monitor successful completion and available space.

Rehearse on an isolated Compose project/VPS, never first on live data. Copy the full backup set; verify checksums; set `TAHA_SERVER_DIRECTORY` to the isolated server directory and `TAHA_RESTORE_CONFIRM=RESTORE_TAHA_DATABASE`; run `deploy/restore.sh /backup/directory <timestamp>`. The script stops the API and restores only after explicit confirmation. Verify health, login, counts, inventory movement balances, sample invoices and private originals/derivatives. Record recovery time and rotate/revoke restored sessions before reopening a real restored service.

## Offline and optional LAN bridge

Business data and Device Bridge are independent. `VITE_DEVICE_BRIDGE_URL` may point a counter to a trusted local Taha API while its production business API is cloud-hosted. Pair/sign in to that bridge separately; never forward cloud refresh tokens to another host. A phone paired to the same LAN bridge can exchange photos without internet. Switching shop/bridge hosts is explicit; automatic cloud-to-LAN credential handoff is not implemented.

Cost-free catalog/stock/location reads can use the scoped IndexedDB cache. Offline product changes remain drafts with queued images, and only server acceptance creates authoritative stock movements. No offline request is shown as a completed server sale.

## Migration record

New versioned migrations are `202610080100_product_hardening.sql`, `202610080110_tax_snapshots.sql`, `202610080120_safe_receipts.sql`, `202610080130_catalog_search_index.sql`, `202610080140_atomic_product_media.sql`, `202610080150_immutable_tax_insert.sql`, `202610080160_product_tags_binding.sql`, and `202610080170_tax_total_constraints.sql`. Earlier migrations are not edited in place. Existing records are preserved.

Signed receipt tokens are short-lived receipt capabilities, not login credentials. Their public projection contains only invoice/customer-facing totals and items. Product costs and profit remain in separately authorized queries. Rotate the server signing secret deliberately; this invalidates outstanding links and sessions.
