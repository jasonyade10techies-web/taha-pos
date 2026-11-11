# Phase 5D.2 Revised Implementation Plan

> For agentic workers: execute bounded tasks with test-driven development, scoped review and fresh verification. Parallel independent domains use dispatching-parallel-agents. The owner explicitly supplied the implementation/design brief and requested continuous execution; do not introduce routine design approvals. No Git repository exists, so no worktree or commit is possible.

**Goal:** Deliver explicit @Product services with trustworthy allocation/accounting, secure companion enrollment, neutral-gray UI and honestly gated LAN/native operations.

**Architecture:** Preserve React/Vite, NestJS/PostgreSQL, Java WebViewAssetLoader, Tauri/SQLite. UI stores structured mention identity; transaction engine validates and snapshots compound revenue/cost separately. Enrollment adds proof-of-possession and authenticated desktop approval instead of exposing existing owner credentials. Unsafe independent offline writers remain disallowed until counter authority is proven.

**Spec:** `docs/PHASE5D2_REVISED_OWNER_BRIEF.md` (owner supplied, authoritative).

## Constraints / review focus

- No destructive data resets, edits to applied migrations, dependency upgrades, new framework, production deployment or Supabase restoration.
- Preserve layouts and historical receipts; unknown cost stays unknown. Receipt paper stays white.
- Never infer stock consumption from unmatched text; one token owns one immutable component ID/variant.
- Price snapshots must reject stale current prices; no client-supplied labor/profit/cost trusted.
- QR enrollment must not expose reusable secrets or work as unprotected HTTP credential issuance.
- Test cursor edits/paste/IME, ambiguous variants, changed floors, duplicate submits, missing media, revoked device sessions and stock races.

## Task 1 — Composer and desktop/mobile price integration (root)

Files: `src/lib/service-composer.ts`, `src/lib/compound-service.ts`, `src/components/pos/service-mention-composer.tsx`, `custom-service-dialog.tsx`, `price-dialog.tsx`, `cart-row.tsx`, `src/features/mobile/mobile-service-dialog.tsx`, `src/types/{product,demo}.ts`, `src/stores/cart-store.ts`.

Interface: `ServiceMaterial.pricing?:{sellingPrice:number;minimumSellingPrice:number;reviewedAt:string}`; price amounts per component unit. Server calculates final per-service allocation using quantity and net accepted line price. Structured editor `{before:string,mention?:{productId:string,label:string},after:string}` never parses arbitrary HTML for checkout.

- [ ] Reproduce missing mention with browser fixture after cold-start preflight.
- [ ] Add model tests for insertion/deletion/replace/paste, price2000/total2500→2000+500, total2000→2000+0,1800→1800+0/discount200.
- [ ] Implement explicit product search/token, per-token summary, live split and current-price refresh; retain existing location allocation and plain-service suggestion behavior.
- [ ] Integrate cart price editing/quantity and safe floors/approval UX; preserve IDs and proofs.
- [ ] Test mobile and desktop variants, no pre-checkout movement, stale price review, no negative labor.

## Task 2 — Financial domain and templates (backend accounting agent)

Files: new `server/migrations/202610220200_compound_service_allocations.sql`, isolated SQL tests, local transaction/material/template repositories and contract types coordinated with root.

- [ ] Write failing transaction tests for allocations, old linked-service floor bypass, immutable snapshots, return policy and repeat checkout.
- [ ] Validate current product, pricing snapshot, stock, minimum/discount permission and approval against original linked identity. Do not consume approval twice or bypass mature tax/coupon rules.
- [ ] Persist per-item product/labor/discount/tax snapshots in protected append-only records; extend authorized DTOs without leaking costs. Retain original customer-facing single charge.
- [ ] Store product-linked reusable templates with current-price rule/default labor and attribution; archived references require review.
- [ ] Default compound returns to product allocation; explicitly authorize labor refund and preserve debt/tax/condition accounting. Test partial/final rounding and materials.
- [ ] Run new and existing backend/local regression cases in isolated databases.

## Task 3 — Companion device enrollment (device agent)

Files: isolated auth/device NestJS module/migration/controllers/tests; device bridge services, Devices and mobile unauthenticated connection UI; Android key/session storage APIs. Coordinate shared root files before edits.

- [ ] Trace existing auth/refresh/revoke/bridge and write security failures first.
- [ ] Implement expiring single-use signed enrollment challenge, device proof of possession, desktop authenticated approval and separate restricted revocable session.
- [ ] Require protected exchange or authenticated encryption/pinning for LAN; do not downgrade to cleartext bearer enrollment. Retain normal sign-in/manual fallback.
- [ ] Add pending approval/device state UI, logout/revoke semantics and tests for replay/expiry/wrong shop/role/device.
- [ ] Examine LAN discovery/authority dependencies; implement bounded safe discovery/status support where possible and document remaining native/hardware boundaries.

## Task 4 — Neutral tokens and UI (theme agent)

Files: theme/global CSS, isolated component styles, relevant visual tests/screenshots. Avoid root service styles and transaction logic.

- [ ] Reproduce navy colors using computed tokens; assert requested neutral values and semantic states.
- [ ] Apply specified gray light/dark tokens, gold#F2BC2D and red identity consistently; remove hardcoded blue-neutral surfaces while preserving semantic chart/status distinctions.
- [ ] Inspect screenshots of Dashboard/POS/products/customer/settings/mobile in both themes, contrast and white receipt assertions.
- [ ] Report exact files, passing tests and untouched outstanding structural corrections.

## Task 5 — Integration/operational reliability (root after domain gates)

- [ ] Close prior obsolete-control browser assertions without weakening behavior checks; investigate actual failures independently.
- [ ] Correct remaining returns7-page/history switch, receipt sharing/reference and settings/mobile details from brief.
- [ ] Verify native authority truthfully; prevent unrelated phone/desktop offline deduction; preserve reconciliation evidence.
- [ ] Run backend/browser/SQLite/Android regressions, record exact counts and failed/unavailable gates.
- [ ] Back up saved local DB before new migrations; never seed it. Keep preview running.
- [ ] Build new versioned test APK with signature/hash/assets/download verification; physical acceptance separate.
- [ ] Write `docs/PHASE5D2_REVISED_IMPLEMENTATION.md` with full A–G report and scenario matrix, remaining owner/hardware/cloud blockers.
