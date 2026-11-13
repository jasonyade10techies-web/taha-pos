# R2C — Hostinger staging preparation and deployment gate

Evidence date: 13 November 2026. **NOT DEPLOYED. There is no accepted public Taha staging URL.** This document distinguishes local acceptance from a real hosting deployment.

Local R2C release implementation: `5f35b1884dedab4aa5c9ce1c441639216900ddb6`, branch `codex/r2c-hostinger-staging`. Final clean-source package: `artifacts/managed/Taha-POS-staging-R2C-0.5.0-r2c.1-20261113T101355.zip` (1,903,648 bytes), SHA256 `8c0c9dc04f615685722e086faed5a38e20ac83dd82c5ae01b6dd5a3a6f7d3d19`. Full frontend 187 pass/one intentional skip, backend 269 pass, final packaged fresh-shop 25/25 pass. This is **ready for the next real-provider validation step**, not accepted cloud operation or production readiness.

## Confirmed decisions and account access

- Preserve the existing React/NestJS application, custom authentication, PostgreSQL financial functions, private MediaService, HTTPS revision polling and independent LAN Device Bridge.
- The owner confirms the purchased plan is **Hostinger Unlimited** and hPanel offers website/Web App creation and application upload. Exact Node.js entitlement, remaining slots, memory/process limits, deployment settings and trusted reverse-proxy addresses have **not** been independently verified.
- Fresh [official Hostinger limits](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/) explicitly list **Business/Unlimited: 5 Node.js websites, NPROC 120, entry processes 60**. Each app uses one long-running server; resources are shared and HTTP requests have a 120-second limit. Inbound WebSockets, custom ports, Docker/extra services and independent always-running workers are unsupported. This establishes the documented plan capability; it does **not** verify this account's remaining allowance or shared resource consumption.
- The authenticated connector still exposes an older Business-v3 inventory. It is not evidence about Unlimited. No existing website was changed and no temporary site was created.
- Browser inspection could not safely determine the current Windows browser URL. Computer Use stopped; account checks were not bypassed through another automation method. Reconnect Hostinger to the Unlimited account, or open that account's Node.js Web Apps allowance for a later verified browser session. No password/token needs to be sent in chat.
- The owner explicitly confirms **external PostgreSQL: NONE**, **private S3-compatible storage: NONE**. No resources or billing have been created by this phase.
- Neon now appears installed in Codex's plugin inventory. Installation does not establish an authenticated provider connection, approve a resource creation, or prove that a database/bucket exists. No Neon management tools were exposed in this session.

## Proposed resources — approval and real-provider verification still required

For isolated synthetic staging, the simplest proposed option is a **Neon Free** project for PostgreSQL and its private Object Storage, with Hostinger running the existing application. This is a compatibility recommendation, not a provider acceptance result.

Create only these resources after approval:

| Resource | Proposed name / setting | Purpose |
|---|---|---|
| Neon project | `taha-pos-staging`, Free, no paid add-ons | Isolated staging, never import the saved shop database |
| Region | Prefer Singapore if available for both services; verify Hostinger latency | Avoid unnecessary inter-region round trips |
| PostgreSQL | Version 17, database `taha_staging` | Match the locally tested engine major version |
| Empty base branch | `migrated-empty` | Migrate once; no owner or sample business history |
| Fresh-shop branch | `clean-shop` from that empty base | First-owner/setup acceptance |
| Transaction acceptance branch | `acceptance` from that empty base | Synthetic financial, outage and concurrency exercises |
| Runtime role | `taha_runtime`, created through SQL by the guarded migration process | Separate restricted identity; not the provider's administrator role |
| Private bucket | `taha-staging-private` on the matching branch | Originals, thumbnails and sensitive evidence, never public |
| Storage credential | Branch-scoped `taha-staging-media`, `storage:write` | Server-side read/write/delete; never bundled into React/APK |
| Hostinger application | One new isolated Node.js app, temporary HTTPS domain | Bundled frontend and `/api/v1` on the same origin |

Provider documentation checked on 13 November: [Neon pricing](https://neon.com/pricing) lists Free at $0/no card, 1 GB PostgreSQL and 100 CU-hours/month per project, plus 5 GB object storage. Exceeding the free compute/transfer allowance can suspend service; continuous polling can keep compute active. This is for bounded staging, not a daily-shop reliability promise. Paid compute is usage-based; obtain explicit budget approval before upgrading. A paid PostgreSQL tier plus private AWS S3 is an alternative for production, subject to pricing, backups and provider acceptance.

[Neon's S3 compatibility](https://neon.com/docs/storage/s3-compatibility) documents path-style AWS SDK access, browser form POST and CORS. These match the existing `server/src/media/file-storage.ts` contract on paper. **An actual signed POST, original/thumbnail retrieval, anonymous denial and restart/redeployment durability test are mandatory before acceptance.** Its versioning/lifecycle configuration is not enforced; independent object backups are necessary. Do not infer storage recovery from PostgreSQL branch history.

[Neon roles](https://neon.com/docs/manage/roles) warns that ordinary Console/API-created roles receive administrator membership. Keep the migration administrator private and use the existing SQL-created restricted role for the web app. [Storage authentication](https://neon.com/docs/storage/authentication) maps `token_id` to the S3 access key and `s3_secret_access_key` to the secret. Use the exact endpoint/signing region supplied for the chosen branch; do not guess the region from its marketing location.

Cloudflare R2 is **not a drop-in provider** for the current exact-size signed HTML form upload: [its documentation](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) states that multipart form POST is unsupported. A future bounded upload-protocol change would need security and media regression tests; it is not part of this setup.

## Secure connection procedure

1. Approve the provider/project and free staging scope. Authenticate through the provider/plugin screen. Do not send connection strings, passwords or keys in chat.
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
