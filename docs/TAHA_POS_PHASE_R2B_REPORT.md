# Taha POS — Phase R2B implementation and acceptance report

Evidence spans 11–13 November 2026. Project: `D:\Inventory system POS`. **Local R2B acceptance PASSED. This is not cloud deployment or physical/native acceptance.** No cloud deployment, DNS change, purchase or saved-shop migration has occurred.

## Source baseline and data protection

- R2A commit `2955c204b645ef9d11a8ef78be88f81f36e915f0` and its branch were preserved. R2B began from a clean worktree on `codex/r2b-cloud-staging`.
- Implementation commit: `5348840dce3e24af923e5a7333629f465aef7a2d`. Database-outage correction: **`6bea29a59a767802635ae0213154c8345c5381c1`**, embedded in the corrected release manifest. Subsequent documentation-only checkpoint is reported in the final owner response.
- Private R1/R2A archives remain untouched. A new exact-source ZIP and Git bundle were SHA256-compared on both `D:\Taha-Private-Recovery\R2B-20261113-1325` and `C:\Users\hassa\.taha-private-recovery\R2B-20261113-1325`. The bundle was independently cloned and `git fsck --full` passed. This preserves the local recovered history; it does not invent pre-R1 history or publish a remote repository.
- Recovered `server/src/media/media.service.ts` remains **34,082 bytes**, SHA256 **`b5db3723b534c0e00371a0f0d15a8289b20a12d58e0bcdb61622dc8d2b6c0d3f`**. It was not rewritten.
- The saved shop cluster/port **55439 was not started**. Financial, migration, seed and media tests use disposable databases on the identity-checked loopback cluster **55459** and private disposable files. The existing saved data and its R1 backups were not reset or migrated.
- Git objects and 799 tracked text files were checked after the interruption: no source NUL/UTF-8 findings. Incomplete interrupted logs are retained but excluded from acceptance. NUL padding in an interrupted ignored log is not a hardware diagnosis.

## Durable revision coverage

Append-only migration `server/migrations/202611120100_cloud_revision_coverage.sql` extends the existing architecture. No historical migration was edited. The source manifest is now **68 migrations**, versus 67 in the fresh R2A source; the older 64-migration restore was a historical snapshot.

`app_private.emit_revision` locks the shared per-store head row and writes `sync_changes` in the same transaction as the mutation. This provides **per-store**, commit-ordered monotonic revisions; it does not claim one global cursor. Rollbacks produce no committed event. A missed Socket.IO notification cannot hide a committed operation.

Coverage includes existing products, inventory/locations/movements, sales/payments, customers/credit/settings/permissions and new repair jobs, shifts, service deletion, catalog values, suppliers, receiving drafts/lines/costs, product-financial changes, returns, purchased devices, coupons, audit, profiles/memberships/store settings and attached media metadata. Media kinds map to the appropriate authorized resource; detached images notify old and new attachments. No names, prices, costs, file bytes or signed URLs enter the feed. No revisions are generated for reads or routine device/session heartbeats.

`server/src/sync/sync.controller.ts` reads head, retained boundary and batches of up to 200 from one database snapshot. Fresh server context controls branch and resource permissions. Denied rows still advance the cursor safely; affected employees can receive their own permission/profile event and authorized own-shift events. Initial bootstrap, future cursors and retention gaps request a reset rather than silently skipping state.

`BusinessService` and `WorkflowsService` now treat post-commit notifications as best effort. A failed notification no longer converts a confirmed financial/workflow commit into an apparent failed operation. PostgreSQL remains authoritative.

## Desktop, mobile and native-cache polling

`src/lib/api/revision-poller.ts` is a tested state machine; `src/lib/api/realtime.ts` adapts it to real requests, subscriptions and SQLite cache. Behavior:

- One active request per subscription; shared/ref-counted session/store subscribers.
- Active 4-second polling, hidden 30-second polling, bounded exponential reconnect backoff, short catch-up paging, online/resume and explicit retry.
- Abort/lifecycle/session-generation guards reject late responses. 401/403 stops repeated polling and exposes an access state.
- Apply/invalidate before acknowledging a cursor. No SQLite write for unchanged polls. Failed application of updates retains the previous cursor.
- Scoped native cursor key `sync-cursor:<store>:<subject>`; stale global keys are ignored. Bootstrap refreshes the permitted catalog once; subsequent product/stock/service deltas merge changed UUIDs while retaining the existing reservation layer.
- Permission changes refresh session context only after cursor persistence. Workspace is cleared on branch/identity/permission changes. Compact reconnect feedback was added without redesigning approved pages/themes.

Cloud polling is independent of the LAN Device Bridge. The cloud `PollingGateway` has no sockets, rooms, presence timers or endless worker. The local `CounterGateway`/Socket.IO bridge remains in local mode. Camera/device delivery also retains its protected database-backed REST polling; business demo/API selection was not recoupled to device pairing.

## Liveness and deep readiness

`server/src/health/readiness.service.ts` separates process liveness from dependency readiness. It checks configuration/startup, PostgreSQL connectivity, actual cloud TLS, exact migration checksums, pgcrypto/required functions, RLS and restricted runtime grants, authentication crypto/provisioning and private storage. Runtime registry access is read-only; no migration runs at web startup or per HTTP request.

Endpoints:

| Endpoint | Meaning |
|---|---|
| `/api/v1/health/live` | Process can respond; no database dependency. |
| `/api/v1/health` | Compatibility connectivity response; explicitly `readiness:not-assessed`. |
| `/api/v1/health/readyz` | Cached sanitized public summary, 200 ready or 503 degraded/unavailable. |
| `/api/v1/health/ready?refresh=1` | Owner/settings-manager deep diagnostics; no secrets or raw infrastructure errors. |

Deep inspection is single-flight with short result caching. Storage success caches 60 seconds, failure 5 seconds; authorized refresh can force a new probe. Only a random diagnostic object is written/read/byte-compared, checked against anonymous access and deleted. No existing object is overwritten. Missing migration/checksum/function, unsafe grants and object-storage failures are explicit failures, not “database connected therefore ready.”

### Additional real defect found and corrected

The production-style outage rehearsal exposed an **unhandled `pg.Client` error while a connection was checked out by a transaction**. The API process could exit when PostgreSQL terminated that connection. `Database` now retains a client error listener, destroys failed transaction connections, preserves the original rejection if rollback also fails and does not retry financial writes. Dependency/network SQL errors become sanitized HTTP 503 responses. A real active-transaction termination regression was added. This correction is in commit `6bea29a...`; the earlier package from `5348840...` is **superseded and not accepted**.

## Private media and hosting transport

The recovered MediaService, originals, thumbnails, ordering/primary, crop, camera upload, retries and private authorization are preserved. `LocalFileStorage` now provides bounded deep probes and read-only object inventory. Development disk storage remains available; cloud startup requires configured private object storage outside deployable application directories.

The existing signed S3 form POST protocol remains exact-size, scoped and short-lived. Provider-contract tests cover actual HTTP CRUD, privacy, corruption and denied/unavailable operations. **No real hosted bucket is configured or certified.** The chosen provider must support signed form POST, not merely claim S3 compatibility. Browser POST CORS must be tested on its actual origin.

TLS offload for companion private reads is accepted only when Express validates an explicitly configured trusted cloud proxy. Direct TLS remains supported. Local cleartext plus a spoofed forwarded header does not become secure. No trust-all proxy default was added.

Historical missing bytes remain unknown without an approved real inventory. Existing truthful placeholders remain. `dist-tools/scripts/inventory-media.js`, guarded by explicit inventory approval and store UUID, can report affected IDs/representations without modifying metadata or inventing originals; it was not run against saved shop data.

## Combined managed package and migration safety

`scripts/package-r2b.mjs` creates a new timestamped release, real-API React bundle and compiled Nest/tools, blank environment template, separate migration/seed runners, SHA256 manifest, smoke script and rollback instructions. ZIP allowlisting excludes real environment files, database/media data, credentials, signing files, source maps, logs and private archives. Production dependencies install on the actual target platform; Windows node_modules is not uploaded.

`server/src/frontend.ts` serves same-origin bundled assets and SPA browser routes. `/api`, missing assets, dotfiles and non-GET/HEAD requests never receive SPA HTML. There is no Vite runtime or business-data demo fallback. Cloud mode requires HTTPS, verified PostgreSQL TLS, private object storage and bounded pooling. Start respects platform `PORT`, binds `0.0.0.0` by default and uses existing shutdown hooks.

`migrate-staging.ts` requires explicit staging approval, exact database name and distinct migration/runtime identities. A separately approved pooling hostname must see the migrated target. `seed-staging.ts` refuses occupied domain/media data and creates transactional, synthetic linked samples once. Neither is invoked by application startup. Backup/restore and forward-safe rollback steps are in `TAHA_POS_HOSTINGER_STAGING_RUNBOOK.md`.

Accepted local staging release:

- Version: **0.5.0-r2b.1**.
- Directory: `artifacts/managed/Taha-POS-staging-R2B-0.5.0-r2b.1-20261113T082433/`.
- ZIP: `artifacts/managed/Taha-POS-staging-R2B-0.5.0-r2b.1-20261113T082433.zip`.
- SHA256: **`907072908d842f14c8ef754df77eb83052b1440d779d62db23d5e1513be1e7eb`**.
- Implementation commit: **`6bea29a59a767802635ae0213154c8345c5381c1`**, clean at package capture.
- Manifest: 341 hashed payload files plus the manifest itself.

The corrected release passed all **16 production-style local checks** on 13 November. Fresh complete frontend **187 passed / 1 intentional skip / 0 failed**; final complete backend **262 passed / 0 failed / 0 skipped**. ZIP CRC and all 341 payload hashes passed inspection, with no known private environment values found. See `TAHA_POS_R2B_TEST_RESULTS.md` for timestamps, failed/interrupted attempts and limitations.

## Hostinger result and architecture

**Current purchased-plan entitlement/resources: UNKNOWN.** The owner already selected the browser's **Unlimited** plan; that choice is preserved. The connector returns an older/different Business v3 inventory. During read-only discovery the actual official `https://hpanel.hostinger.com/` was verified before interaction but remained on a loading screen. No settings were changed and no deployment target was created.

Recommended conditional architecture: eligible Hostinger managed Node serving the React bundle and Nest API at one HTTPS origin, **external managed PostgreSQL**, **private durable object storage**, HTTPS revision polling, and separate local Windows/Android LAN integration. No Supabase production service or MySQL migration was introduced.

[Official managed Node limits](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/) exclude incoming WebSockets, custom ports, Docker and independent endless workers. [Deployment documentation](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/) describes eligible Node/Nest deployments; [database documentation](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/) distinguishes included MySQL from external PostgreSQL. These general documents do not verify this account's remaining quota. See `TAHA_POS_DEPLOYMENT_DEPENDENCIES.md` for the precise resource and owner-action gates.

## Boundaries and next work

Verified localhost remains available at `http://127.0.0.1:1423/dashboard`, with real API `http://127.0.0.1:3306/api/v1`, deep readiness `ready` and all **68/68** migration checksums matched. This is an isolated loopback sample fixture, not saved shop data or a phone LAN claim.

No daily-shop production claim, cloud deployment, real payment-gateway settlement or physical hardware acceptance is made. Windows MSVC/SDK/native EXE/installer and native SQLite offline/online acceptance remain outstanding. Android remains the existing test APK/source (version code 10, 0.5D.2 test build); no new APK was built. Newly added shared frontend polling changes have not yet been shipped in a rebuilt APK/EXE. Corrupt-photo queue isolation, process-death camera recovery and production signing remain separate work. Physical printer, HID scanner, second monitor and LAN-without-internet acceptance remain unverified. Repair-job material consumption/deposits/settlement and expense-adjusted net profit are not completed by revisions alone.

The next bounded phase is **R2C — approved isolated Hostinger staging deployment and real-provider acceptance**: confirm selected-plan entitlement/proxy, approve domain/PG/bucket, verify their actual capabilities, deploy synthetic staging, then test shared desktop/mobile sessions, uploads, polling/restart and backup restoration. Keep native/media recovery and repair-accounting completion as separate controlled production gates. Do not repeat R2A or redesign the POS.
