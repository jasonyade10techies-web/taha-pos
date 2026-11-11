# Phase 1.1 + Phase 2A verification

Verified on 02 October 2026 in `D:/Inventory system POS`; application version 0.2.0.

| Check | Result |
| --- | --- |
| npm dependencies/lockfile | Installed successfully; audit reported 0 vulnerabilities |
| Strict TypeScript and production frontend build | `npm run build` passed |
| ESLint | `npm run lint` passed, no errors/warnings |
| Tauri configuration | Installed Tauri 2 JSON schema, icons and main capability validation passed |
| Native Rust tools | rustc, cargo and rustup commands: program not found; no host/toolchain available |
| Native C++ prerequisites | Tauri detected no VS/MSVC/Windows SDK; vswhere and SDK Include directory absent |
| WebView2 | Installed, 154.0.4258.48 |
| `npm run tauri dev` | Failed at cargo metadata: program not found; no native window opened |
| `npm run tauri build` | Same prerequisite failure; no executable/MSI/NSIS generated |
| Browser suite | 16 passed; includes all 9 approved Phase 1 checks |
| Final counter-logout check | 1 targeted test passed after adding server counter-session revocation on Sign Out |
| Final live Dashboard check | Targeted authorization test passed after removing demo-only footnotes from live pending panels |
| SQL migration execution | All four applied successfully in embedded PostgreSQL with pgcrypto |
| PostgreSQL security/constraint suite | 20 checks passed |
| Frontend credential boundary | Recognizable secret/service-role keys rejected before bundling, without printing values; no mock financial values in live bundle |
| Production smoke | Passed fail-closed login/routes, customer display, dark persistence, CSP and simulated native hash routing |
| Browser runtime/console | No obvious errors observed in UI/production smoke; Auth requests in live-mode browser tests were intercepted fixtures |
| Hosted Supabase/Auth/Google | Not tested or deployed: no actual project URL/key/accounts/provider configuration supplied |
| Visual QA | Approved Dashboard/POS retained; matching light/dark login and PIN interface inspected |

## UI coverage

Sidebar links/collapse, command search, F1/F4/Escape, light/dark/system persistence, add/quantity/remove/stock limits, negotiated prices, coupons, checkout preview, offline preview and safe customer-tab updates all pass. Layouts are checked at 1024x680, 1366x768, 1440x900 and 1920x1080, with no horizontal overflow and cart total/checkout visible.

Auth checks include mock owner signout/login, guarded URLs, no role assignment from user metadata, inactive-profile denial, restricted Dashboard profit without any profit request, employee POS without price-negotiation permission, terminal PIN RPC/token use, memory-only employee capability, reload lock, permission-revocation cache/cart cleanup, Auth session removal and empty public customer view. Tests use a real installed SDK against an intercepted local endpoint; its test key/JWT are deliberately nonfunctional and not Supabase credentials.

## PostgreSQL coverage

All 15 tables enable RLS. Tests exercise anonymous/unprovisioned denial, role-only denial, branch-scoped grants, cost/profit independence, raw financial table filtering, safe POS response, direct mutation denial, owner all-permission access, trusted provisioning/self-profile update, bounded delegation, inactive/membership revocation, bcrypt hash privacy, terminal account isolation, valid/wrong/replaced/expired tokens, owner counter management restrictions, committed five-failure lockout, append-only ledgers, permanent codes, valid hierarchy, movement signs, derived balances and audit event/actor control.

This executes actual PostgreSQL functions, RLS and crypto. Auth UID/role/header claims are test fixtures. It does not verify deployed PostgREST grants, Supabase configuration, real password/OAuth accounts or a native WebView2 session.

## Windows installation attempts

User-scoped official winget Rustup installation returned `No applicable installer found`. Automatic approval review rejected execution of the official Rustup installer with `blocked by policy`; that action was not executed or bypassed. No unattended Visual Studio installation was performed. Install Rust/MSVC/SDK manually as documented in `docs/SUPABASE_SETUP.md`, then perform real native launch/build and OAuth checks.

## Remaining scope

No real POS persistence, ledger/profit computation, product CRUD, stock receiving/transfer UI, repairs, credit ledger, receipt printing, full shifts, offline synchronization, public website or native second-monitor management was added. Live financial panels show pending states instead of demo history. Hosted deployment and native validation remain external setup requirements, not successful results of this task.

Exact next phase: Phase 2B — hosted Supabase provisioning and real email/Google/PIN/permission plus native Windows validation. After that, Phase 3 — permission-aware product catalog, permanent Rack/Shelf/Box locations and atomic stock receiving/movements.
