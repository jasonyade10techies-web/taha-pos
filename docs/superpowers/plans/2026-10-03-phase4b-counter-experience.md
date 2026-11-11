> Historical initial plan. The user subsequently authorized a custom NestJS/PostgreSQL backend inside `server/`. The current implementation and validation checklist are in `docs/PHASE4B-CONTINUATION.md`; Supabase is retained as an explicit legacy adapter only. Remote pairing/camera/auth are implemented through the shop API.

# Phase 4B Counter Experience Plan

## Goal

Polish the existing approved counter workflow without replacing the Dashboard, POS layout, local repositories, or Supabase transaction boundary. Add a sanitized terminal-scoped display event stream, searchable customer selection, reusable camera request abstraction, profile/settings controls, contextual help, virtual keyboard support, and consistent receipt/currency presentation.

## Existing boundaries

- `useCustomerDisplay` and `useCustomerDisplayPublisher` already sanitize cart data and communicate through `BroadcastChannel`.
- `CartPanel`/`CheckoutDialog` own the approved POS cart and checkout UI.
- Repository interfaces have local and Supabase implementations for customers, payments, settings, sales and assets.
- `/customer-display`, `/profile`, `/settings` and `/pos` routes already exist.

## Implementation slices

1. **Display event model** — extend the existing display channel with terminal-scoped session metadata and events for cart start/update, checkout, payment method, awaiting payment, sale complete and cancellation. Keep the payload customer-safe. Add an idle fallback, live order, checkout/payment instructions, cash change, credit balance and delayed thank-you state. Add POS connection status/open-display controls and settings for display behavior.
2. **Customer selection** — add a reusable searchable combobox and an in-sale add-customer dialog. Search name/phone/shop, keep Walk-in first, show recent customers and permission-safe outstanding balance, then select a newly saved customer without leaving checkout.
3. **Checkout synchronization** — publish customer, checkout and payment-method changes from the existing dialog. Add clear employee-facing status text, preserve proof controls only on the employee side, and keep customer display free of minimum prices, credit history, stock, approvals and internal notes.
4. **Camera jobs** — add a reusable local camera request store/service with job types and statuses, mobile-friendly `accept="image/*" capture="environment"` capture, proof/product/device/customer/profile/damage request cards, and a desktop status panel. Keep Supabase/network pairing as an explicit future adapter rather than inventing a second auth system.
5. **Profile/settings/help** — add profile photo controls, change-password/connected-device foundations, explicit switch/logout actions, Phase 4B settings sections, `InfoTooltip`, and replace ambiguous customer-display wording. Add only useful tooltips.
6. **Touch keyboard and currency/receipt polish** — centralize `formatCurrency` as PKR, add an optional numeric/full virtual keyboard targeting the focused field, and refine the existing invoice/receipt wording and status emphasis without changing transaction data.
7. **Validation** — add focused Playwright coverage for display states, customer search/add, PKR formatting, camera status, profile/settings controls and virtual keypad; run build, lint, production smoke and the existing transaction/security suites.

## Constraints

- No purchase cost/profit/minimum price/stock location/employee controls cross the customer display.
- No payment proof, passwords, auth tokens or sensitive financial data in ordinary local storage.
- Existing local demo mode and Supabase mode remain separate.
- Native second-monitor/Tauri APIs are not introduced in this phase; browser window/tab behavior is the implementation.
