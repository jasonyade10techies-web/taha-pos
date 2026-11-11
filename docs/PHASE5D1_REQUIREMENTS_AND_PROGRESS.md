# Phase 5D.1 requirements and progress

Started 21 October 2026. Source brief: the owner's supplied Phase 5D.1 document and 18 screenshots. This is implementation within the existing application; no hosting, Supabase restoration, Windows tool installation or data reset.

## Intent and execution decisions

Preserve the approved dashboard, desktop POS split, product editor/gallery, Manrope and Taha branding. Make the customer account a coherent account workspace, remove avoidable daily staff controls in reversible owner-only operation, correct screenshot workflow defects, and add independently scoped online mobile sales. Existing financial, permission, stock-condition and offline reconciliation rules remain authoritative.

The owner explicitly requested continuous implementation without routine design approvals. Their detailed document is the approved design brief. Work is decomposed into independently testable tasks; no additional approval gate is inferred. The existing checkout is the requested workspace; preserve uncommitted work and records. No Git repository metadata was previously available; verify before considering any Git operation.

## Checklist and ownership

| Requirement | Main files/area | Status | Verification |
|---|---|---|---|
| Inspect source, reports and reproduce screenshots | Existing reports, scoped tests | In progress | Record initial failing checks separately |
| Owner-only/staff and setup | shop-configuration hook, settings, navigation, versioned SQL | In progress | Persistence, active shift/unresolved-operation refusal, preserved actors |
| Customer workspace and history | features/credit/customer*, credit-pages | In progress | Timeline/ledger, due states, detail, draft protection, reminders |
| Dashboard drill-through and wording | dashboard, summary/report routes | Pending | Correct amounts/range/filter destinations; source-specific activity |
| Stable POS customer header | components/pos/customer-combobox, cart | Pending | Before/after bounds, one secondary line |
| Transactions and split Returns | features/sales/transactions-page | Pending | Full rows, payment/refund direction, read-only completed returns |
| Shared searchable controls/calendars | components/ui, inventory | In progress | Keyboard, empty/create states, no datalist/native date popup |
| Master values and quick-create | catalog repositories, SQL, inventory | In progress | Stable IDs, normalization, no duplicate stock |
| Product detail/media fallback | features/inventory | In progress | Private URLs retained, truthful missing-file fallback |
| Stock, storage, receiving, transfers | inventory, SQL | In progress | Conditions, service/tracked exclusion, unknown cost, full paths |
| Dedicated mobile sale and sharing | features/mobile, Android bridge | In progress | Separate draft, server acceptance, proof, content URI share |
| Mobile/offline concurrency safety | backend sale and offline grant | In progress | Final-unit race; unsafe offline lease/capture refusal |
| Build/test/visual evidence | scoped fixtures and screenshots | Pending | Fresh results, initial failures retained |
| Updated APK and live preview | Android scripts/artifacts/local launcher | Pending | Version/signature/hash/download/health verified |

## Confirmed source findings

- Customer account has competing Activity/Ledger, Ledger, Invoices, Returns, Out for Test and Profile tabs. Its New Sale action directly overwrites the existing cart customer.
- Transactions and customer activity use `input type=date`; product master suggestions use native `datalist` rather than the custom supplier menu.
- API credit ledger uses the generic paginated transaction reader (default 100 / maximum 500); complete running balances need a dedicated full customer ledger read.
- API receiving adapter maps missing purchase costs to zero. Service products can appear in receiving selection.
- Offline cash grants are stateless signed eight-hour authorizations. Mobile becomes a second stock writer; a server-recorded conservative lease guard is required before claiming safe simultaneous mobile/native operation.
- Prior audit documented missing historical file bytes. A UI fallback cannot restore absent evidence or justify making private files public.

## Evidence policy

Implemented, automatically tested, physically tested and deployed are separate states. Never relabel old passing results as current verification. Keep isolated test fixtures away from the saved owner development database. A new APK is test/debug signed unless independently established otherwise.

## 22 October checkpoint

Most requested UI implementation is present; final Phase5D.1 acceptance remains open. See `PHASE5D1_IMPLEMENTATION_AND_ACCEPTANCE.md` for exact fresh results, runnable APK/localhost, backup/migrations and remaining work. Customer6, inventory11, mobile5, desktop6, real API3, backend159, SQLite16 and Android23 tests passed in their scoped runs. Both builds/lint/typecheck passed at integrated checkpoints; repeat after final edits. Full163-case browser regression is in progress with obsolete-control assertions being migrated; it is not a passing result. Owner-only was deliberately saved/read back in the existing dev shop after guards permitted it. Current LAN192.168.1.3; APK0.5D.1-test/build8 is available with verified download/signature/hash. No physical phone pass or hosting deployment.
