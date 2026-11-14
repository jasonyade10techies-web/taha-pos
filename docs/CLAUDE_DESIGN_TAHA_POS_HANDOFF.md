# Claude Design handoff — Taha Mobiles / Taha POS

## Purpose

This is an audit/proposal handoff, not permission to redesign or rewrite the application. No Claude Design review has been performed by this phase. Use the actual repository and synthetic screenshots, identify workflow problems, propose bounded changes, then obtain the owner's design direction before implementation.

Taha Mobiles is initially one Pakistani mobile-parts and repair shop with one primary counter. Taha POS is the Windows/browser counter product; Taha Staff is a dedicated bundled Android app. PKR is the currency. Keep the coded TM/Taha Mobiles identity, permanent business name, compact professional retail focus and existing approved workflows. Owner-only operation and optional staff are both supported.

## Design direction to preserve

The current approved neutral-gray light/dark revision is authoritative. Light uses `--background:#f3f3f3`, white `--surface`, `--text:#202020`, gray borders and a charcoal sidebar. Red and gold are brand/action accents. Use `src/styles/globals.css`, `auth.css`, `staff.css`, `mobile.css`, `device-bridge.css`, `product-hardening.css`, `receipt-print.css` and `invoice-print.css` as evidence. Do not replace tokens with a new independent palette.

Reuse existing `Button`, `Dialog`, workspace controls, custom select/combobox, date controls, checkboxes, compact tables and typography. High-dependency primitives need broad regression. Avoid huge cards, excessive vertical whitespace, cramped mobile tables, native-looking inconsistent controls and decorative interactions that slow checkout. Preserve keyboard/HID scanning and touch access. Provide keyboard focus, legible contrast, reduced motion and useful loading/error/empty states.

## Source and route map

| Workflow | Implementation |
|---|---|
| Desktop routing/layout | `src/app/app.tsx`, `src/components/layout/app-shell.tsx`, `header.tsx`, `sidebar.tsx` |
| Dashboard `/dashboard` | `src/features/dashboard/dashboard-page.tsx`, `src/components/dashboard/` |
| New Sale `/pos` | `src/features/pos/`, `src/stores/cart-store.ts`, `src/stores/session-store.ts` |
| Customers/credit | `src/features/customers/`, `src/features/credit/`, repository and customer-activity implementations |
| Products/editor/media | `src/features/inventory/products-page.tsx`, inventory/media components and `server/src/media/` |
| Inventory locations/receiving/transfers | `src/features/inventory/`, PostgreSQL movement functions/migrations |
| Returns/receipts/invoices | `src/features/pos/`, `src/lib/` receipt helpers, print CSS; inspect actual route imports |
| Settings/devices | `src/features/settings/`, `src/components/devices/`, device-bridge stores/services |
| Mobile entry/routes | `src/mobile-bootstrap.ts`, `src/mobile-main.tsx`, `src/app/mobile-app.tsx`, `src/features/mobile/mobile-routes.tsx` |
| Mobile home/sales/activity/profile/settings | `src/features/mobile/mobile-*-page.tsx`, `mobile-shell.tsx` |
| Mobile scanner/camera | native `ScannerActivity.java`, `MainActivity.java`; `src/features/mobile/` capture/scanner workflows |
| App updates/downloads | `src/features/mobile/app-updates-page.tsx`, `src/components/devices/android-downloads.tsx`, `distribution/` |
| Shared domain/data | `src/types/`, `src/repositories/`, `src/lib/data-source.ts`, hooks and stores |

Verify exact child component names from route imports before editing. A source graph is a navigation aid, not evidence that a workflow is financially complete.

## Critical workflows to review

1. Dashboard → relevant filtered records: compact summaries, correct date scopes, readable chart tooltips and clear data freshness.
2. New Sale: fast search/barcode, product identity/stock, customer selector beside Custom Service, cart editing and checkout without losing the draft.
3. Smart service: mention an actual product, one combined customer charge, visible part/labor allocation for authorized staff, stock/price review, minimum-price approval and atomic checkout. Customers see one service line.
4. Payments: cash, split/digital/manual evidence, credit due date, pending/confirmed state and manager approval. Never equate a button click with a committed payment.
5. Returns: original invoice, only-returnable-item selection, sellable versus damaged/quarantine destination, explicit refund versus credit adjustment and immutable history.
6. Customer workspace: contact/profile, invoices, credit ledger, partial collections, reversals, timeline, copy reminder/open WhatsApp and overdue wording.
7. Product editor: known/unknown purchase cost, selling/minimum price, aliases, variants, Rack→Shelf→Box, batch images/crop/reorder/primary and phone capture into the correct field.
8. Inventory: available/damaged/out-for-test quantities must remain distinct; transfers must not imply new stock. Show safe receiving, adjustment, recovery and write-off confirmations.
9. Customer Display: customer-safe live cart/payment state, no cost/profit/internal controls. Native second monitor remains a hardware gate.
10. Receipts: white compact80mm thermal layout and A4 invoice; correct returned/refunded totals, customer-safe virtual receipt and reasonably sized QR. Dark theme must not produce dark paper.
11. Mobile: app-sized navigation, prominent QR scan, clear camera request sheet, product images, retained photo queue, connection states, login/pairing and useful empty requests state.
12. Android updates: distinct installation versus pairing QRs, current/available version, progress, compatibility errors, user-approved installation and preserving in-progress work.

## Boundaries the designer must not change

- NestJS/custom authentication and PostgreSQL financial engine remain. No Supabase reintroduction, fake demo fallback or replacement accounting backend.
- Financial actions are atomic/idempotent/auditable. Price floors, permissions, credit balances, stock allocation, tax snapshots and return rules are behavioral requirements.
- Purchase cost/profit/private evidence must not leak to unauthorized staff or Customer Display.
- Native APK/Windows UI stays bundled. Hosted browser tests do not verify native offline/installer/hardware behavior.
- Cloud polling and LAN device bridge are independent. A downloads-only website does not imply an online shop exists.
- Offline controls must be honest: allowed cached cash sale/outbox versus blocked unsafe mutations, pending sync, conflicts and reconciliation.
- Do not remove useful functionality to simplify a mockup. Keep first-run empty-shop setup and optional modules.

## Screenshots, data and review process

Only synthetic fixtures may appear in shared screenshots. Do not export saved shop records, financial screenshots, payment proofs, camera originals, environment files, tokens or signing material. `docs/pos-first-review.png` predates this handoff and is not automatically approved for external sharing. Fresh synthetic screenshots were captured and inspected at `artifacts/design/R3A/desktop-pos.png`, `desktop-products.png` and `mobile-home.png`; capture metadata is `capture-results.json`. The phone image is browser emulation with deterministic staff fixtures, not physical Android. Generic historical route-test screenshots can capture startup and must not be used as proof of fully loaded screens.

Review desktop1366×768 and1920×1080, phone360–430px, light/dark and reduced motion. Browser mobile emulation must be labelled as such; do not call it a physical Android screenshot. Include current-state evidence before proposing a correction.

Deliver a prioritized issue table (screen, concrete problem, effect, proposed correction, preserved behavior, test), annotated alternatives for only the highest-priority screens, token/component reuse plan and small implementation batches. Separate demo-blocking, production/financial and cosmetic issues. Do not generate another enormous full-application redesign phase.

## Known separate engineering gates

Full repair-job parts/deposit/settlement accounting, native Windows MSVC/SDK build and offline acceptance, physical thermal printer/HID scanner/second monitor, Android lifecycle/update acceptance, stable signing and actual hosted staging acceptance are not solved by visual proposals.

See `docs/TAHA_POS_CLAUDE_GRAPHIFY_HANDOFF.md`, the R3A report and existing R1/R2/local-readiness reports for evidence. The repository remains private; sharing it with a new service or designer requires the owner's authorized access scope.
