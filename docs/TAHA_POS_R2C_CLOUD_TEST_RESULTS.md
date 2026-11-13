# R2C — tests and environment boundaries

Evidence date: 13 November 2026. **No public cloud acceptance has occurred.** External PostgreSQL and private storage are explicitly NONE; the selected Unlimited account is not yet aligned with the connector. There is no deployed commit or HTTPS staging URL.

## Fresh local checks

| Gate | Fresh result | Evidence under `.test-postgres/r2c-20261113/` |
|---|---|---|
| Full backend | **269 passed, 0 failed, 0 skipped**, exit 0; 14:49:08–15:02:56 PKT, 823.2 seconds | `backend-full.log`, `backend-full-result.json` |
| New one-time initialization tests | **7/7 passed**; included again in the complete 269 | `initialization-first.log`, matching result JSON; `server/test/r2c-initialization.test.ts` |
| Frontend/backend TypeScript | Both pass, exit 0 | `typecheck-first.json` and associated logs |
| Backend lint | Pass, exit 0 | `lint-results.json`, `backend-lint.log` |
| Frontend lint | Pass, exit 0 after fixing an empty diagnostic catch in the new harness; no rule disabled | `frontend-lint-final.log`, `frontend-lint-final-result.json` |
| Production frontend/backend/tools build | Pass, exit 0; first R2C candidate | `package-first.log`, `package-first-result.json` |
| Initial full fresh-shop package rehearsal | **25/25 passed**, exit 0, 15:08–15:11 PKT | `clean-shop-sixth.log`, result JSON and `taha_r2c_clean_1794564502119/results.json` |
| Real local backup/restore | Pass, ten state tables match, validated constraints | Fixture `backup-verification.json`; details in clean-shop report |
| Complete frontend browser suite | Running when this checkpoint was written; final completion record required | `frontend-full.log`, `frontend-full-result.json` when complete |
| Runtime dependency advisories | Frontend **0**, backend **0** known advisories, fresh `npm audit --omit=dev` | `frontend-runtime-audit.json`, `backend-runtime-audit.json` |
| Frozen MediaService | Unchanged SHA256 `b5db3723b534c0e00371a0f0d15a8289b20a12d58e0bcdb61622dc8d2b6c0d3f` | Actual source hash checked after full backend run |

The full backend retains authentication/refresh/revoke, server permissions and private costs/media, financial idempotency/concurrency, compound services/returns, credit and inventory tests. Tests use generated disposable databases on the identity-verified 55459 development cluster. Saved shop 55439 is not started, migrated or used by these commands.

Expected anonymous initial-refresh 401s, deliberately disconnected/outage 503s and rejected concurrent purchases are not hidden. Their recovery/state assertions pass. There are no external gateway charges. Local timings include concurrent regression load and are not a Hostinger performance estimate. The initial complete package's cold entry took 6.84 seconds; the R2B historical timeout remains unexplained and requires actual hosting measurement.

## Failed/interrupted work retained

The first five clean-shop rehearsals stopped at explicit assertions; they are not combined into a passing count. Locator/save-completion and receipt expectation corrections are explained in `TAHA_POS_R2C_CLEAN_SHOP_ACCEPTANCE.md`. The fourth run also exposes an interrupted-session-restoration sign-out case, retained as an open regression. No test assertion about money/stock/privacy was removed. No application replay protection was relaxed.

## Not tested / not deployed

- Actual Hostinger target, Linux native dependency installation, reverse proxy, public HTTPS/startup/restart/resource limits.
- Actual external PostgreSQL role permissions, schema functions/extensions, verified TLS and transaction pooler behavior.
- Real provider S3 POST policy, CORS, exact upload bounds, private originals/thumbnails and redeploy/backup durability.
- Hosted owner bootstrap and two real internet sessions, session expiry/interruption, provider outages and recovery.
- Physical Android camera/scanner/gallery/pairing/process-death/offline behavior or a newly built APK.
- Windows native EXE/installer, SQLite acceptance, thermal printer, HID scanner or customer second monitor.

Local implementation, automated verification, real provider verification, physical testing and deployment are separate acceptance levels. R2C deployment acceptance and daily production readiness remain **NO** until applicable gates pass.
