# Cloud and Native Release Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Keep source/key/data boundaries explicit; do not repeat completed R2C/R3A work.

**Goal:** Prepare and verify the full cloud deployment and actual Windows staging installers with signed updater support, while preserving Android13 and current business logic.

**Architecture:** Existing React/NestJS combined Hostinger Node app; external PostgreSQL/private S3 media; HTTPS revision polling. Native Windows/Android bundle UI and use the same API. Software artifacts have a separate approved version/signature publication path.

**Tech Stack:** React/TypeScript/Vite, NestJS/PostgreSQL, Tauri2/Rust/SQLite, existing Java Android, GitHub Actions Windows/Linux.

**Spec:** `docs/TAHA_POS_CLOUD_NATIVE_RELEASE_DESIGN.md` and owner's corrected eight-priority request.

## Global constraints

- Preserve recovered source, private backups, Android13 signer and PostgreSQL financial invariants.
- No real customer records in staging, paid services, production deployment, automatic migration or unapproved access expansion.
- Installed UI remains bundled; API/data synchronization is independent of application updates.
- No personal-PC MSVC/SDK installation. No Hostinger UI automation after URL-confidence block in this turn.

## Review focus

1. Signing secrets must never enter Git, unprotected CI or public software metadata.
2. An unavailable cloud/API/storage provider must not masquerade as demo success.
3. Invalid version/path/hash/signature must prevent release promotion or installation.
4. Windows update installation must not interrupt an active counter sale or lose durable offline data.
5. Missing/disabled cloud services and unexercised native hardware must remain explicit acceptance gates.

## Task 1 — baseline and concrete cloud configuration

- [x] Verify clean R3A HEAD and branch; preserve history and current artifacts.
- [x] Inspect actual Node onboarding and fresh official hosting requirements; report account interaction block.
- [ ] Revalidate approved Neon resources without printing secrets; document PostgreSQL/private signed-upload requirements, TLS, migrations and isolated restore.
- [ ] Correct nonsecret environment examples/runbook with actual combined entry, proxy trust, runtime and separate migration commands.

Files: `server/.env.managed.example`, existing staging scripts, new `docs/TAHA_POS_FULL_CLOUD_NATIVE_STATUS.md` and hosting runbook. Tests: existing configuration/readiness/provider acceptance, disposable fixtures only.

## Task 2 — actual Windows native validation build

- [ ] Add reproducible API-mode bundled desktop build script and Windows staging config.
- [ ] Add Windows CI validation workflow with pinned vendor toolchain/actions, actual MSVC/SDK checks, Rust tests and NSIS/MSI artifacts; no publishing/signing secret on pushes.
- [ ] Run workflow in the existing private repository; fix actual native compiler errors and download/inspect real artifacts.

Files: `scripts/build-desktop.mjs`, `.github/workflows/windows-build.yml`, `src-tauri/tauri.staging.conf.json`, existing native source only where compilation requires correction.

## Task 3 — signed native update chain

- [ ] Write failing release-policy/signature/URL tests, then implement bounded Windows manifest verification and packaging.
- [ ] Generate a locally protected persistent staging updater key; commit its public key only.
- [ ] Integrate official Tauri updater through restricted native commands and existing About/Settings; require user installation and active-sale deferral.
- [ ] Sign actual installer files locally and verify expected/wrong-key/corrupt bytes; label missing Authenticode truthfully.

Files: `src-tauri/src/updates.rs`, native lib/Cargo configuration, `src/features/settings/desktop-settings.tsx`, focused release scripts/tests. Consumers: public portal and approved Windows release workflow.

## Task 4 — unified durable software distribution

- [ ] Write failing tests for Windows/public portal routes, compatibility, traversal, missing versions and artifact integrity.
- [ ] Extend current distribution handler without breaking Android routes or mixing private media.
- [ ] Prepare durable versioned release storage and approved metadata-last promotion; keep any paid/provider-authorization step blocked only where required.

Files: `distribution/*`, release scripts, tests under `scripts/test/`, Nest frontend mount/config as needed. Existing MediaService financial/private contracts remain untouched.

## Task 5 — regression, recovery and owner handoff

- [ ] Run relevant full frontend/backend/release/SQLite/financial and production-style package checks, preserving failures.
- [ ] Verify fresh shop and shared authenticated API persistence on disposable records; distinguish prior cloud evidence from fresh results.
- [ ] Save private source/artifact recovery and exact build provenance; update actual source PR/checks without self-merging failing work.
- [ ] Supply exact hPanel GitHub setup, precise authorization/configuration blockers and actual installer/APK paths.

Physical native offline/reconnect/printer/scanner/second monitor/Android acceptance, actual Hostinger deployment and production Authenticode are not inferred from builds.
