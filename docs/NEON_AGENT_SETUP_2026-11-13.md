# Neon agent setup and approved staging resources

Verified 13 November 2026 in `D:\Inventory system POS`.

## Official skill and installed tooling

The requested URL, `https://neon.com/.well-known/agent-skills/neon/SKILL.md`, was fetched successfully over HTTPS (HTTP 200, 37,482 bytes). The browser search tool could not open it, so a direct HTTP fetch was used. The complete fetched instructions were read; an evidence copy is in ignored `.test-postgres/neon-skills-setup-20261113/SKILL.md`.

The existing **Neon plugin 3.0.7** already supplies seven available skills: `neon`, `neon-postgres`, `neon-object-storage`, `neon-auth`, `neon-functions`, `neon-ai-gateway`, and `neon-realtime`. Its `mcp.json` already configures the streamable-HTTP server `https://mcp.neon.tech/mcp`. Its app manifest requires the Neon OAuth connection. These skill files were already cached and readable for this project. They were reused without installing a second skills tree or overwriting managed plugin files. A later live account inventory initially reported `installed=false`; the official Neon installation action was offered, and a subsequent inventory reported `installed=true` with Neon tools exposed. Cached files alone were not treated as proof of an active account connection.

The missing CLI was installed as **Neon 9.4.0** under ignored `.test-postgres/r2c-20261113/neon-tooling` (159 tooling packages). No application dependency, lockfile, global PATH or global npm installation was changed. Browser sign-in completed for the named **`taha-staging`** profile using `login --keyring`. A subsequent read-only API request verified the organization is **Free** and initially had zero projects. The existing default profile was preserved. Secrets were not printed into chat or committed.

MCP **installation/configuration** is now verified from both the existing plugin files and the live account inventory (`installed=true`). Its tools appeared during this session, but read-only `describe_project` and `list_storage_buckets` returned the integration error `Unknown tool`. Functional MCP authentication/operation is therefore **not yet verified**. The authenticated CLI works and remains the official skill's preferred interface. Do not repeat the earlier installation blocker as if the plugin were still absent. Restart/reload the MCP connection if its tools remain unavailable. The earlier expired OAuth page and browser URL-verification stop were not bypassed.

## Approved external resources created

The owner explicitly approved Free staging resources only. Creation was guarded by checking the organization's actual `plan=free` and searching for an existing matching project before creating anything.

| Resource | Actual result |
|---|---|
| Project | `taha-pos-staging`, Free organization |
| Region | `aws-ap-southeast-1` (Singapore), supports Object Storage |
| PostgreSQL | Major version 17, database `taha_staging` |
| Compute request | Fixed 0.25 CU; no paid add-ons requested |
| Base branch | `main`, maintained as an empty migrated shop |
| Migration identity | Separate `taha_migration` administrator |
| Runtime identity | SQL-created `taha_runtime`; no superuser, RLS bypass, database creation, role creation or inherited privileges |
| Bucket | `taha-staging-private`, provider listing confirms `access_level=private` |

No Neon Auth, Data API, Functions, Realtime or AI Gateway was enabled by this work. The existing NestJS authentication, REST API, PostgreSQL financial engine and HTTPS polling remain the application architecture. No Hostinger site, paid service or DNS record was created or changed.

## Configuration changes

- Briefly created project-scoped `.codex/config.toml` through `neon mcp --oauth --project --agent codex --project-id ... -y` while the plugin was reported absent. It contained only the public server URL pinned to this staging project, no API key. When the installed plugin appeared, the exact newly created file was preserved in ignored evidence and removed to avoid duplicate registration. There was no preexisting project MCP file, and the user-level Codex configuration remained unchanged.
- Added a root `.neon` context with **organization/project/branch IDs only**. It is Git-ignored.
- Appended `/.neon` to `.gitignore`; previous ignore rules are retained.
- Linked with `--no-env-pull --no-config`. No `neon.ts` was generated and no application environment was overwritten.
- SHA256 fingerprints of eight existing configuration locations, including frontend/server environment files and the user's Codex configuration, remained unchanged after linking.
- PostgreSQL and Object Storage variables were explicitly pulled to an owner-only private directory outside the repository using `--service postgres --service object-storage`. This avoided the skill's documented bare-pull behavior that also requests Gateway credentials. Tokens, passwords and private connection strings are absent from this report.
- Authentication/private connection files are in `C:\Users\hassa\.taha-private-recovery\R2C-neon-auth-20261113`, restricted to the current user, SYSTEM and Administrators. They are not deployment artifacts.

## Compatibility defects found and corrected

The real-provider setup exposed two blockers in the previous deployment runner:

1. `ALTER ROLE ... NOSUPERUSER` requires a real PostgreSQL superuser, including when removing the flag. Managed administrators cannot issue it. `server/scripts/migrate.ts` now creates restricted roles explicitly and rejects elevated existing identities/additional memberships before granting private access. It no longer tries to silently downgrade a privileged identity. Five real isolated migration/role tests pass, including all 69 migrations under a non-superuser owner.
2. `pg_stat_ssl` describes the PostgreSQL backend hop, which is false behind the observed Neon proxy even though the external client connection has a valid TLS certificate. `server/src/database/verified-tls.ts` verifies the actual live `TLSSocket`, authorized certificate chain and hostname. Migration and readiness use it. Certificate verification remains enabled; plaintext, untrusted TLS, wrong-host certificates and closed sockets are rejected by real TLS fixture tests. There is no provider-name exception or insecure TLS fallback.

No historical migration or financial transaction SQL was rewritten. The recovered MediaService remains frozen. These fixes are administration/readiness corrections needed by R2C, not a new UI phase.

## Actual provider verification

- Guarded migration of the new Neon base database passed: **69 migrations**, real certificate-verified TLS for administrator and pooled runtime, administrator is **not** a superuser, runtime is restricted.
- Base database has **zero owners/accounts/products/customers/sales/stock movements**. No sample seed or one-time owner initialization was run against it.
- Real private object storage passed **4/4 checks**: signed SDK CRUD/privacy; exact-size SigV4 form POST with identical original readback (204); rejection of an oversized object (400); rejection of a different key (403). Only generated diagnostic keys were removed.
- Browser CORS at an actual Hostinger domain, a hosted application, cross-device financial acceptance and redeployment durability are still separate gates. This setup does not constitute a deployed POS.

Evidence is in ignored `.test-postgres/neon-skills-setup-20261113/`: configuration-preservation metadata, provider creation/listing records, cloud migration result, actual role flags, TLS/managed-role tests, complete backend regression logs, and real storage probes. The R2C cloud test report records final regression/package/backup completion results. Saved shop database 55439 was not used or migrated.

## Regression verification after compatibility fixes

- Complete backend suite: **279 passed, 0 failed, 0 skipped**, 13 Nov 16:00:39-16:05:11 PKT, exit 0. This includes five managed-role and five actual-TLS fixture cases.
- Backend TypeScript and lint: both exit 0 at 16:16 PKT.
- Existing unchanged frontend complete run: **187 passed, one intentional API-profile skip, zero failed**, 13 Nov 14:44-15:14 PKT. It was not relabeled as a new run after backend-only fixes.
- Source/media integrity, release archive, final compiled-package rehearsal and backup results are recorded in `TAHA_POS_R2C_CLOUD_TEST_RESULTS.md`.

Actual empty Neon schema backup/restore also passed: ten source tables, constraints, effective grants and RLS match in a separate generated target. Two provider-owned default ACLs and three owner-sequence grants require the retained documented restoration sidecars. The cloud test report records the exact limitation and dump hash; this is not a populated-shop/object recovery pass.

Real pooled-runtime deep dependency readiness passes every infrastructure check; authentication deliberately fails until first-owner initialization, so the uninitialized base remains degraded. No default test owner was introduced.
