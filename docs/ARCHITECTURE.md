# Phase 2A architecture

This documents the retained earlier backend foundation. The current Phase 2 UI runs as an explicit local prototype; see [current local architecture](LOCAL_ARCHITECTURE.md) and [Phase 2 verification](PHASE2-REPORT.md). No hosted backend was connected during the local prototype phase.

The approved shell and design system remain intact. `app/app.tsx` composes Query, Auth, Motion and browser/native routers. Auth services centralize Supabase operations; components never infer access from user metadata or compare PINs. The current session Zustand store was extended rather than duplicated.

The Auth provider bootstraps the SDK session, retrieves server context, observes Auth changes, and refreshes permissions on focus and periodically. Identity changes, permission changes, logout and expiry clear query/cart/dialog state. In-flight context loads are invalidated at signout/lock to prevent stale restoration. Server checks remain authoritative on every request. The SDK persists its management/terminal Auth session; employee capability tokens stay in memory.

Route guards are an independent frontend boundary in addition to PostgreSQL authorization. Unknown routes deny by default. `/profile` belongs to any active employee. `/customer-display` is intentionally public and exposes only customer-safe ephemeral snapshots; it does not grant access to app data. Owner navigation remains visually unchanged; a denied module displays Access Denied even when entered directly.

All 15 application tables enable RLS. Twelve public tables have intentional SELECT policies, while private PIN/session tables have no client grants. Direct client mutations are denied until atomic business workflows exist. Management/self-profile RPCs check their actor and target. Non-owner delegation is bounded by the actor's own grants and excludes self-escalation/owner targets. Grants are branch-scoped.

`products` and employee POS queries contain no purchase cost or profit. `product_financials` and cost RPCs require `costs.view_purchase_cost`; profit has its own gate. The admin Product domain model retains a cost field for future authorized composition. Actual mock products no longer contain purchase costs at all. Live builds do not bundle mock Dashboard financial histories. Live financial panels use unavailable states because no sales ledger exists yet.

The shared counter uses a dedicated low-privilege Auth account without a person profile. Only server PIN verification yields an active employee identity. bcrypt cost 12, terminal-wide failure lockout, token digests, expiry/revocation, membership/status checks and management-sign-in restrictions are implemented in SQL. Future sale RPCs must derive their actor from `current_profile_id`, not an employee ID supplied by the browser. Mock mode never accepts a PIN.

Products/locations have sequence-assigned permanent friendly codes. Rack/Shelf/Box hierarchy and same-store references are constrained. Signed stock movements and audit logs are append-only; stock balances derive from a security-invoker aggregate. Movement writes and shift workflows are denied until transactional receiving/sales/transfer functions are added.

The POS cart and checkout remain previews. Discount controls observe explicit permission and minimum/maximum bounds; no backend transaction, manager override authentication, payment or receipt is implemented. Customer display uses a sanitized BroadcastChannel preview, not a native monitor-management or persistence service. Offline UI remains an honest preview with no outbox/synchronization.

Native OAuth prepares restricted opener/deep-link/single-instance plugins, a validated protocol callback, PKCE, and Supabase HTTPS CSP scopes. Email sign-in remains independent of Google. Rust/MSVC/SDK are missing, so native compilation/plugins/callback behavior remain unverified on Windows. The Tauri config schema passes, but that does not establish native launch success.

Operational setup, all SQL objects, trusted bootstrap and manual hosted verification are documented in `supabase/README.md` and `docs/SUPABASE_SETUP.md`. Use a dedicated project because migrations revoke broad public-schema client grants. Generated Supabase types can replace the checked-in typed domain/RPC model after hosted deployment.
