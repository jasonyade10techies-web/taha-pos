# TAHA POS — PHASE 5C.1
## Offline Cash Reconciliation, Synchronization Reliability & Test Stabilization

Continue development in:

`D:\Inventory system POS`

Phase 5C is complete. Preserve all its functionality and the approved Dashboard, POS, red/yellow/gold branding and mobile UI.

**This is a financial reliability phase, not a UI redesign.**

### STEP 1 — Verify the current project

Read:

- `docs/PHASE5C_IMPLEMENTATION.md`
- `docs/CHATGPT_PROJECT_HANDOFF_2026-10-14.md`
- `docs/NEXT_PHASE_ROADMAP_2026-10-14.md`

Inspect the current Windows SQLite outbox, offline authorization, transaction imports, server idempotency and reconciliation logic.

Do not rebuild systems that already work.

### STEP 2 — Stabilize browser tests

The last full browser run passed 114/116 tests, with the two remaining cases passing on serial recheck.

Investigate why the full run is unstable.

Check:

- Test isolation
- Shared persistent state
- Startup timing
- Race conditions
- Concurrent test workers
- Waiting for real application state
- Stale browser assets
- Incorrect test expectations

Do not simply increase every timeout.

Produce a reproducible clean full-suite run, including a suitable serial or CI configuration.

Report any remaining flaky scenarios accurately.

### STEP 3 — Audit offline cash transactions

Review the entire current flow:

Employee signs in online.

Employee receives valid offline authorization.

Internet disconnects.

Employee sells an item for cash.

Customer pays.

Cash is physically received.

Local receipt is generated.

Transaction enters SQLite outbox.

Internet returns.

Transaction synchronizes with PostgreSQL.

Identify every situation in which cash could be collected but the cloud sale might not be recorded.

### STEP 4 — Preserve real money received

The fundamental rule:

**Once money is physically received, the system must never silently delete or discard that transaction.**

Record and retain:

- Original employee
- Terminal
- Original invoice ID
- Customer, if available
- Items and quantities
- Price/tax snapshots
- Cash amount received
- Change given
- Actual collected amount
- Original transaction timestamp
- Current sync state
- Idempotency key
- Error/conflict reason

Pending cash must remain traceable across app restarts and employee changes.

### STEP 5 — Handle synchronization conflicts

Create explicit handling for:

**A. Successful sale, lost response**

Server commits the sale, but the network disconnects before the desktop receives confirmation.

Retry must identify the existing sale.

No second invoice, stock deduction or payment.

**B. Stock changed while offline**

Offline sale used cached stock, but stock is insufficient at synchronization.

Do not silently create negative stock.

Place transaction in an owner-review queue.

**C. Employee shift ended**

A different employee or the owner signs in while an offline transaction is pending.

Original seller attribution must remain unchanged.

Authorized owner recovery must be possible.

**D. Employee account deactivated**

Pending transaction must not disappear simply because the original employee can no longer log in.

Owner needs a secure recovery mechanism.

**E. Restart during sync**

If Windows closes, crashes or restarts while synchronizing, resume safely using the existing idempotency key.

### STEP 6 — Owner reconciliation page

Create a compact management view:

**Synchronization Exceptions**

Show:

Invoice | Employee | Amount Collected | Date | Problem | Status | Action

Click an exception to inspect:

Original receipt

Products

Customer

Amount collected

Cash drawer implications

Backend response

Available resolution actions

Possible authorized resolutions should include:

- Retry after resolving the underlying problem
- Resolve stock discrepancy through a proper inventory operation, then retry
- Record a linked replacement/amendment where supported
- Record an actual customer refund and close the exception

Do not silently force stock negative or generate another sale.

Owner decisions require a reason and audit trail.

### STEP 7 — Proper financial accounting

Distinguish:

**Cash physically collected**

from:

**Sale successfully posted to the server**

and:

**Cash refunded**

Dashboard and daily closing must not double-count sales or collections.

An unresolved offline exception must be visible in closing reports.

Refunding a rejected offline sale must not generate fictitious negative sales or stock movements.

### STEP 8 — Local synchronization status

Use clear statuses:

Pending Sync

Syncing

Synced

Needs Owner Review

Failed — Retry Available

Resolved / Refunded

Avoid technical errors in ordinary employee UI.

Do not label a conflict as merely Offline when the server was reachable and rejected the transaction.

### STEP 9 — Security and permissions

Only authorized Owner/Manager accounts may resolve financial exceptions.

The server must authenticate the resolver independently.

Do not impersonate the original seller or replay an expired employee token as a shortcut.

Preserve immutable seller attribution and record the person who resolved the exception.

### STEP 10 — Tests

Run isolated PostgreSQL and SQLite tests for:

1. Offline paid cash transaction.
2. Successful synchronization.
3. Lost response after server commit.
4. Duplicate retries.
5. Insufficient stock at sync.
6. Employee signs out.
7. Employee is deactivated.
8. Owner recovers pending sale.
9. App restarts during sync.
10. Refund of unresolved offline sale.
11. Correct cash closing and reporting.
12. No duplicate inventory movements.
13. No duplicate invoice numbers.
14. No unauthorized financial reconciliation.
15. Existing online sales remain unchanged.

Use actual SQLite outbox operations and backend integration tests where possible.

Browser tests alone do not prove native Windows reliability.

### STEP 11 — Acceptance and limits

This phase should make the financial reconciliation architecture correct and testable.

Do not claim physical offline Windows acceptance until the real Tauri EXE has been compiled and tested.

Do not start Hostinger deployment, hardware integration, or unrelated UI redesigns.

### STEP 12 — Final report

Create:

`docs/PHASE5C1_IMPLEMENTATION.md`

Report:

**Browser tests:** clean run status and remaining instability.

**Offline cash:** local persistence and invoice identity.

**Synchronization:** retries, lost responses and idempotency.

**Conflicts:** stock failures, employee changes and deactivation.

**Owner recovery:** UI, permissions, decisions and audit.

**Accounting:** collected cash, posted sales, refunds and closing reports.

**Tests:** exact counts and failures.

**Native status:** verified or unverified, with no unsupported claims.

**Known limitations:** actual unresolved blockers.

**Recommended next phase:** Windows native build/acceptance, followed by hosting preparation.

Implement and test the work. Do not merely provide a plan.