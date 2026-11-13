# R2C — fresh-shop acceptance

13 November 2026. **Local production-style acceptance: PASS. Hosted first-run acceptance: BLOCKED / NOT RUN.** No native Android/Windows or physical phone result is implied.

## What was implemented

- `server/migrations/202611130100_one_time_shop_initialization.sql`: new migration 69; private immutable first-owner marker, no public/runtime grants.
- `server/scripts/initialize-staging.ts`: explicitly approved, exact-target, separately run administration. Validates private owner identity/password, hashes with existing Argon2, serializes concurrent initialization, rejects occupied/repeated targets, creates only the first owner/membership and initial setup flag. No sample inventory/customers/sales, public registration, default owner password or startup migration.
- `server/scripts/migrate.ts`: restricted runtime role explicitly denied the marker.
- `server/test/r2c-initialization.test.ts`: seven real isolated cases covering validation, occupied targets, concurrent initialization, empty state, restricted role, real login/readiness and closed bootstrap/replay.
- `src/features/settings/first-run-setup.tsx`: owner/API-only setup gate, recoverable loading/error state, setup and tax routes. Existing shops without the new opt-in flag retain normal entry.
- Existing `ShopSetup` reused, with persisted progress and readback, owner/staff choice, optional modules, storage/quarantine, payment accounts, zero tax, receipt policy, optional devices and return to an empty Dashboard. Desktop and dedicated mobile shells/routes both support it. No Dashboard/POS/theme redesign.
- `scripts/package-r2b.mjs --phase R2C`: versioned same-origin package includes compiled `initialize:staging` alongside guarded migration/seed commands. Clean-shop initialization and sample seed are distinct procedures.

## Fresh packaged rehearsal

`scripts/test-r2c-clean-shop.mjs` runs the actual compiled `server.cjs` and admin tools, verified clean production dependencies, two independent Chromium contexts, a real disposable PostgreSQL 17 cluster and real private image bytes. A temporary loopback HTTPS proxy emulates TLS offload; `TAHA_RUNTIME=local` is deliberate. This does not test Hostinger/Linux, external TLS or an actual object provider.

The initial complete candidate rehearsal passed **25/25**, exit 0, **13 Nov 15:08:33–15:11:01 PKT**. Evidence: `.test-postgres/r2c-20261113/clean-shop-sixth.log`, its result JSON, and `taha_r2c_clean_1794564502119/results.json`. That candidate was built from an uncommitted tree over R2B `f408a59...`; it is not final deployment provenance. A final committed-package record must be recorded in the cloud test report before release handoff.

**Earlier accepted local package (before managed-provider compatibility fixes):** clean implementation commit `5f35b1884dedab4aa5c9ce1c441639216900ddb6`, release `0.5.0-r2c.1` ending `20261113T101355.zip`, **25/25 pass**, exit 0, **15:17:12–15:19:05 PKT**. Evidence `clean-shop-committed.log`, corresponding result and `taha_r2c_clean_1794565034048/results.json`. The cloud test report records exact artifact hash and complete build/frontend/backend results. This supersedes candidate provenance, not the outstanding cloud/physical gates.

Verified:

1. Compiled migration and first-owner initialization; 69 migrations, one owner, zero business records.
2. Production entry starts on an assigned loopback port, no Vite.
3. Actual login and authorized complete readiness.
4. Desktop/mobile both enter setup; secure refresh cookie, mobile width does not overflow.
5. Six-stage wizard, saved zero-tax review, optional hardware, empty Dashboard and cross-session completion.
6. First Rack/Shelf/Box/quarantine and supplier persist through real API operations.
7. First product plus first category/brand/model explicitly created through the bundled UI and reloaded.
8. Stock receipt persists quantities/costs without inventing opening movements.
9. Settled nested route refresh and missing API/asset/dotfile denial.
10. Other authenticated session's product appears on mobile via polling without reload.
11. Cash checkout through POS UI; stored stock/invoice and same-request retry remain one transaction.
12. Linked material service: one customer-facing line, PKR 2,000 product + 500 labor and one deduction.
13. Damaged return increases quarantine only.
14. Credit checkout, persisted due date and collection leave exactly PKR 2,600 in the ledger.
15. Actual image upload, signed/private retrieval, anonymous denial, decoded thumbnail and reload.
16. Sellable return restores available stock; concurrent final-unit checkouts create exactly one sale and no negative stock.
17. Unauthenticated capability receipt excludes private cost/allocation fields, retains permanent TAHA MOBILES branding and configured branch, and generates an actual A4 Chromium PDF.
18. Repair job/status and shift records propagate to a second session.
19. A disconnected client catches up after missed revisions.
20. Process restart preserves authentication, accepted records and identical image bytes.
21. Real isolated database outage keeps liveness but fails readiness, then recovers.
22. Unwritable storage degrades readiness and recovery retains original bytes.
23. Revisiting Shop Setup preserves accepted sales/history.
24. Actual custom-format `pg_dump` and `pg_restore` into a separate generated database match ten migration/identity/financial/stock/media tables; constraints validated.
25. No uncaught browser runtime errors; desktop/mobile screenshots retained privately.

Backup evidence: `backup-verification.json`, custom dump SHA256 `55d1e1440deb8e41798abb71545f5276d40b674b189e9f19756208492ad6e509`. Images remain separately retained in the private fixture directory and their retrieval hash is checked across process restart. This is not a hosted object-backup rehearsal.

## Failed rehearsals and remaining acceptance

Earlier runs are preserved and not counted as passing: an ambiguous hidden/native receipt-select locator; waiting on a create button disappearing before its asynchronous save/focus completed; an incorrect `catalog_values.name` fixture expectation; and expecting the test shop name in a receipt that deliberately retains permanent TAHA MOBILES branding. The harness now waits for committed combobox closure and tests the correct SQL field/brand/branch; no application financial guard was weakened.

One rapid navigation/reload before session restoration completed returned to Login (fourth rehearsal). The ordinary settled-page reload passes. Source review shows strict refresh-token reuse revokes the session; simultaneous interrupted refresh is a plausible cause, **not a persisted-database causal diagnosis from that disposed fixture**. Retain this edge case for an isolated auth/lifecycle regression before hosted acceptance. Do not add an unreviewed replay grace period or disable replay checks simply to make it pass.

The clean-shop wizard is locally accepted, but live Hostinger first-owner initialization, real external roles/TLS/pooling, private bucket POST/CORS, hosted persistence/restore, actual phone/browser network interruptions and owner-operated acceptance remain outstanding. The approved Free Neon database/bucket now exist: 69 migrations, restricted role/TLS checks and four real S3 transport checks pass. Base `main` remains empty, without owner initialization or seed. No hosted first-run or cloud transaction acceptance has occurred.
