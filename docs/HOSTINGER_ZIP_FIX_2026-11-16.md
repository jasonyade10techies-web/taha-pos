# Hostinger ZIP deployment correction — 16 November 2026

## Actual failure

Inspected the owner's `C:\Users\hassa\Downloads\taha-pos-main.zip`: 2,327,055 bytes, 1,041 entries. Its root package builds `tsc -b && vite build`; TypeScript/Vite are development dependencies. It has a nested NestJS source package under `server/`, no `server/hostinger.cjs`, and no compiled backend. It is an older GitHub source snapshot, not the current combined deployment package. Hostinger's reported production-only install omitted the compiler, then default settings tried to run a nonexistent root backend entry. A frontend-only `dist` output also cannot represent the whole NestJS/React application.

The ZIP size was normal. The artifact type, source revision, dependency-install mode and startup settings were wrong together. Moving arbitrary compiler packages into runtime dependencies or deploying only `server/` is not needed for the chosen solution.

## Corrected artifact contract

The existing guarded managed packager builds React in real API mode and compiles NestJS locally or in CI. It includes runtime NestJS dependencies in root `package.json`/lockfile, compiled backend in `dist/`, compiled React in `public/`, migrations/administration tools, software download handlers, a byte/SHA256 manifest and root `main.js` entry. It contains no real environment file, database, private media, signing key, Windows-installed module binaries or `node_modules`.

`npm ci --omit=dev` installs the platform's runtime dependencies. `npm run build` verifies the already-compiled files using Node builtins; it never runs `tsc` or Vite. `npm start` runs `main.js`, which starts the same-origin API and bundled frontend through `server.cjs`. No source recompilation, root Git checkout, separate Vite process, custom port or background worker is required on Hostinger.

Relevant files: `scripts/package-r2b.mjs`, `scripts/managed-release/main.js`, `server.cjs`, `verify-release.cjs`, `README.md`; `scripts/test/managed-zip.test.mjs`; `scripts/ci/test-managed-package.mjs`; `.github/workflows/hostinger-zip.yml`.

## Settings for THIS compiled ZIP

| Field | Value |
|---|---|
| Application | Node.js Web App |
| Framework | NestJS; use Other only if needed to enter the explicit server settings |
| Node | 22.x, minimum22.13 |
| Package manager | npm |
| Root | `.` — `package.json` and `main.js` are directly at archive root |
| Install, if shown | `npm ci --omit=dev` |
| Build | `npm run build` |
| Entry file | `main.js` |
| Start command, if shown | `npm start` |
| Static output directory | Leave blank; retain the whole server package, not only `dist/` or `public/` |
| Port | Hostinger-assigned `PORT` |
| HTTPS origin | `https://spiral-darkblue-whale-43.hostingersite.com` |

These settings differ from GitHub **source-root** builds using `build:hostinger` and `server/hostinger.cjs`. Do not mix artifact types or reuse the old Vite static output settings. Secrets are imported separately from the protected staging environment file, never included in the ZIP or committed.

## Environment and proxy

The owner confirmed the new HTTPS domain; the private environment already uses it for `PUBLIC_API_URL` and `FRONTEND_ORIGIN`, retaining existing staging database/storage and JWT values. Supabase fields, native-build `TAHA_API_URL` and `VITE_MOBILE_SHOP_URL` are not required here.

The exact hosting proxy boundary remains an actual-host acceptance step. The package logs one `taha.proxy-observation` event on its first request: actual socket peer, whether TLS terminates in Node, normalized forwarded protocol and whether trust is configured. It does not log URLs, cookies, tokens, passwords or arbitrary forwarded header strings. It never automatically trusts the observed address. Verify the boundary before setting `TAHA_TRUST_PROXY`; no wildcard, invented private range or trust-all setting is introduced. Startup/liveness is distinct from full readiness.

## Verification gates

- Production-only entry/build/tamper regression: root startup succeeds without compiler executables in PATH; altered bundle bytes fail manifest verification. This is a packaging contract test, not a replacement for the real API acceptance.
- New package rehearsal uses installed production-only dependencies and actual assigned-port `main.js`, temporary HTTPS proxy, fresh disposable PostgreSQL and synthetic records. It covers authentication, empty-owner setup, first catalogue/receipt/sale, linked service accounting/idempotency, credit/collection, damaged/sellable returns, media/reload, polling, restart/outage recovery and isolated backup/restore. Results must be recorded from the new artifact, not copied from R3A history.
- A separate Ubuntu22-Node CI job exercises Linux production dependency installation and the same compiled ZIP. Local Windows rehearsal alone does not establish Hostinger/Linux acceptance.
- Native Windows/Android source, release signing, financial SQL, saved shop data and original GitHub ZIP are preserved. This manual ZIP correction does not imply a successful Hostinger deployment, production readiness or physical device acceptance.

Exact artifact name/hash and fresh results are appended after successful packaging. No failed test is removed or assertion weakened.
