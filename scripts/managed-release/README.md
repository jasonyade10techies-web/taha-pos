# Taha POS — managed staging package, not a deployed shop

One managed Node application serves bundled React and `/api/v1`. No Vite,
Docker, second application port, inbound cloud WebSocket, or worker is required.
The LAN device bridge remains a separate local integration.

Hostinger eligibility, proxy trust boundary, domain, external PostgreSQL and
private S3-compatible storage must be approved before deployment. This ZIP
contains no database, owner password, media originals, signing material or real
environment file. Do not put secrets in `public/` or `environment.example`.

Use Node 22.x (minimum 22.13). Upload this compiled ZIP, not the GitHub main source
ZIP. Package root contains package.json and main.js directly, without a parent
repository folder. Choose NestJS (or Other with these explicit server settings).
Root directory: . ; entry file: main.js ; start command: npm start.
Install command, if exposed: npm install --omit=dev.
Build command: npm run build (verifies the precompiled release).
The installer may normalize package-lock.json metadata. Its runtime package
versions, sources and integrity pins must still match the immutable, checksummed
release-lock.json. All application files remain verified byte-for-byte.
Output directory for the NestJS preset: . (a single dot). Keep the whole server package;
do not publish only public/ or dist/. PORT comes from the platform.
TypeScript/Vite are not required or executed on Hostinger for this package.
The cloud entry opens one listener before loading NestJS to meet Hostinger's
three-second listen deadline. Until the real API finishes initialization, all
requests return HTTP 503 with STARTING and Retry-After: 1. Readiness never reports
success during initialization. After initialization the same listener serves NestJS.
The root entry uses synchronous CommonJS require and literal require('http') so
managed loaders can observe listener registration. Do not replace this path with
dynamic import, node:http or process.getBuiltinModule: those can bypass loader hooks.
The NestJS preset currently writes PassengerStartupFile dist/main.js on the
verified hosting account. Both root main.js and dist/main.js contain compatible
bootstraps; the unchanged compiled NestJS exports live in dist/api.js.
Inject the blank-template variables through private hosting environment controls.
Native dependencies must install successfully on the actual Linux runtime.
For an unconfirmed hosting proxy, do not guess a CIDR or trust all. The first
request produces one private `taha.proxy-observation` runtime log containing the
actual socket peer and protocol status, without URLs, cookies or credentials.
Use that evidence with the hosting configuration to verify the trust boundary.
The log never changes security configuration automatically.

Migration is a separate, explicitly approved administration step:

1. Create a fresh dedicated staging database and migration login. Back it up.
2. Set staging approval, exact database name, migration URL and a distinct runtime
   URL privately. If using a different provider pooling hostname, explicitly set
   `TAHA_STAGING_RUNTIME_HOST`. Use verified TLS and the provider CA if needed.
3. Run `npm run migrate:staging` in an authorized bounded deployment job, or run
   the same compiled tool from a secure administration computer. Never per request
   or automatically at application startup.
4. For the **clean first-run shop**, do NOT run the sample seed. Privately supply
   `INITIALIZE_SHOP_APPROVED=true`, `PROVISION_EMAIL`, `PROVISION_NAME` and a new
   `PROVISION_PASSWORD`, then run `npm run initialize:staging` once. It creates
   only the authorized first owner and setup state, with zero business activity.
   Repeated initialization is refused. There is no public owner signup endpoint.
   Login opens Shop Setup; optional devices/modules do not block completion.
   Use `npm run seed:staging` only in a separate disposable sample database with
   explicitly supplied staging sample credentials, never in the clean scenario.
5. Remove migration credentials, seed password and approval variables from the
   normal web runtime. Never upload an administration secret file with this ZIP.
6. Confirm `/api/v1/health/live` and `/api/v1/health/readyz`, then sign in and call
   authorized `/api/v1/health/ready?refresh=1`. Readiness must be `ready`.
7. Run `node smoke.mjs https://APPROVED-STAGING-DOMAIN`. Use a short-lived access
   token via `TAHA_SMOKE_ACCESS_TOKEN` only for authorized deep diagnostics. Do not
   paste tokens in terminals shared with other users or retain them in logs.

The storage provider must support exact-size signed S3 form POST policies,
bounded GET/PUT/DELETE, private objects and the approved browser POST CORS origin.
R2/S3 compatibility must be proved against the chosen provider; the label
“S3-compatible” alone is insufficient. Application directories are replaceable.

Before each migration keep a verified PostgreSQL custom-format dump, the previous
release ZIP/hash, environment-version record and object-storage recovery copy.
Test restore into another isolated database. Never overwrite a live financial
database to roll back code. Prefer a compatible previous release or forward fix;
there are no automatic destructive down-migrations. Restore financial data only
under a separate approved recovery plan accounting for post-backup transactions.

No cloud or physical-device acceptance is implied by this package. The complete
project runbook is `docs/TAHA_POS_HOSTINGER_STAGING_RUNBOOK.md` in the source tree.
