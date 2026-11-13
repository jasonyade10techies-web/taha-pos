# R2C — Hostinger staging preparation and deployment gate

Evidence date: 13 November 2026. **NOT DEPLOYED. There is no accepted public Taha staging URL.** This document distinguishes local acceptance from a real hosting deployment.

Latest locally accepted application: **`88b6076e3e6ab6940ab0cb96373ead9324193b46`**, branch `codex/r2c-hostinger-staging`, **`0.5.0-r2c.3`**, ZIP `artifacts/managed/Taha-POS-staging-R2C-0.5.0-r2c.3-20261113T121256.zip`, SHA256 `9dcaf3097a4303343648c5d66c6668d8e3d84d34c2e9dd68b69f662b372985d3`. Backend 279/279, final packaged fresh-shop 25/25, actual Neon 69 migrations and private storage transport checks pass. The full isolated frontend rerun is recorded in the cloud test report. No hosted application or production acceptance is implied. Historical `.1`/`.2` artifacts remain preserved; `.2` predates the fixed setup-navigation race.

## Confirmed decisions and account access

- Preserve the existing React/NestJS application, custom authentication, PostgreSQL financial functions, private MediaService, HTTPS revision polling and independent LAN Device Bridge.
- The owner confirms the purchased plan is **Hostinger Unlimited** and hPanel offers website/Web App creation and application upload. Exact Node.js entitlement, remaining slots, memory/process limits, deployment settings and trusted reverse-proxy addresses have **not** been independently verified.
- Fresh [official Hostinger limits](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/) explicitly list **Business/Unlimited: 5 Node.js websites, NPROC 120, entry processes 60**. Each app uses one long-running server; resources are shared and HTTP requests have a 120-second limit. Inbound WebSockets, custom ports, Docker/extra services and independent always-running workers are unsupported. This establishes the documented plan capability; it does **not** verify this account's remaining allowance or shared resource consumption.
- Earlier, the authenticated connector exposed an older Business-v3 inventory; Hostinger hosting tools are no longer exposed in the current session. The live plugin search currently finds only Hostinger Mail, which cannot verify/deploy Node Web Apps. It is not evidence about Unlimited. No existing website was changed and no temporary site was created.
- Browser inspection could not safely determine the current Windows browser URL. Computer Use stopped; account checks were not bypassed through another automation method. Reconnect Hostinger to the Unlimited account, or open that account's Node.js Web Apps allowance for a later verified browser session. No password/token needs to be sent in chat.
- The owner initially confirmed no external resources existed, then explicitly approved **Free staging only**. The Neon Free project/database and private bucket have now been created and verified as described below. No paid resources, Hostinger website or DNS change occurred.
- Neon plugin installation is now verified in the live inventory and tools are exposed; initial read-only calls return `Unknown tool`. CLI 9.4.0 is authenticated in the named `taha-staging` profile using Windows keyring. Provider verification below uses actual CLI/API/database/storage requests, not an assumed working MCP connection.

## Approved Free resources — created and provider-tested

The owner approved project `taha-pos-staging`, database `taha_staging` and private bucket `taha-staging-private`, synthetic data only, no paid add-ons. The actual organization reported `plan=free` before project and acceptance-branch creation. CLI sign-in completed securely. Existing environment files, Codex user configuration and default CLI profile were preserved.

| Resource | Actual state |
|---|---|
| Project | `taha-pos-staging`, Free organization |
| Region | Singapore `aws-ap-southeast-1` |
| PostgreSQL | Version 17; `taha_staging`; all **69** current migrations applied through the guarded runner |
| Base branch | `main`, empty migrated shop; zero owners/products/customers/sales/movements |
| Migration identity | `taha_migration`, provider administrator, not superuser |
| Runtime identity | SQL-created `taha_runtime`, NOINHERIT, no superuser/RLS bypass/CREATEDB/CREATEROLE |
| Private bucket | `taha-staging-private`; provider confirms private access |
| Real storage checks | **4/4**: signed CRUD/private denial, exact-size POST 204/readback, oversize 400, changed-key 403 |
| Acceptance branch | `r2c-acceptance-20261113` created from empty `main`; synthetic owner/activity only; actual API financial/media 10/10 and auth 3/3 pass. `main` remains empty. |
| Hostinger app/domain | Not created/deployed; no public staging URL |

Two real managed-provider blockers were corrected: restricted role provisioning no longer attempts a superuser-only ALTER, and TLS readiness verifies the actual authorized live client socket/certificate hostname instead of the proxy's internal `pg_stat_ssl` hop. No insecure TLS fallback or financial SQL change was introduced. Full backend 279/279 passes. See `NEON_AGENT_SETUP_2026-11-13.md` for tooling/configuration changes.

Private credentials are held outside the repository in owner-only storage and Windows keyring, not in frontend `VITE_*`, reports, source control or the application ZIP. No Neon Auth, Functions, Data API, Realtime or AI Gateway was enabled; NestJS custom authentication and HTTPS polling remain intact.

Provider documentation checked on 13 November: [Neon pricing](https://neon.com/pricing) lists Free at $0/no card, 1 GB PostgreSQL and 100 CU-hours/month per project, plus 5 GB object storage. Exceeding the free compute/transfer allowance can suspend service; continuous polling can keep compute active. This is for bounded staging, not a daily-shop reliability promise. Paid compute is usage-based; obtain explicit budget approval before upgrading. A paid PostgreSQL tier plus private AWS S3 is an alternative for production, subject to pricing, backups and provider acceptance.

[Neon's S3 compatibility](https://neon.com/docs/storage/s3-compatibility) documents path-style AWS SDK access, browser form POST and CORS. The real S3 transport and exact-size POST checks now pass against `server/src/media/file-storage.ts`. Full MediaService thumbnail/completion through a hosted browser, exact-domain CORS and restart/redeployment durability remain mandatory; the transport probe alone is not hosted media acceptance. Its versioning/lifecycle configuration is not enforced; independent object backups are necessary. Do not infer storage recovery from PostgreSQL branch history.

[Neon roles](https://neon.com/docs/manage/roles) warns that ordinary Console/API-created roles receive administrator membership. Keep the migration administrator private and use the existing SQL-created restricted role for the web app. [Storage authentication](https://neon.com/docs/storage/authentication) maps `token_id` to the S3 access key and `s3_secret_access_key` to the secret. Use the exact endpoint/signing region supplied for the chosen branch; do not guess the region from its marketing location.

Cloudflare R2 is **not a drop-in provider** for the current exact-size signed HTML form upload: [its documentation](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) states that multipart form POST is unsupported. A future bounded upload-protocol change would need security and media regression tests; it is not part of this setup.

## Secure connection procedure

1. Free staging resources and CLI sign-in are complete. Reuse the existing project and private bucket; do not recreate them. Verify the target branch before each mutation and create clean acceptance branches from the empty base. Do not enable paid resources or add-ons. Do not send connection strings, passwords or keys in chat.
2. Record only nonsecret project/branch/bucket names in this report. Keep connection details in an owner-only local secret file outside the repository or directly in hPanel environment controls. Never put them into `public`, build-time `VITE_*`, the ZIP or screenshots.
3. Obtain a **direct administrator** PostgreSQL connection for the separately run migration job and a distinct restricted runtime connection. Use verified TLS. Start with `DATABASE_POOL_MAX=2`; pooled-hostname differences require the explicit `TAHA_STAGING_RUNTIME_HOST` guard. Verify transaction-local actor identity/RLS through that actual pooler.
4. Use the release's `environment.example`. Configure normal web runtime: `NODE_ENV=production`, `TAHA_RUNTIME=cloud`, `TAHA_DEPLOYMENT_ENV=staging`, `TAHA_SERVE_FRONTEND=true`, exact HTTPS `FRONTEND_ORIGIN` and `PUBLIC_API_URL`, `DATABASE_URL`, a random persistent `JWT_SECRET`, `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Hostinger assigns `PORT`. Determine `TAHA_TRUST_PROXY` from verified hosting information; never set trust-all or disable TLS verification.
5. Outside normal web startup, set `MIGRATION_DATABASE_URL`, exact `TAHA_STAGING_DATABASE_NAME`, `TAHA_STAGING_DATABASE_APPROVED=true`, and run **`npm run migrate:staging`**. The expected registry is now **69** migrations, including the R2C initialization marker; verify actual packaged checksums. The R2B count of 68 is historical.
6. For the fresh-shop branch, privately set `INITIALIZE_SHOP_APPROVED=true`, `PROVISION_EMAIL`, `PROVISION_NAME`, `PROVISION_PASSWORD` and run **`npm run initialize:staging`** once. Supply a unique password of at least 12 characters. This creates the first owner only, zero business activity, and an immutable closed-bootstrap marker. It is a trusted administration command, not public self-registration. Never run `seed:staging` in the clean-shop branch.
7. Remove the administration connection, initialization approval and owner credentials from the web application's environment. Normal runtime has no permission on the bootstrap marker. Login with the privately chosen owner account and complete `/setup`.
8. Configure bucket privacy and CORS for the exact approved HTTPS origin, POST and required upload fields. Do not enable public listing/reads. Do not distribute the server's storage credential to browsers. The application issues narrowly scoped, short-lived upload authorizations and private media access.
9. Verify deep authorized readiness, real provider roles/TLS, direct POST completion/idempotency/privacy, all cloud transactions, two browser sessions, restart/redeploy persistence, backup and isolated restore before declaring staging accepted.

Do not execute any step against saved shop records or an existing production site. Database administration and setup are never automatically run by HTTP requests or application startup.

## Hostinger deployment gate and rollback

Reuse the versioned R2C package's `server.cjs`, compiled backend/tools, `public` bundle, manifest, safe environment example and existing R2B smoke/runbook scripts. Verify the final artifact source commit, clean worktree, hashes and archive privacy before upload. A candidate built from an uncommitted tree is not accepted provenance.

Confirm Node 22 or another supported compatible version, a free application slot, platform-assigned listener, HTTPS termination and request/upload/time limits on the actual Unlimited account. No inbound cloud WebSocket or independent worker is required for correctness; durable HTTPS polling is authoritative. Managed hosting's local deployment directory is not permanent media storage.

The current [official deployment guide](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/) lists NestJS, Node 22/24, archive upload and a temporary `hostingersite.com` domain. For the precompiled package, select **Other**, package root, entry **`server.cjs`**, and the package's verification build command. This remains subject to actual hPanel acceptance and Linux dependency installation; no completed upload is implied.

After resources and target are verified, create a **new** temporary-domain application and use the supported ZIP/Git upload path. Do not change live DNS, overwrite another site, push private Git publicly or purchase resources. No such deployment occurred during preparation.

Rollback keeps the previous verified application ZIP and private configuration, stops new writes if a financial/schema issue appears, and redeploys the compatible prior release. Never delete or blindly downgrade financial data. Back up and rehearse restoration to a separate target first. Original media requires its own integrity-checked recovery copy.

See `TAHA_POS_R2C_CLEAN_SHOP_ACCEPTANCE.md` and `TAHA_POS_R2C_CLOUD_TEST_RESULTS.md` for local evidence and explicit untested cloud gates.

## Managed PostgreSQL restore note

The first actual Neon empty-schema restore passed after excluding exactly two provider-owned `cloud_admin` default ACL TOC entries and applying three retained owner-sequence grant statements. Application ACLs/RLS were retained and compared by effective permissions; ten tables and constraints match. Use the retained dump, reviewed TOC, SQL grant sidecar, permissions snapshot and CA bundle as one recovery set. Never use a blanket `--no-acl` workaround. This is not populated financial/media or offsite backup acceptance. Exact evidence is in the R2C cloud test report.

Actual restricted-pooler financial/media API acceptance now passes 10/10 on the separate synthetic branch; refresh/logout/replay checks pass 3/3. Populated PostgreSQL and three private photo-object recovery rehearsals pass. These used a local production-mode API against real providers; public Hostinger HTTPS, proxy settings, browser CORS, two internet browser sessions and hosting restart/redeployment remain unverified. No staging URL exists.
