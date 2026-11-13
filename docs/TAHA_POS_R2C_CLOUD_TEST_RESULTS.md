# R2C — tests and environment boundaries

Evidence date: 13 November 2026. **No public cloud acceptance has occurred.** Approved Neon Free PostgreSQL and private storage now exist and have passed limited real-provider checks; the selected Unlimited account is not yet aligned with the hosting connector. There is no deployed commit or HTTPS staging URL.

## Current committed release after the setup regression correction

**`0.5.0-r2c.3`**, application commit **`88b6076e3e6ab6940ab0cb96373ead9324193b46`**, branch `codex/r2c-hostinger-staging`. ZIP: `artifacts/managed/Taha-POS-staging-R2C-0.5.0-r2c.3-20261113T121256.zip`, **1,905,307 bytes**, SHA256 **`9dcaf3097a4303343648c5d66c6668d8e3d84d34c2e9dd68b69f662b372985d3`**. All 345 payload hashes, archive CRCs, forbidden-private-file checks and eight exact known private values pass. Source was clean when packaged.

The final production-style fresh-shop harness passed **25/25**, exit 0, **17:15:24-17:18:01 PKT**. This includes the deterministic held-real-readback disabled/enabled link assertion and successful tax navigation, full financial/media/reconnect/outage flows and actual isolated backup/restore. Evidence: `clean-shop-fixed.log`, matching result JSON, `.test-postgres/r2c-20261113/taha_r2c_clean_1794572125571/results.json`, and `release-final-inspection.json` under the Neon evidence directory. Backend still 279/279; frontend typecheck/lint pass. **Fresh complete isolated frontend rerun: 187 passed, one intentional API-profile skip, zero failed**, exit 0; **17:15:24-17:38:22 PKT**, 22.9 minutes (`frontend-isolated-full.log` and result JSON).

The default **unqualified `npm test`** configuration is not the validated isolated baseline: it selects 222 mixed-profile cases without the required setup. It was interrupted after four `cash-reconciliation.spec.ts` cases failed at an Opening workspace screen. Assertions/exclusions were not edited. The existing dedicated API reconciliation configuration subsequently passes **5/5**, exit 0, **17:15:24-17:16:08 PKT** (`reconciliation-browser.log`). The actual full local regression command is the preexisting **`npm run test:local`**, with its own fixture/global setup. Repairing the default aggregate entrypoint is a separate test-configuration cleanup; do not claim that aborted command passed.

## Latest real-provider and backend verification

Evidence: ignored `.test-postgres/neon-skills-setup-20261113/` (13 November 2026).

| Check | Actual result | Evidence |
|---|---|---|
| Neon identity/plan/resources | Authenticated CLI 9.4.0; organization Free; approved project, PG17 database and private bucket created | Organization/project/bucket readback records; no paid add-ons |
| Existing configuration | Eight existing fingerprints unchanged; no app env overwrite, global Codex edit or app dependency change | `config-preservation.json` |
| Agent skill/MCP | Exact requested skill fetched HTTP 200; seven existing cached skills reused; live plugin now installed; exposed tool calls return `Unknown tool` | `NEON_AGENT_SETUP_2026-11-13.md`; CLI remains functional |
| Real guarded Neon migration | **69/69**, actual admin and pooled runtime certificate/hostname-verified TLS, admin non-superuser, restricted runtime | `cloud-migration-result.json`, `actual-database-roles.json` |
| Empty remote shop | Zero owners/accounts/products/customers/sales/stock movements; no initialization or seed | Actual post-migration SQL assertions |
| Real private storage | **4/4 pass**: SDK CRUD/privacy, exact POST/readback, oversized rejection, wrong-key rejection | `real-storage-probe.json` |
| New regression tests | Five non-superuser migration/runtime-role tests and five real TLS fixture tests | `server/test/r2c-managed-role.test.ts`, `r2c-verified-tls.test.ts` |
| Complete backend after fixes | **279 passed, 0 failed, 0 skipped**, 16:00:39-16:05:11 PKT, exit 0 | `backend-final-full.log`, `backend-final-full-result.json` |
| Latest backend typecheck/lint | Both exit 0 at 16:16 PKT | `backend-final-checks.json`, matching logs |

The TLS check uses the live authorized TLSSocket plus certificate/hostname validation. The observed proxy-internal `pg_stat_ssl=false` does not override actual client encryption. The runtime role guard rejects elevated existing roles/memberships before grants. Historical migration SQL and recovered MediaService were not changed.

The earlier frontend result below belongs to its earlier source. After the subsequent setup-link fix, the complete 188-case isolated suite was rerun; its 187 pass/one intentional skip result is recorded above. The first `.1` package predates these two fixes. `.2` exposed the separate setup-navigation race. The accepted local `.3` package includes both compatibility corrections and the navigation guard; earlier artifacts are preserved.

## Earlier complete local checks (before provider compatibility fixes)


| Gate | Fresh result | Evidence under `.test-postgres/r2c-20261113/` |
|---|---|---|
| Full backend | **269 passed, 0 failed, 0 skipped**, exit 0; 14:49:08–15:02:56 PKT, 823.2 seconds | `backend-full.log`, `backend-full-result.json` |
| New one-time initialization tests | **7/7 passed**; included again in the complete 269 | `initialization-first.log`, matching result JSON; `server/test/r2c-initialization.test.ts` |
| Frontend/backend TypeScript | Both pass, exit 0 | `typecheck-first.json` and associated logs |
| Backend lint | Pass, exit 0 | `lint-results.json`, `backend-lint.log` |
| Frontend lint | Pass, exit 0 after fixing an empty diagnostic catch in the new harness; no rule disabled | `frontend-lint-final.log`, `frontend-lint-final-result.json` |
| Production frontend/backend/tools build | Final clean-commit build pass, exit 0; **15:13:55–15:16:28 PKT** | `package-committed.log`, `package-committed-result.json` |
| Initial full fresh-shop package rehearsal | **25/25 passed**, exit 0, 15:08–15:11 PKT | `clean-shop-sixth.log`, result JSON and `taha_r2c_clean_1794564502119/results.json` |
| Final clean-commit package rehearsal | **25/25 passed**, exit 0; **15:17:12–15:19:05 PKT** | `clean-shop-committed.log`, result JSON and `taha_r2c_clean_1794565034048/results.json` |
| Real local backup/restore | Pass, ten state tables match, validated constraints | Fixture `backup-verification.json`; details in clean-shop report |
| Complete frontend browser suite | **187 passed, 1 intentional skip, 0 failed**, exit 0; **14:44:43–15:14:44 PKT**, 30.0 minutes | `frontend-full.log`, `frontend-full-result.json` |
| Runtime dependency advisories | Frontend **0**, backend **0** known advisories, fresh `npm audit --omit=dev` | `frontend-runtime-audit.json`, `backend-runtime-audit.json` |
| Frozen MediaService | Unchanged SHA256 `b5db3723b534c0e00371a0f0d15a8289b20a12d58e0bcdb61622dc8d2b6c0d3f` | Actual source hash checked after full backend run |

The full backend retains authentication/refresh/revoke, server permissions and private costs/media, financial idempotency/concurrency, compound services/returns, credit and inventory tests. Tests use generated disposable databases on the identity-verified 55459 development cluster. Saved shop 55439 is not started, migrated or used by these commands.

The intentional frontend skip is the API-profile password-dialog case in local-prototype mode (`tests/phase5d-search-controls.spec.ts:158`); it was retained. A complete green run, not a targeted rerun, supplies the count above.

Expected anonymous initial-refresh 401s, deliberately disconnected/outage 503s and rejected concurrent purchases are not hidden. Their recovery/state assertions pass. There are no external gateway charges. Local timings include concurrent regression load and are not a Hostinger performance estimate. The initial complete package's cold entry took 6.84 seconds; the R2B historical timeout remains unexplained and requires actual hosting measurement.

## Final artifact and local development fixture

- Implementation commit: **`5f35b1884dedab4aa5c9ce1c441639216900ddb6`**, `codex/r2c-hostinger-staging`; worktree was clean when packaging began. Subsequent report-only changes do not change this tested application.
- ZIP: `artifacts/managed/Taha-POS-staging-R2C-0.5.0-r2c.1-20261113T101355.zip`, **1,903,648 bytes**, SHA256 **`8c0c9dc04f615685722e086faed5a38e20ac83dd82c5ae01b6dd5a3a6f7d3d19`**.
- **343 hashed payload files + manifest**; all CRC/size/SHA256 checks pass. Forbidden private/runtime filenames and exact known private environment-value checks pass. Evidence `release-inspection.json`; staged source scan covers 912 files with zero findings. These bounded checks are not a claim to detect every possible secret.
- Final production-entry startup **3.24 seconds locally**. Final actual dump/restore matches ten state tables with validated constraints; dump SHA256 **`4dc9a2467b25315850ce7f5fa2530406d3926573d999d5775a66a8915ab18232`**. No real cloud restart, redeployment or provider backup has been tested.
- Existing isolated localhost processes were identity-checked and replaced with a new 69-migration synthetic fixture through `node scripts/start-local-acceptance.mjs --isolated`. Frontend **`http://127.0.0.1:1423/dashboard`**, API **`http://127.0.0.1:3306/api/v1`**. API PID 428, frontend PID 15168 at verification; actual health, frontend API proxy, login and authorized deep readiness pass (`localhost-final.json`, 15:19 PKT). This is a sample development fixture, not the clean-shop proof or a phone-reachable cloud URL. Saved shop 55439 remains stopped.
- Private recovery copies: **`D:\Taha-Private-Recovery\R2C-20261113-152300`** and **`C:\Users\hassa\.taha-private-recovery\R2C-20261113-152300`**. Exact committed source ZIPs, Git bundle, final application ZIP, selected synthetic evidence and raw frozen MediaService bytes were CRC/hash checked; independently cloned Git objects pass `fsck`. Initial source checkpoint `e895b4c11080d18afcfce7dec3bdcd9e9b2a5007` differs from release `5f35b18...` only in reports. `verification.json` and ignored `recovery-checkpoint.json` record hashes and any final report checkpoint. ACLs restrict access to the current user, SYSTEM and Administrators. Both paths are on this Windows machine, not offsite disaster recovery. Earlier R1/R2A/R2B backups remain intact.
- Source integrity: **829 tracked text files** decode as UTF-8 without NUL corruption; complete primary test logs contain no NUL padding (`source-integrity.json`). The raw MediaService working copy retains its protected hash; Git archives use the committed LF representation, verified against the exact Git object and canonically identical source. A separate byte-for-byte raw copy is retained.

## Failed/interrupted work retained

The first five clean-shop rehearsals stopped at explicit assertions; they are not combined into a passing count. Locator/save-completion and receipt expectation corrections are explained in `TAHA_POS_R2C_CLEAN_SHOP_ACCEPTANCE.md`. The fourth run also exposes an interrupted-session-restoration sign-out case, retained as an open regression. No test assertion about money/stock/privacy was removed. No application replay protection was relaxed.

## Not tested / not deployed

- Actual Hostinger target, Linux native dependency installation, reverse proxy, public HTTPS/startup/restart/resource limits.
- Real-provider financial/concurrency/RLS scenarios and full authenticated operations through the actual pooler. Migration/role flags and verified client TLS already pass; this does not substitute for transaction acceptance.
- Hosted-browser CORS, complete media/thumbnail workflow and redeploy/object-backup durability. Real SDK/private/exact-size POST transport checks already pass.
- Hosted owner bootstrap and two real internet sessions, session expiry/interruption, provider outages and recovery.
- Physical Android camera/scanner/gallery/pairing/process-death/offline behavior or a newly built APK.
- Windows native EXE/installer, SQLite acceptance, thermal printer, HID scanner or customer second monitor.

Local implementation, automated verification, real provider verification, physical testing and deployment are separate acceptance levels. R2C deployment acceptance and daily production readiness remain **NO** until applicable gates pass.

## Actual Neon empty-schema backup and isolated restore

Passed **13 Nov 17:02:39 PKT**. A real PostgreSQL custom-format dump of the new empty staging base was created with libpq `verify-full` TLS. It was restored into a separately generated Neon database, compared against ten source state tables, and that disposable target was removed. The source database was not reset or modified. Constraints are validated; effective application object/function grants and RLS policies match the source.

The ordinary restore first failed on two provider-owned `cloud_admin` default-ACL entries. Exactly these two entries are commented in the retained TOC restore list; application ACLs remain included. Neon restore defaults also left three owner-sequence ACLs as USAGE-only. A retained SQL sidecar reinstates the source owner's exact full privileges on `private.location_code_seq`, `private.product_code_seq` and `public.permissions_id_seq` before comparing effective privileges. No runtime authority was expanded. A null default ACL and explicit equivalent owner ACL are compared by effective grants, not raw null representation.

Recovery material is held in the private Neon directory outside the repository: `neon-main-empty-shop.dump` (832,082 bytes; SHA256 `bd32e1a243d8d5f8a51407ecb8602751d963e67db224061557299f2cd13063ec`), `neon-restore-list.txt`, `neon-restore-owner-sequence-grants.sql`, `neon-source-permissions.json`, and the public CA bundle. `real-backup-restore.json` records the pass; earlier timeout/ACL/comparison failures remain in separate logs. This is an **empty-schema managed-provider recovery rehearsal**, not backup acceptance for a populated live shop or private image collection. Independent object backups, populated financial/media restoration and an off-machine recovery copy remain required.

## Real dependency readiness before first-owner initialization

At **17:03:57 PKT**, the actual ReadinessService with the restricted pooled Neon role and real private bucket passed configuration/startup/database/TLS/schema/functions/permissions/private-storage checks, matching 69/69 checksums. Authentication correctly fails because the empty base has no owner; overall status is **degraded**, not ready. This was an in-process provider probe with a loopback-proxy configuration fixture, not Hostinger HTTPS/proxy verification or real authenticated shop operation. Evidence: `real-deep-readiness.json`.

## Newly reproduced setup-navigation race

The clean `c09873a...` package `0.5.0-r2c.2` builds and all 345 payload hashes/privacy checks pass, but its fresh-shop rehearsal failed after four completed checks: the tax-review link remained on the wizard. A deterministic regression delays an **actual** settings readback during cache invalidation (no fabricated API data) and confirms the link incorrectly remains enabled while `useAction.run` refuses another action. The initial diagnostic interception cleanup raised `Route is already handled`; it was corrected to wait for in-flight route completion, then the unchanged application failed specifically at `toBeDisabled` as intended (`setup-navigation-red-corrected.log`).

All four save-and-navigate links now expose their existing busy state via `aria-disabled`, with a subdued waiting style. Their save, readback and cache-refresh behavior is unchanged. The regression verifies disabled state during the delayed real readback, re-enabled state after completion, successful tax navigation and retained setup values. The subsequent clean `.3` package passes all 25 checks, including this forced race. The complete isolated frontend run is recorded in the current-release section. This race is distinct from the still-open interrupted refresh-token restoration case; no authentication guard was relaxed.

## Actual Neon financial/media API acceptance

Approved Free child branch **`r2c-acceptance-20261113`**, separate from empty `main`, **10/10 passed** against the compiled `.3` application, the real restricted transaction pooler and private object storage. The API process ran on this Windows PC in production/cloud mode with a loopback trusted-proxy fixture and a nonpublished test origin. This is **real provider/API verification**, not a hosted HTTPS URL, desktop/mobile browser acceptance or native testing.

Covered: guarded 69-migration verification and first-owner initialization with no sample activity; full authenticated readiness; first product/locations/supplier/stock receipt; cash sale and exact retry; one-line PKR 3,600 material + 500 labor and one stock deduction; damaged return/quarantine; PKR 3,600 credit less 1,000 collection = 2,600 ledger and preserved due date; two authenticated sessions racing for the last unit; actual MediaService original/decoded thumbnail/private access and duplicate upload retry; application restart preserving sessions, SQL state and identical photo bytes. Four synthetic sales now exist only on the acceptance branch. `main` remains zero owners/products/customers/sales/payments/movements, rechecked at **17:35:57 PKT**.

Separate actual-provider auth checks **3/3 passed**: Secure/HttpOnly/SameSite-strict refresh cookie rotation; logout denying persisted session/access/refresh; old-refresh replay revoking that isolated session family. This preserves strict replay detection and does not resolve the distinct rapid-browser-interruption lifecycle issue.

Evidence: `neon-api-results.json`, `neon-api-verified.log`, `neon-security-results.json`, `neon-security.log`, `final-preservation.json`. Earlier fixture attempts were retained: omitted explicit staging environment was correctly refused; a legacy `/auth/context` test URL was corrected to the existing `/auth/session`; location fixtures were corrected from `parentId` to the real `parent_id` contract. No endpoint or application validation was changed to accommodate these fixture errors, no business state was reset, and the created synthetic rack/owner were safely reused.

The Free account rejected explicitly changing its suspend timeout, even to 300 seconds. The branch was then created using the provider's unchanged default, at fixed 0.25 CU, after listing existing branches to avoid duplication. No upgrade or paid add-on was enabled.

Durations are workflow groups, not individual request latency: cash + exact retry + SQL assertions **4.41 s**; combined service + retry + SQL **6.21 s**; damaged return + SQL **2.03 s**; credit/customer/collection + SQL **5.58 s**. Actual Hostinger-region latency, cold startup and load remain unmeasured. Latest local `.3` production-entry startup was **15.07 s** under concurrent test load; preceding local runs varied (3.24 s and 34.65 s). Their cause has not been isolated; do not promise the earlier fast timing on managed hosting.

## Populated provider database and photo recovery rehearsal

The acceptance branch's **four synthetic sales** were dumped over verified TLS and restored into a separate generated Neon database. At **17:34:11 PKT**, ten tables, constraints, effective function/object grants and RLS matched. The disposable restore target was removed; source unchanged. Custom dump: **846,139 bytes**, SHA256 **`445d6e7ab49e4cb3041287f4d157831ddab13ada1d9033da8b0d91799d317ac2`**. The two provider ACL exclusions and three owner-sequence grant sidecars described above are retained for this backup too. Evidence: `real-acceptance-backup-restore.json` and log.

All **three** synthetic photo objects (processed image, byte-identical original, thumbnail; **301 bytes total**) were downloaded to private storage, SHA256 checked, restored under fresh private diagnostic keys, read/hash-verified, checked against anonymous access, and diagnostic copies removed. Original keys were re-read unchanged. Evidence: `real-object-backup-restore.json`; private `synthetic-object-backup/manifest.json` maps each original key to its local recovery bytes. This bounded rehearsal is not an operational scheduled retention system, offsite disaster recovery or a full restored application exercise. Independent off-machine backups and recovery procedures remain required before daily use.
