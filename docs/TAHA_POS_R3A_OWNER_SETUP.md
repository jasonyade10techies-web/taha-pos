# R3A owner setup — manual hosting

Nothing in this document means hosting has been configured. Do not create a public source repository or upload signing keys to a website.

## First: Android downloads only

Use the generated **Taha-Staff-downloads-test-13.zip**, not a source ZIP and not the full POS staging ZIP. Its exact path is `artifacts/android-release-R3A-build13/Taha-Staff-downloads-test-13.zip`; checksums and the private GitHub draft are recorded in the R3A report.

1. hPanel → Websites → Create site/Web App → upload the download ZIP into an unused app/temporary domain.
2. Select a supported Node22/24 runtime. Build command `npm run build`, start command `npm start`, entry `server.mjs`. Let Hostinger assign `PORT`; do not configure the LAN port.
3. Confirm HTTPS, then open `/downloads/taha-staff` and `/downloads/taha-staff/releases/test.json`.
4. Download the APK and compare SHA256 with the supplied checksum. Install over the existing TEST app, without uninstalling.
5. In Taha Staff → Settings → App Updates, set this HTTPS origin if it differs from the shop API. Pairing still uses the shop backend.

To show a separate download website in the full POS, set its HTTPS origin as frontend build variable `VITE_ANDROID_DOWNLOAD_ORIGIN` and backend runtime `ANDROID_DOWNLOAD_ORIGIN`; otherwise hosted POS uses same-origin download routes. No business credential is sent to the download site.

This track requires no database, login secret, storage bucket or customer data. A source-only `distribution/` Git import starts a valid unavailable page until approved release bytes are supplied. Private GitHub release assets are not anonymous public downloads. Uploading the generated complete ZIP is the supported manual path.

## Later: full POS staging

Use an isolated staging Web App and the versioned managed POS package, or import this private monorepo. For a source-root import: Node22.13+ or24, install root and `server/` dependencies; build `npm ci --prefix server && npm run build:hostinger`; start `npm run start:hostinger`, entry `server/hostinger.cjs`. Do not use Vite preview for hosted production-style operation.

Configure nonpublic hosting environment controls from `server/.env.managed.example`: `NODE_ENV=production`, `TAHA_RUNTIME=cloud`, `TAHA_DEPLOYMENT_ENV=staging`, approved HTTPS `FRONTEND_ORIGIN`/`PUBLIC_API_URL`, restricted TLS PostgreSQL `DATABASE_URL`, JWT secret and private S3-compatible settings. Never put secrets in `VITE_*`. Use a separate migration identity only in the guarded migration process; `MIGRATE_ON_START=false`.

Verify the actual plan's Node entitlement, slot/resource limits, temporary domain, filesystem persistence and logs yourself before deploying. Do not rely on local preparation as evidence of a live cloud service. The custom PostgreSQL engine remains; Hostinger MySQL is not a substitute. Permanent private media belongs in verified durable object storage. Cloud correctness uses HTTPS revision polling, with the LAN bridge independent.

Run guarded migrations/one-time owner initialization against a newly approved staging database, with synthetic records only. Verify deep readiness, session renewal, shared desktop/mobile data, transactions, uploads surviving restart/redeploy and backup/restore. No default test-owner password belongs in hosting. First-owner bootstrap must be closed after initialization.

## GitHub and releases

Private repository: `https://github.com/jasonyade10techies-web/taha-pos`. Main/staging are controlled release targets; feature branches use PRs. Until the owner approves/merges the R3A PR, these branches retain the earlier verified baseline; use the tested ZIP or explicitly select `codex/r3a-release-system` for the new source build. Review the actual CI run before merging. Required checks/branch protection depend on the account's verified plan and must not be assumed from workflow files.

Use Actions → Approve Android test release only after reviewing version, test results and release notes. Configure approved signing secrets in a restricted environment using GitHub's secure UI/CLI; do not send them in chat. No Hostinger token or automatic hosting deployment is configured. Check the final R3A report for actual protection/CI status and remaining access blockers.

## Launch gates

Hosted browser staging, native Android acceptance, Windows native/offline acceptance, physical printer/scanner/second-screen tests and complete repair accounting are distinct gates. A working download website is not a live, production-certified POS.

Official hosting reference: [Hostinger Node.js Web Apps](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/). Exact account capabilities remain subject to owner verification.
