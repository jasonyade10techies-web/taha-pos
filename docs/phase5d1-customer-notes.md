# Phase 5D.1 — customer workspace implementation notes

21 October 2026. Scoped customer stage; shared shop configuration, full-ledger SQL and shared calendars are coordinated with the parent implementation.

## Root causes and changes

- Customer detail used Activity / Ledger, Ledger, Invoices, Returns, Out for Test and Profile as competing top-level navigation. It is now a responsive 30/70 contact/account column and one account-history panel, with Timeline as default, Ledger as alternative, and All / Purchases / Payments / Returns / Test Items / Notes filters.
- History used small invoice-only links; other source records could not be inspected directly. Whole entries are keyboard/touch buttons. Typed dialogs retain parent filter/search/page state and expose purchase items, quantities, payment history, exact payment, return condition/reason/debt/refund fields, test details or the full immutable note/reminder message. Staff attribution is omitted in owner-only presentation; source records are unchanged.
- Recent global return/payment lists had caps, so older details could silently disappear. New `customer_activity_detail(store, customer, eventId)` reads the exact scoped source record. Each source permission is checked independently; customer-only and return-only access do not inherit sales/payment access. Payment attachments remain permission scoped.
- Summary previously grouped every ledger credit as payments/reversals. It now shows all-history charges, outstanding, applied payments, return reductions, reversals and other adjustments separately. Only complete customer ledger rows feed these calculations. Timeline presentation suppresses duplicate ledger representations when the purchase/payment/return source entry already exists; Ledger retains every original accounting entry.
- Ledger balances are computed chronologically over the complete relevant account before category/date/search/pagination. API mode uses the parent stage's complete-customer-ledger endpoint. Filters do not reset balances; invoice links remain available.
- Undated debt previously said Not configured. Outstanding obligations now show No time limit and their exact taken timestamp. Date-only source values explicitly say time was not recorded. Dated obligations show the exact available due timestamp and relative days; undated obligations are grouped separately. Settled accounts remove overdue warnings and payment reminders.
- Inline payment reminders use existing obligation/message/phone-validation/manual-history operations. Before copying/opening, fresh server values are checked against the reviewed amount/deadline/number. Only prepared/opened actions are recorded. No sent or delivered claim is made. Invalid phone numbers disable WhatsApp and offer Edit Number and Copy Message. Test-return reminders remain separate and reuse the existing manual reminder dialog.
- New Sale previously overwrote a populated draft's customer silently. It now offers Continue existing draft, Use this customer for existing draft, or Cancel. Cart lines and draft IDs are preserved.
- Visual inspection exposed a demo projection labeling a `refund` record with the Credit method as a refund. That source event now says Return debt adjustment; financial records and engine are unchanged. Selected demo invoice outstanding is derived from its full linked ledger copy instead of the stale original credit amount.
- Expanded settlement testing found a null-draft crash in the new inline reminder after the final payment. The draft guard was repaired and the previously failing settlement reproduction passed.

## Source and API changes

- `src/features/credit/credit-pages.tsx`
- `src/features/credit/customer-activity.tsx` and `.css`
- New `customer-account.ts`, `customer-reminder.tsx`, `customer-event-detail.tsx`
- Optional `CustomerRepository.activityDetail` and `CustomerActivityDetail` contract
- Exact local activity detail adapter and truthful local debt-adjustment event projection
- Custom API controller operation and adapter: `GET /stores/:storeId/customers/:id/activity/:eventId`
- Versioned migration `server/migrations/202610210120_customer_activity_detail.sql`
- `tests/phase5d1-customer.spec.ts`, `server/test/phase5d1-customer-detail.test.ts`

Existing customer edit validation, payment collection form/operation, financial writes, backend permission boundaries, source actor attribution, receipt snapshots and stock operations are preserved.

## Verification evidence

- Initial failing reproduction: missing coherent Customer account workspace region (expected against old UI, one failed test). Trace and screenshot were retained in the isolated local-browser result directory.
- First implementation browser pass: 3/3, 45.6 seconds.
- Expanded browser run: 4/5; settlement exposed the null-draft failure above. After repair: 5/5, 1.2 minutes.
- Final expanded browser run: **6/6 PASS, 1.4 minutes**, including test-item and prepared-reminder detail verification, invalid-number and settlement behavior, safe draft conflict, ledger continuity and all requested responsive captures.
- Exact backend source-detail/security test: 1/1 PASS, 4.6 seconds, against a newly created isolated PostgreSQL database on the existing test instance. Tests covered purchase/payment/return/ledger/note details, an old payment beyond 110 newer notes, cross-customer denial, customer-only financial denial and return-only access without purchase/payment leakage. Initial attempt was blocked by the separate catalogue migration's missing alias; that migration was corrected by its owner before the passing rerun.
- Scoped ESLint on all changed customer UI/model/local activity files: PASS.
- Shared full TypeScript check was attempted; it reported in-progress inventory imports and a separate media fixture's JSX/ImportMeta configuration errors, with no customer-source errors. Parent stage owns the final integrated typecheck/build result.
- Captured all requested light/dark viewports: 1920×1080, 1440×900, 1366×768, 1024×768, 390×844 and 412×915, with horizontal overflow assertions, plus dark customer-history dialog. Files: `docs/screenshots/phase5d1/customer-{light|dark}-{width}.png`, `customer-history-detail-dark-1366.png`. Inspected representative desktop light, mobile dark and dark detail captures. Animations are disabled only for screenshots so captures show settled surfaces.

## Boundaries

These are automated browser fixtures and isolated PostgreSQL source/security tests. No live shop/test records were edited or deleted by this stage. Real API-backed shop preview, final integrated builds, physical Android/WhatsApp/printing acceptance and deployment are the parent handoff's separate verification work. Old records without source details remain explicitly unknown; no missing cost, condition, actor, proof or timestamp is manufactured. Large histories currently load authorized event pages before local search/pagination; a future server-side unified search could improve very large-account performance.

