# R3A implementation plan — source control and Android releases

> Execute task by task with test-driven verification. This is the owner's approved R3A specification translated to the existing repository; it is not authorization for a new design or production launch.

## Current instructions and design decisions

- **Owner amendment:** repository owner is **jasonyade10techies-web**. Owner selected this account on November 14 after confirming the browser/CLI identity.
- **Owner amendment:** hosting is manual. Do not deploy, configure Hostinger, connect accounts, change DNS or enable auto-deployment. Supply prepared artifacts and exact owner instructions.
- Preserve `0b00883a179e772b513d4557f8c54d422254e6aa`, earlier R1/R2 baselines, media service, PostgreSQL transactions, saved databases and release archives. Work on `codex/r3a-release-system` in the existing requested checkout; private toolchains and fixtures stay in place.
- One private source monorepo. No APK/keystore/runtime data in ordinary source history. Release artifacts belong to approved private GitHub releases/Actions and generated distribution packages.
- Separate tracks: a database-independent Android download app, and the existing React/NestJS POS. Manual hosting of downloads does not require PostgreSQL. Full POS keeps external PostgreSQL/private business storage and HTTPS polling.
- Preserve existing test-app signing continuity. Stable signing and a stable package are separate controlled configuration; no silent debug→stable certificate change.
- Public software metadata/bytes have no business records or admin upload endpoint. Only the approved release process creates them. No live URL is invented.

## Architecture and approaches

Use a small shared Node distribution handler for permanent download-page, latest-manifest and versioned APK routes. It runs alone without a database, or mounts ahead of the existing NestJS SPA fallback. Locally/CI generate a release directory only after validating the real APK's package/version/size/hash/certificate; publish metadata last. The owner uploads/imports the prepared application. Future Hostinger native Git deployment is documented, but stays unconfigured.

Private GitHub release assets are not assumed public. An approved Android workflow builds/signs/verifies and produces a complete download-site package. Publishing to a public Hostinger domain remains an owner operation. An optional future automated deploy requires verified account/branch gates and credentials; no speculative uploader or broad account token is installed.

For native updates, retain the bundled Java/WebView app. One centralized updater checks an HTTPS download origin, validates metadata, downloads to app-private storage, checks exact bytes plus the installed package/signing identity, and opens Android's installer only after user action. Device/pairing/receipt QR contracts remain separate.

## Shared release contract

Manifest JSON: `schemaVersion:1`, `channel:'test'|'stable'`, `applicationId:string`, `versionName:string`, `versionCode:positive integer`, `apkUrl:same-origin relative /downloads/taha-staff/apks/...apk`, `sizeBytes:1..67108864`, `sha256:64 lowercase hex`, `signingCertificateSha256:64 lowercase hex`, `releasedAt:ISO date`, `minAndroidApi:integer`, `minBackendApiVersion:integer`, `required:boolean`, `releaseNotes:string[]`, optional `sourceCommit:40 hex`.

Routes: `/downloads/taha-staff`, `/downloads/taha-staff/releases/test.json` (and stable), `/downloads/taha-staff/latest.apk?channel=test`, immutable `/downloads/taha-staff/apks/<channel>/<code>/<filename>.apk`. Manifest/page are no-store; APK is immutable. An unconfigured channel is unavailable, not an invented release.

Native bridge contract: `configureUpdates(origin:string):boolean`, `checkUpdates(backendApiVersion:number):void`, `downloadUpdate():void`, `installUpdate():void`, `cancelUpdate():void`, `updateStatus():string`. Native class `AppUpdater(Activity,WebView,BooleanSupplier)` owns network/installer state and emits `taha-app-update` with JSON status. State includes current package/version/certificate, `state`, optional `latest` manifest, progress/error code. States: idle/not-configured/checking/current/available/incompatible/downloading/downloaded/permission-required/installer-opened/cancelled/error. Root owns integration into ShopBridge/MainActivity/React; native implementer edits only new updater classes and their new JVM tests.

## Task 1 — safe source publication

Files: `.gitignore`, optional focused `.gitleaks.toml`, `scripts/security/*`, owner setup documentation.

- [x] Inspect all tracked files/history with redacted secret scanning, preserve evidence, review findings rather than blanket-ignore tests.
- [x] Verify/create **private** `jasonyade10techies-web/taha-pos` only using that account's authorized access. Verify permissions and existing content before any push; never force-push.
- [x] Preserve recovered Git history; establish `main`/`staging` only from a verified commit. Check branch-protection capability; document unavailable enforcement rather than claiming it works.

## Task 2 — local release manifest and download app

Files: `distribution/*`, `scripts/android-release.mjs`, `scripts/package-downloads.mjs`, Node tests under `scripts/test/*`; mount adapter under `server/src/releases/`.

- [x] Write failing tests for invalid metadata, identity/version/hash mismatches, missing bytes, immutable collisions, interrupted publication, traversal, anonymous delivery, caching and database-independent startup.
- [x] Validate actual APK metadata/signature with Android tools, retain old approved APK and publish atomically to generated output under `artifacts/`.
- [x] Implement the standalone assigned-port server and optional existing-Nest mount; no uploads/admin control or private data exposed.
- [x] Validate downloaded bytes, Content-Type, filename, manifests, route refresh and rollback locally.

## Task 3 — native Android updater

Files: new `AppUpdater.java`, `UpdatePolicy.java`, related JVM tests. Integration: `ShopBridge.java`, `MainActivity.java`, Android manifest/provider paths.

- [x] TDD metadata/URL/compatibility/hash/anti-downgrade policy, cancellation, concurrency and retry.
- [x] HTTPS only, bounded requests/downloads, same-origin redirects, no authentication-cookie forwarding, app-private files; revalidate package/certificate/version/hash immediately before installer.
- [x] Check installed certificate through PackageManager; no trust in manifest certificate alone. Handle unknown-source permission, cancellation and installer failures honestly.
- [x] Do not clear session/photo queues; block installation while native camera/scanner work is active. No silent installation or forced downgrade. Preserve verified APK across ordinary Activity recreation where possible.

## Task 4 — compact desktop and mobile release UI

Files: `src/lib/releases/*`, `src/features/mobile/app-updates-page.tsx`, mobile settings/routes, a small Devices download panel and compact Dashboard entry.

- [x] TDD current/new/offline/malformed/incompatible/missing-origin states; unverified metadata never marks a phone outdated.
- [x] Show native progress and user-driven install; defer installation while a sale/camera operation is active. Check at launch/settings with backoff, not every few seconds.
- [x] Download-page QR is explicitly installation, independent from pairing and receipt QR. Reuse existing neutral tokens/branding/components; no redesign.

## Task 5 — reproducible CI, signing and manual release

Files: `.github/workflows/*`, `scripts/ci/*`, Android version/signing configuration and build tooling.

- [x] PR checks: Node22, types/lint/build, both browser profiles/PDF tooling, full backend and financial tests, ephemeral PostgreSQL17, SQLite, secret/history scan and package inspection. Cache dependencies without caching secrets/runtime databases.
- [x] PostgreSQL service uses loopback55459, `taha_phase5c`, and PGDATA suffix `.test-postgres/phase5c-20261014/pgdata` so existing safeguards remain effective. Resolve PostgreSQL executables portably; never weaken guards with `CI=true`.
- [x] Manually approved Android release only; enforce a committed increasing version, require the intended channel signing secret, assemble/test/lint/verify, generate checksum/manifest/site package and retain known-good releases. PR APKs are validation-only and are not published as updates.
- [x] Private release publication remains draft until all uploaded bytes/metadata match. No Hostinger deployment step while the owner's manual-hosting amendment applies.
- [x] Add a Git-root full-stack build entry matching existing source paths and assigned PORT. Migrations remain a separate explicit command.

## Task 6 — Claude/Graphify handoff

Files: `docs/CLAUDE_DESIGN_TAHA_POS_HANDOFF.md`, `docs/TAHA_POS_CLAUDE_GRAPHIFY_HANDOFF.md`, optional local graph evidence.

- [x] Verify actual Graphify installation/provenance/dependencies. Only a fully local code/AST index with explicit source allowlist is acceptable; no source/docs/media sent to hosted inference, no config/AGENTS/CLAUDE overwrites.
- [x] Map exact routes/components/tokens and safe synthetic screenshots. Distinguish browser/mobile emulation from real Android screenshots. Proposal/audit first; no Claude review is claimed unless performed.

## Acceptance and review focus

1. Wrong GitHub account / unavailable private-branch protections must block the affected remote action.
2. A missing/malformed manifest or offline server must leave installed compatible functionality usable.
3. A bad hash, package, certificate, version, redirect or partial upload cannot replace the last approved release.
4. Installer approval/recreation must preserve sessions, drafts and private photo queues; physical installation remains a separate gate.
5. A download-only site must start without DB credentials and never expose the full POS as if configured.

Keep a task/evidence ledger in `docs/r3a/IMPLEMENTATION_LEDGER.md`; mark each test fresh/historical and each external step prepared/verified/blocked. Final documents: this plan, Android release system, Claude/Graphify handoff, implementation report, Claude Design handoff and practical owner setup. Final branch review follows integration; never claim hosting/publication/hardware success from local tests.

Implementation boxes denote prepared source and local verification. They do not mean hosting, physical installation, branch protection or signed CI publication is active. See the final report for the actual GitHub plan restrictions and external gates.
