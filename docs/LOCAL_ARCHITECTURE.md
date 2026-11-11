# Phase 2 local prototype architecture

The current browser review build is explicitly LOCAL DEMO. It continues the existing React/TypeScript/Tauri 2 app rather than replacing its shell. The earlier Supabase foundation remains dormant; nothing has been applied to a hosted backend.

## Data flow

```text
Feature page → useRepository/useAction → typed repository contract
                                         ↓ local adapter
                                    Dexie / IndexedDB
                                         ↓ committed transaction
                      query invalidation + session/permission refresh + toast
```

`src/lib/repositories/interfaces.ts` defines the product, inventory, location, sale, credit, service, device, employee, shift, report, website and configuration boundaries. `index.ts` composes local implementations. Replace adapters and retain these feature contracts during backend integration; hosted UUIDs and row-to-domain mapping belong in those adapters.

## Database

Dexie database: `taha-pos-local-prototype`, version 1.

| Stores                              | Responsibility                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| products, financials, services      | Safe catalog/variant fields, separate purchase cost, service prices                                |
| locations, balances, movements      | Permanent hierarchy codes, current per-box balance, append-only movement history                   |
| sales, saleCosts, payments, returns | Invoice snapshots, historical cost snapshots, payment/refund/reversal entries, returned quantities |
| customers, ledger, testOuts         | Individuals/shops, running debt, stock held for testing                                            |
| devices, suppliers                  | Individually purchased phones and supplier contacts                                                |
| employees, shifts                   | Explicit permission grants, schedules/opening/closing cash                                         |
| coupons, paymentMethods             | Eligibility/date/usage limits and enabled checkout methods/QR                                      |
| enquiries, jobs, website            | Repair enquiries/jobs and local website visibility/price settings                                  |
| audit, drafts, settings, meta       | Activity history, receipt drafts, preferences, seed/code/idempotency counters                      |

`atomic()` includes all relevant stores in one read/write transaction. Committed operations invalidate cached views. Related stock, payment, credit and audit writes either all succeed or roll back. Friendly codes are generated from transactional counters; editable friendly location names do not alter permanent codes.

## Inventory and financial invariants

- Stock is summed from location balances and backed by movement events; service sales never deduct inventory.
- Receipt rows validate product, quantity, cost and destination before a transaction can commit.
- Transfers decrease the source and increase the destination with paired movement history.
- Checkout validates authoritative catalog prices, stock, coupon eligibility, payment allocations, electronic confirmation and credit limits. Its request identifier prevents duplicate checkout.
- Split checkout supports cash plus a digital method and an optional credit portion. Credit is added to the selected account, while collected cash/digital values remain separate.
- Negative stock remains blocked by default. Enabling it explicitly updates the POS controls and stock mutation policy; an individually tracked used device still cannot be sold more than once.
- Sale lines preserve their allocated source boxes. Reversal and sellable returns restore the original stock locations. Damaged/non-stock returns do not increase sellable stock.
- Out-for-test decreases availability and records a held quantity without revenue. Return releases the hold. Conversion restores then sells inside the same transaction so stock is deducted only once.
- Credit payment collection changes debt/payment history, never inventory. Credit returns reduce remaining debt first and record any cash refund remainder separately.
- Purchased devices create one inventory unit and a distinct tracked record. Sold, returned and reversed devices update status.
- Profit reports use historical sale cost snapshots and refund/stock disposition, rather than today's changing purchase prices.
- Audit has read-only UI and no per-record delete controls. Reset intentionally clears all prototype data after confirmation.

## Session and permissions

The default demo owner is Ahmed Khan. Employee switching uses an explicitly public demo PIN; it is not authentication. Switch/sign-out clears cart/dialog/query state. Profile and explicit permissions are reloaded from the local database after changes. Route guards deny unauthorized direct URLs, and local write adapters check the relevant permission. Owner receives unrestricted demo access.

This does not make IndexedDB secure against the device user. Its entire database and bundled seed fixtures are accessible locally. A live release requires the existing server-side Auth/RLS/cost separation and secure PIN implementation plus backend adapters for every business mutation. There is no production PIN/hash in the client.

## Customer display

BroadcastChannel carries a deliberately reduced snapshot: item name/variant, quantity, unit price, subtotal, coupon savings and total. No costs, profit, stock, minimum price, employee permissions or debt are broadcast. A standalone public display does not receive the initial employee sample cart. Idle mode shows brand/promotions and enabled local payment account/QR previews. Production Auth regression mode never queries the local database for payment methods.

## Persistence boundaries

- IndexedDB: seeded and edited local prototype business records, including uploaded demo images.
- localStorage: theme/sidebar preference only; no cart or business rows.
- sessionStorage: chosen demo identity, signed-out flag and one-time sample basket marker.
- memory/Zustand: active cart, dialogs, transient approval and feedback state.

Development and production preview have different origins/ports and therefore separate databases. Clearing site data removes local records. Cross-tab cache invalidation, migrations of old prototype records, backups, cross-device synchronization and durable offline sync are not implemented.
