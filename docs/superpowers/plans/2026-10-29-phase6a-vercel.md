# Phase 6A Vercel staging implementation plan

> Execute within the existing checkout. No Git metadata exists; do not initialize Git or claim commits. User explicitly requests implementation and verification in the supplied Phase6A brief.

**Goal:** Real authenticated HTTPS staging with shared PostgreSQL, private persistent images and desktop/mobile acceptance independent of the shop PC.

**Architecture:** Two projects: existing Vite SPA and existing NestJS API. Same-origin /api rewrite, isolated managed PostgreSQL and private object storage. Staging uses database revision polling; LAN listeners remain development/native integrations. No Redis required for initial staging.

**Spec:** Owner attachment dac793a6-1a5d-4337-9181-a1cf1ad8d138/Pasted text.txt; preserved as docs/PHASE6A_OWNER_BRIEF.md.

## Constraints and review focus

- Preserve UI, PostgreSQL transaction engine, local/demo, Android and Windows architecture. Never copy saved owner data into staging.
- No paid resource/plan provisioning without explicit approval. No credentials printed, committed or embedded in VITE values.
- Application authentication remains mandatory. Mock/demo builds are forbidden for real staging.
- No /api response may fall through SPA HTML or public caches; refresh cookies must survive same-origin forwarding.
- Cold start and multiple instances cannot depend on memory for correctness. Migrations are explicit deployment operations.
- Oversized images need authorized short-lived direct upload, actual content verification and idempotent completion; private objects remain private.
- Cloud staging never invokes private LAN endpoints or claims native phone/hardware acceptance.

## Stage 1: readiness and access

- [x] Read supplied specification/latest handoff, inspect Git and credentials without values.
- [ ] Audit source-backed module matrix in docs/PHASE6A_VERCEL_READINESS_AUDIT.md.
- [ ] Establish actual Vercel identity/team/plan and approved DB/storage availability; request secure sign-in only if missing.
- [ ] Diagnose last localhost startup failure from live process/database evidence; preserve saved development data.

## Stage 2: frontend cloud/browser integration

Files: Vercel frontend deployment configuration/build guard, src/main.tsx/app routing, stage indicator, cloud sync polling and browser tests. Dedicated mobile components must work at the same domain without Android native APIs.

- [ ] Tests reject mock/local/private-LAN staging config and API catch-all interception.
- [ ] Build Vite from existing production process, add noindex/cache controls and same-origin routing.
- [ ] Poll revision stream across visible browser views and invalidate appropriate cached repository queries; keep native/LAN behavior intact.
- [ ] Verify desktop/mobile routing/session/data updates against isolated API.

## Stage 3: backend function/session/database integration

Files: server/src/main.ts/config.ts/app.module.ts/database/database.service.ts, realtime gateway, health diagnostics, Vercel backend config/env examples and isolated tests.

- [ ] Write tests for cloud env/connection/TLS/cache/integration readiness.
- [ ] Add bounded verified-TLS PostgreSQL pool configuration; preserve transaction-local SET ROLE and identity isolation.
- [ ] Function entrypoint initializes Nest once per instance, no migrations/LAN listener/background-presence timer in cloud mode.
- [ ] Public health stays safe; authenticated readiness checks actual schema/storage prerequisites. Cloud sessions enforce strict origins/HTTPS and no public caching.
- [ ] Verify localhost login/refresh/logout plus isolated API permissions, financial/concurrency regression.

## Stage 4: durable media

Files: server/src/media/*, new upload-grant migration, frontend upload transport, tests. Preserve existing development files and native capture APIs.

- [ ] Add content/ownership/expiry/idempotency tests before upload implementation.
- [ ] Private S3-compatible object abstraction supports scoped direct uploads; PostgreSQL owns grant/metadata.
- [ ] Completion validates actual image bytes, bounded sizes, same shop/purpose and captures before publishing authorized reference.
- [ ] Verify restart/another session retrieval and unauthorized denial in isolated integration. No live storage claim without credentials.

## Stage 5: deployment operations and acceptance

Files: safe staging environment examples/packaging/seed/validation scripts, docs/PHASE6A_VERCEL_STAGING_IMPLEMENTATION.md and PHASE6A_DEMO_GUIDE.md.

- [ ] Exclude .env, dumps/private media/signing/tooling from upload; preserve rollback artifacts.
- [ ] Add isolated seed through existing validated operations; do not invent UI totals.
- [ ] Provision only approved resources; explicit migrations with compatible roles/extensions and checksums.
- [ ] Deploy real backend/frontend if authorized access/resources exist; use actual returned domains.
- [ ] Run journeys A–F and security/media/concurrency/performance checks at actual HTTPS URL. Record blocked versus verified separately.
- [ ] Verify provider backup/restore to disposable target where possible; document recovery and media retention accurately.
- [ ] Final report exact status fields, URLs and fresh test counts; no production/hardware claims.
