# Phase 5D.2 revised progress

Started22 October2026. Authoritative brief: `PHASE5D2_REVISED_OWNER_BRIEF.md`. Continue the existing project, preserve financial history and approved layouts. No production deployment, Supabase restoration, dependency upgrade or data reset.

## Baseline evidence

- Existing checkout has no Git metadata (`git status` reports not a repository); preserve all files in place.
- Prior full local browser run completed135pass,27fail,1skip in43.2minutes. Several failures use replaced native controls/old labels; they remain open until investigated/retested. This is previous-phase evidence, not a fresh Phase5D.2 pass.
- Existing smart services link allocated inventory, deduct atomically and retain protected cost snapshots. They have no structured @mention composer, no product/labor revenue snapshot, and synthetic service minimum0 bypasses the linked component floor. Current service price editing updates only the total.
- Existing pairing requires a previously authenticated phone. New enrollment must give a separate revocable scoped session after desktop approval; pairing and authentication must remain distinct.
- Existing native counter SQLite authority and independent NestJS LAN bridge are separate. Mobile checkout currently uses the API and conservatively refuses active offline-counter promises. Do not claim full native offline phone sales from this architecture.

## Bounded implementation stages

| Stage | Scope | Status | Gate |
|---|---|---|---|
|1|Structured @Product composer, current catalog matching, one linked token, pricing model|Implemented; focused browser checks passed|Explicit immutable selection; caret/edit/paste/undo/composition checks; no stock movement on add|
|2|Backend/local compound allocations, floors/overrides, price review, templates, returns|Implemented; full backend176/176 passed plus local parity|Immutable allocation sums, cost privacy, concurrency/idempotency, product-only default refund and authorized labor policy|
|3|Desktop/mobile integration and cart price editor|Implemented; scoped browser/accounting checks passed; native APK built|One line/live split/current-price review; actual phone interaction pending|
|4|Secure QR device enrollment/session/revocation|Implemented; four real-TLS lifecycle tests passed; physical acceptance pending|Proof of possession, PC approval, camera-only independent credential; no QR owner bearer/password|
|5|LAN discovery, transport/status and offline authority|DNS-SD/Android NSD implemented; three discovery tests passed; QR/manual fallback|Real hotspot/router pending. Phone sales through counter SQLite authority remain unsupported/blocked|
|6|Neutral grayscale tokens and bounded UI/receipts/settings|Implemented; theme11/toolbar1/workflow tests passed;88screenshots|Preserved layout, white paper, Settings/Returns; remaining native hardware acceptance documented|
|7|Regression closure, scenario matrix, APK and runnable handoff|Ready for owner physical retest; build10 delivered|164browser passed/1fixture skip;24native units; verified APK/downloads/services; report created|

## Evidence rules

Use isolated databases for stock/financial/security tests. Preserve old records and already-applied migrations; add versioned migrations. Verify before applying to saved development data and retain a backup. Clearly separate implemented, automated-tested, native/physical-tested and deployed. Keep current progress and failures visible. The final report is `PHASE5D2_REVISED_IMPLEMENTATION.md`.

## Earlier integration checkpoint — 22 October 2026

Historical intermediate status below; superseded by the final checkpoint that follows.

- Structured explicit typo mention, one combined line, price editing, checkout/idempotent retry, current-price linked template reopening, Returns tabs/seven candidates and Settings grouping/discard: first 5 focused browser checks passed (40.7s). Expanded keyboard and stale-floor tests then found a genuine caret issue before atomic tokens; fix and repeat underway, not hidden.
- Backend compound suite grew to 10 checks including partial-credit rounding, retained labor debt, immutable allocations, minimum/approval identity, duplicate checkout and product-only/authorized labor returns. Local compound parity passed. New chart regression and privacy checks are in `tests/phase5d2-accounting.spec.ts`.
- Enrollment: four isolated real-TLS tests passed for proof/PC approval, limited companion scope, camera upload, signed-media HTTPS, expiry/replay/revocation/parent logout. Native AndroidKeyStore identity + encrypted refresh storage, SPKI pin import from PC QR. No owner bearer in QR. LAN TLS setup is ignored private runtime data; protected listener uses3443 alongside HTTP3001. Physical test pending.
- Neutral palette:11 tests passed,76 screenshots; compact Products toolbar followup passed at all six widths in both themes. Notes: `phase5d2-theme-notes.md`.
- First full backend run in this checkpoint:176 tests,171 passed/5 failed (parent failures included). All failures traced to receipt summary querying a private SQL helper outside its protected projection. Corrected in new, not-yet-live migration400; affected real API regressions then50/50 passed (66.2s). Full clean rerun still required.
- New compact receipt capabilities are43-character, domain-separated HMAC opaque references with hashed DB lookup/30-day expiry. Old JWT receipt links remain valid. Customer-only receipt rendering exposes no account authorization.
- Builds/lint initially caught two unused/ternary frontend issues and a TypeScript Error.code cast in new discovery; corrected. Final gates pending.
- Existing owner database remains unreset; migrations200/300/400 have only run on isolated databases so far. Fresh verified backup is required before applying them to saved localhost data and restarting its API.
- New APK version designated0.5D.2-test/build9; until build/signature/download gates finish, the delivered5D1 artifact remains the prior test package.

## Final integration checkpoint — 22 October 2026

- Composer prefix/caret bug corrected and focused suite9/9 passed; local accounting/chart2/2. Actual physical IME/keyboards are not claimed tested.
- Backend clean run176/176 passed (508.6s). Discovery final suite3/3 adds a live-preferred-interface/DHCP fallback case after the full run. Backend build/lint exit0.
- Existing local browser clean run164passed,1intentionally skipped,0failed (20minutes). Skip is the API-auth profile browser fixture in the local/mock suite. Device UI8/8; theme11; toolbar fresh rerun1/1 across six widths/both themes.88screenshots remain. No grand total is claimed across overlapping suites.
- SQLite7/7 and cash-evidence9/9 passed. Full frontend lint/typecheck/build and client credential boundary exit0; Tauri schema validation passed, without native EXE acceptance.
- Native pending photos now survive age/request cancellation/address changes within their origin partition. Activity offers recovery/export/explicit discard. Confirmed sign-out still explicitly clears private data. Retention/recovery tests passed.
- Fresh pg_dump backup verified before applying new migrations200/300/400 to saved localhost data. `owner-dev-migration-verified.json` confirms historical counts/sums/stock/settings unchanged. Applied migrations must not be edited in place. No data reset.
- Final APK0.5D.2-test/build10 built with24native unit tests,0failures; lint0errors/16warnings; debug v2 signature matches build8. All57bundled UI files match dist-mobile. APK3993094bytes; SHA256`e96269314c5bcefe88cc35d8570eaa62634c4e8f52fa9fb714eeae7e0d6e354f`. Intermediatebuild9 preserved separately.
- `http://localhost:1423/login`, HTTP LAN API3001 and pinned-TLS LAN API3443 healthy on current Ethernet192.168.1.3. Frontend/backend kept running. Both full APK downloads and generic backend route match final SHA256. Verification JSON/sidecar beside APK.
- Handoff completed: `docs/PHASE5D2_REVISED_IMPLEMENTATION.md` sectionsA–G, scenario coverage, failures/corrections and boundaries. Updated `mobile/android/README.md` gives seven physical retest steps.
- READY FOR PHYSICAL RETEST. Passwordless QR enrollment is camera companion scope; authorized business Sales uses ordinary staff login. No production cloud, Windows installer/native offline acceptance, internet-free phone-to-SQLite cash authority or physical hardware pass is claimed.
