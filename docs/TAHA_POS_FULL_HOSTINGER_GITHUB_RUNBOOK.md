# Full Taha POS Hostinger/GitHub staging runbook

14 November 2026. **Combined Node/NestJS + React; no PHP backend. No deployment has been performed by these instructions.** Source remains private. No real shop database or customer media may be imported into staging.

## Existing resources — no new purchase required for staging

- GitHub: `jasonyade10techies-web/taha-pos`, private.
- Neon Free PostgreSQL: `taha-pos-staging` / `taha_staging`, PostgreSQL17, `aws-ap-southeast-1`. Existing empty base and separate synthetic acceptance branch. Current registry is **69 matching migrations**; compute the live manifest before future changes.
- Neon private S3: `taha-staging-private`, existing branch-scoped storage credentials. Verified exact-size signed POST compatibility and private access. Separate software objects live strictly under `software-releases/v1/`.
- Hostinger: owner-selected **Unlimited**, Node onboarding observed, actual remaining slots/memory/proxy/logging controls still require confirmation in that account. The selected candidate is `maroon-louse-575853.hostingersite.com`, not yet a verified deployed POS.

One provider for PostgreSQL and private S3 is presently the simplest compatible staging option because both contracts have been tested. Preserve NestJS authentication/permissions, PostgreSQL functions/RLS and revision polling. No Neon Auth, Functions, Supabase backend or MySQL migration is necessary. Free staging is not a production availability/capacity commitment.

## Connect the existing private repository

Owner steps in the official `https://hpanel.hostinger.com`:

1. Select the actual Unlimited plan → Websites / Web Apps → Node.js app, using its existing onboarding slot where applicable. Confirm that Node22/24 is offered and an app slot is available; do not purchase an add-on.
2. Choose the temporary staging domain. Keep production DNS unchanged.
3. Choose **Import your Git repository**, connect GitHub as `jasonyade10techies-web`, and authorize Hostinger for **only** private repository `taha-pos`. Use the Node Web App flow, not generic PHP Git deployment.
4. Select the reviewed dedicated **`staging`** branch and repository root `/`. It still needs promotion from the accepted feature branch; do not deploy the old baseline or connect an actively changing feature branch as production.
5. Select Node **22**, framework NestJS/Other as supported. Install command where separately exposed: `npm ci && npm ci --prefix server`. Build: `npm run build:hostinger`. If hPanel automatically installs root packages and exposes only one build field, use `npm ci --prefix server && npm run build:hostinger`. Start: `npm run start:hostinger`; if it requires a startup file, use **`server/hostinger.cjs`**. Do not start Vite or force a custom port. The process uses assigned `PORT`, listens `0.0.0.0`, serves `dist-staging` and `/api/v1` together.
6. Add private environment values using Web App settings. Never commit/upload a real `.env` or place it in the web bundle. Obtain actual trusted reverse-proxy IP/CIDR from Hostinger, not a wildcard.
7. Deploy only the accepted commit. Confirm HTTPS, private logs, `/api/v1/health/live`, readiness, nested routes and authenticated operations. A platform “build complete” message is insufficient.

The account access step is deliberately manual: Computer Use ended on URL verification failure, and the owner prohibited control of the PC/browser. No passwords, tokens, database URLs or storage keys should be sent in chat.

## Required runtime configuration

Use `server/.env.managed.example` or `scripts/managed-release/environment.example` as **nonsecret field lists**:

```text
NODE_ENV=production
TAHA_RUNTIME=cloud
TAHA_DEPLOYMENT_ENV=staging
TAHA_SERVE_FRONTEND=true
TAHA_BIND_HOST=0.0.0.0
PUBLIC_API_URL=https://<actual-staging-domain>
FRONTEND_ORIGIN=https://<same-staging-domain>
TAHA_TRUST_PROXY=<verified exact hosting proxy IP/CIDR>
DATABASE_URL=<restricted pooled staging connection, verified TLS>
DATABASE_POOL_MAX=2
JWT_SECRET=<random secret, at least 32 random bytes>
STORAGE_DRIVER=s3
S3_ENDPOINT=<approved HTTPS S3 endpoint>
S3_REGION=<provider region>
S3_BUCKET=taha-staging-private
S3_ACCESS_KEY_ID=<private scoped credential>
S3_SECRET_ACCESS_KEY=<private scoped credential>
MOBILE_APP_ORIGIN=http://localhost
MIGRATE_ON_START=false
```

`PORT` belongs to Hostinger. `ANDROID_DOWNLOAD_ORIGIN` normally stays empty for same-origin downloads. Do not put migration/bootstrap/signing credentials into the ordinary Node process. Never set `NODE_TLS_REJECT_UNAUTHORIZED=0`, wildcard credentialed CORS, or trust-all proxy settings. Do not invent infrastructure values from examples. See protected local `C:\Users\hassa\.taha-private-recovery\R2C-neon-auth-20261113` for already-approved provider resource configuration; those files are not deployment artifacts.

Private media originals/thumbnails and all permanent software objects remain outside deployable directories. The public portal serves only verified installer assets through `/downloads`; object credentials and private payment/customer files remain protected. Keep cloud polling enabled; incoming cloud WebSockets, Docker, custom ports and independent always-on workers are not assumed. LAN pairing/camera remains separate.

## Migrations and fresh owner setup

Use the current compiled guarded tools separately from normal startup. The source-root build produces `server/dist-tools/scripts/migrate-staging.js` and `initialize-staging.js`; the immutable combined ZIP exposes equivalent `npm run migrate:staging` and `npm run initialize:staging` commands. Use a privately stored administration environment with the exact approved database/host and explicit staging flags. Existing matching migrations do not need destructive reapplication.

Create a verified PostgreSQL custom-format backup before migration and retain media/release objects separately. Rehearse restore into a separate disposable branch/database. Do not down-migrate accounting data or overwrite a financial database to roll back code.

The empty base currently has no owner. Owner must choose first email/name/password privately. `initialize-staging` requires `INITIALIZE_SHOP_APPROVED=true`, `PROVISION_EMAIL`, `PROVISION_NAME`, `PROVISION_PASSWORD`, approved staging target and privileged migration identity. It refuses existing users/business activity, transacts under an advisory lock, creates **no products/customers/sales/stock**, and permanently closes initial owner creation. Remove initialization secrets/flags from runtime immediately. There is no public owner-signup endpoint or hosted default test password.

First login opens the existing setup wizard: identity, mode/modules, storage, payments/receipts/tax0 and optional devices. Finish into an empty Dashboard. Verify first product/category/brand/model, location, supplier/stock receipt, sale/invoice/customer/credit/collection/return. Revisit setup without resetting records. Run seeded sample activity only in a separate synthetic acceptance branch.

## Controlled GitHub deployment/release automation

- `ci.yml`: frontend/backend/release/SQL/SQLite/build/packaged checks and Android validation; no publishing.
- `promote-staging.yml`: owner-only **manual approval of the exact commit**, full CI first, then fast-forward-only update of `staging`. A configured Hostinger Git connection redeploys that accepted branch. It does not migrate databases, modify DNS or merge failing work. A prior review is still required; GitHub Free private branch protection is currently unavailable.
- `windows-build.yml`: native compilation/test validation and artifacts on selected source changes; cached installers are removed only on the disposable runner. No signing key or publication on pushes.
- `windows-release.yml`: manual exact-source approval, reviewed signing environment, all regression/native jobs, signing, independent package/signature verification, private GitHub archive and conditional durable portal promotion.
- `android-release.yml`: manual approved test release, full checks, pinned Build13-compatible identity, verified private archive and durable APK/manifest promotion. Never uninstall Android to update.

New manual workflows must first exist on the default branch via reviewed source integration before normal Actions UI dispatch is available. Nothing here auto-merges the pending branch. The existing private Free GitHub account rejected required-reviewer environment protections; native publishing intentionally fails closed until an approved supported secret-custody/review mechanism exists. Do not solve this by making the repository public, purchasing silently or deleting approval checks. Local owner-controlled signing remains usable.

Private signing environment names: `windows-staging-release` / `android-test-release`, approved branches only. Windows secrets: `TAURI_STAGING_PRIVATE_KEY`, `TAURI_STAGING_PRIVATE_KEY_PASSWORD`. Android retains existing channel key secrets. Both release environments need scoped `SOFTWARE_S3_ENDPOINT`, `SOFTWARE_S3_REGION`, `SOFTWARE_S3_BUCKET`, `SOFTWARE_S3_ACCESS_KEY_ID`, `SOFTWARE_S3_SECRET_ACCESS_KEY`. These are hosting controls, not frontend `VITE_*` values. Never upload secrets to an unprotected environment.

An owner-controlled staging-only fallback command exists: `node scripts/promote-software.mjs <artifacts/.../release.json>`, with private `S3_*`, approved installed Android tools where relevant, and `TAHA_SOFTWARE_PUBLISH_APPROVED=staging`. It verifies executable bytes/signatures and signing continuity, writes immutable files/history, reads them back, and moves current metadata last with ETag compare-and-swap. It does not create a web deployment. Retry a failed promotion with the **same retained manifest/artifacts**, not regenerated metadata for the same version. A deliberate older-code rollback needs a separate approval plan; default publishers refuse downgrades.

## Acceptance and rollback

Before calling staging accepted: real HTTPS login/refresh/revocation, readiness schema/storage probes, shared desktop/mobile polling, first-run empty shop, cash/credit/split/linked service/returns/concurrency with persisted SQL assertions, private gallery upload/reload/redeploy, receipt, backend restart and backup restore. Browser mobile emulation is not APK acceptance.

Before daily use: actual Windows install/splash/SQLite offline launch/cash/outbox/reconnect/conflicts, Android install/cloud camera/resume/pairing, thermal/A4 printing, USB HID scanner, second-screen customer display, repair financial gaps, production signing, alerts/monitoring and scheduled restore-tested backups.

Rollback source: select a known-compatible previous accepted commit/package and retain the newer database/media. Never reset the DB or delete post-backup financial records. Immutable software releases/history remain available; current pointers are the only promotion metadata. Do not revoke existing staging signing identity or uninstall applications as a rollback shortcut.

Official references: [Hostinger Node deployment](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/), [Node limits](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/), [Neon S3 compatibility](https://neon.com/docs/storage/s3-compatibility), [Tauri updater](https://v2.tauri.app/plugin/updater/). General documentation does not verify the owner's remaining account quota.
