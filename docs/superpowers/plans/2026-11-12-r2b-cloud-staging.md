# R2B cloud reliability and staging package

Authorized R2B request; preserve R2A `2955c204b645ef9d11a8ef78be88f81f36e915f0` and R1 recovery evidence. Local branch `codex/r2b-cloud-staging`. No deployment, DNS, purchase, saved-database startup/mutation, remote push or native installer/APK work.

- [x] Verify clean R2A baseline and frozen MediaService; read recovery/correction/checklist/hosting reports.
- [x] Complete unchanged frontend baseline on12November:187passed,1intentionalAPI-onlyskip,0failures. Earlier interrupted run retained separately.
- [x] Backend baseline224/224, builds and runtime audits pass; real isolated API/auth/readonly checks and67matching source/database migrations verified.
- [ ] Add complete, permission-scoped committed revisions and test rollback, concurrency, scope, reads and missing notification recovery.
- [ ] Correct cloud poll single-flight/backoff/lifecycle/session/cursor/cache behavior and verify two-session catch-up.
- [ ] Implement cached deep schema/role/TLS/auth/storage readiness, failure tests and trusted TLS-offload handling without changing MediaService.
- [ ] Prepare same-origin SPA/API serving, safe explicit migration/seed tools and versioned secret-free Hostinger package.
- [ ] Run the packaged production entrypoint with disposable PostgreSQL/files and desktop/mobile browser acceptance; test restart and dependency failures.
- [ ] Complete final regression/type/lint/build/security/source checks; create local checkpoint and verified private backup.
- [ ] Write the four requested reports/runbook/dependency documents and update remaining work with real-environment/native limitations.

Hostinger target entitlement is currently UNKNOWN: owner previously selected browser Unlimited, connector exposes different Businessv3 inventory, official browser page stalls. Published managed restrictions are verified; no target app/domain/PostgreSQL/bucket is provisioned. Local package acceptance is separate from cloud and physical acceptance. Private evidence: `.test-postgres/r2b-20261111` (phase began11November, resumed12November).
