# TAHA POS — PHASE 5C
## Smart Services, Damaged Inventory, Customer Ledger, Returns Search & UI Refinement

**Project:** `D:\Inventory system POS`  
**Date:** October 14, 2026  
**Backend:** Custom NestJS + PostgreSQL  
**Desktop:** React + Tauri 2  
**Mobile:** Taha Staff Android

You are continuing development of the existing **TAHA MOBILES** POS and inventory system.

The project owner has supplied new functional requirements after reviewing the current application.

Your responsibility is to implement these improvements while preserving the existing architecture, working business logic, approved layouts, and design direction.

**Do not rebuild the application. Do not reconnect Supabase. Do not redesign the entire UI.**

Work in the stages specified below. Complete the tests for each stage before continuing.

---

# STAGE 0 — Read, inspect and protect existing work

## 0.1 Read the latest audit

Before changing anything, read:

- `docs/PROJECT_STATUS_AUDIT_2026-10-14.md`
- `docs/CHATGPT_PROJECT_HANDOFF_2026-10-14.md`
- `docs/NEXT_PHASE_ROADMAP_2026-10-14.md`
- `docs/PHASE5A_IMPLEMENTATION.md`

Inspect the current services, sales, inventory, returns, credit, receipt, authentication, theme, and search implementations.

Check the actual code before creating any new components, tables, or services.

## 0.2 Preserve existing functionality

Do not break:

- Approved Dashboard and New Sale layout
- Customer Display
- Custom Service button
- Product gallery and mobile camera bridge
- Existing checkout methods
- PostgreSQL transaction engine
- Stock movement accounting
- Receipt/PDF generation
- Existing discounts and approvals
- Employee permissions
- Local/demo mode
- SQLite/IndexedDB architecture
- Android scanner and camera functionality

## 0.3 Resolve the verified terminal identity defect

The October 14 audit identified a mismatch between a short UI terminal ID and the UUID required by the offline authorization endpoint.

Inspect the relevant terminal identity, device-bridge and synchronization code.

Implement one canonical persistent terminal UUID, safely migrate any existing short IDs, and preserve valid device pairings wherever possible.

Add a direct integration regression test.

Do not classify offline cash sales as production-ready until their financial reconciliation is separately verified.

## 0.4 Establish baseline tests

Run existing safe tests against isolated development fixtures.

Record passing/failing results before development.

Do not reset production data or overwrite financial records.

---

# STAGE 1 — Intelligent Custom Services

This is the highest-priority new feature.

## 1.1 Desired experience

Currently we have a Custom Service option beside Walk-in Customer in New Sale.

Preserve its location.

The employee should be able to type an ordinary service description, enter a price, and add it immediately.

Example:

**Service:** `Y20 panel replacement`  
**Charge:** `PKR 1,750`

The system should intelligently recognize whether the description references a product already in inventory.

It should not require employees to open several dropdowns or navigate away from New Sale.

## 1.2 Saved service suggestions

When the employee starts typing, search the existing saved service catalogue.

Examples:

Typing:

`Y20 pan`

May suggest:

- Y20 Panel Replacement
- Vivo Y20 Screen Repair
- Y20 Display Installation

Keep suggestions compact, relevant and fast.

Show at most a few high-confidence suggestions near the input.

Do not open an enormous dropdown over the POS.

Selecting a saved service should populate its name and default charge, which remains editable.

## 1.3 Save Custom Service for later

Inside the Custom Service dialog provide:

**Save as reusable service**

Use the application's custom checkbox component.

Example:

Service name: `Y20 Panel Replacement`

Default charge: `PKR 1,750`

Save for later: checked

After completing the action, the service becomes available in subsequent searches.

Do not save the same template repeatedly as duplicate records.

Allow authorized employees to create templates according to permissions.

Owner/Manager may edit, archive and manage saved services.

## 1.4 Smart product recognition

Suppose inventory contains:

Product: `Vivo Y20 Panel`  
Available quantity: `36`

Employee types:

`Y20 panel replacement`

The system should recognize the likely inventory component.

Show the match visually inside or immediately adjacent to the service text:

**Y20 Panel** — linked product  
Available: 36

The employee should understand that one physical panel will be consumed.

## 1.5 Mention-style inline tokens

Implement a compact token-aware input experience similar in principle to mentions in modern chat applications.

Example visual behavior:

`[Y20 Panel ✓] replacement`

The recognized product reference appears as a subtly highlighted token.

Use soft gold or another restrained accent.

Token interaction:

- Click to inspect the linked product
- View available quantity
- Remove the link
- Replace the linked product
- Change quantity when authorized

The employee should still be able to type natural English around the token.

Avoid a complicated rich-text editor if a lightweight token-aware input is sufficient.

Keep typing, cursor movement, deletion, and keyboard navigation reliable.

## 1.6 Typo tolerance

Support queries such as:

`y20 pnl`

`vivo y20 panl`

`y20 display change`

`Y20 panel replacement`

Use deterministic search:

- Lowercase/normalization
- Token matching
- Existing product aliases
- Roman Urdu aliases
- Fuzzy matching
- Model-aware ranking
- Saved service templates

Do not call an external AI model on every keystroke.

AI-based alias suggestions may be added later.

**Important:** Typo correction must never silently replace an ambiguous product with an unrelated SKU.

If there are multiple similar products or variants, present a compact disambiguation action.

## 1.7 Automatic matching versus confirmation

Employee should not need an additional manual product dropdown for a uniquely matched product.

However, stock-sensitive matching must be reliable.

Rules:

**Exact unique match:** Link the product automatically and show the visible inline token with a clear way to undo it.

**Strong unique fuzzy match:** Show a suggested link; allow Enter/Tab or one tap to accept.

**Ambiguous match:** Ask employee to choose the correct product.

**No match:** Treat text as a service-only line without inventing a product.

Never create stock deductions based solely on uncertain AI predictions.

## 1.8 Service with and without inventory

Support two situations.

### A. Service only

Example:

`Software Installation`

Charge:

`PKR 800`

No linked inventory.

Result:

- Service sale recorded
- Revenue recorded
- No stock deducted

### B. Service using a product

Example:

`Vivo Y20 Panel Replacement`

Charge:

`PKR 1,750`

Linked inventory:

`Vivo Y20 Panel × 1`

Result after completed sale:

- Service recorded
- Linked product consumed
- Available stock reduced by one
- Relevant movement/history recorded
- Invoice links service and consumed material
- Internal profit calculation uses protected cost information when available

Do not deduct stock merely because the text was typed or added to the cart.

Stock changes only when an authorized transaction is completed.

## 1.9 Stock location selection

If the linked part exists in exactly one eligible location, select it automatically.

If available in multiple locations, show a compact allocation selector.

Example:

Rack 12 → Shelf B → Box 04: 20

Rack 07 → Shelf A → Box 02: 16

Do not consume inventory from an arbitrary location without a valid allocation.

## 1.10 Server-authoritative completion

At checkout, the backend must validate:

- Correct product
- Correct variant
- Quantity
- Available stock
- Location
- Employee permissions
- Linked service
- Service price
- Idempotency key

Perform sale creation, payment recording, service record, inventory consumption and audit logging atomically.

Use the existing transactional PostgreSQL architecture.

Do not implement product consumption through several independent browser API calls.

## 1.11 Pricing and security

Keep Custom Service simple:

- Service name
- PKR charge
- Save for later
- Optional linked inventory shown automatically

**Do not add a minimum-price field to the Custom Service form.**

Where a part is consumed, preserve server-side cost accounting and enforce relevant permissions or business rules so the feature cannot become an unauthorized stock-removal shortcut.

Purchase costs remain invisible to unauthorized staff.

Unknown acquisition costs must remain unknown in profit reporting, not be treated as zero.

## 1.12 Service receipt

Show a clear customer-facing description:

Vivo Y20 Panel Replacement — PKR 1,750

Internally link the consumed product.

Do not unnecessarily expose the protected cost breakdown on a customer receipt.

## 1.13 Acceptance test

Create test fixtures:

- Vivo Y20 Panel
- 36 available
- One eligible rack location
- Saved service template

Test:

1. Type `Y20 panel replacement`.
2. Correct product is recognized.
3. Add service at PKR 1,750.
4. Save service for later.
5. Complete sale.
6. Available stock becomes 35.
7. Service is visible in transaction detail.
8. Stock movement references the sale.
9. Customer invoice shows the service.
10. Typing the service again suggests the saved template.

Also test service-only checkout without stock deduction, ambiguous product names, insufficient stock, duplicate requests and rollback.

---

# STAGE 2 — Damaged Inventory & Returns

## 2.1 Separate stock conditions

The Products and Stock pages need to distinguish inventory conditions.

At minimum:

**Available Stock**

**Damaged Stock**

**Out for Test**

Where existing reservations are supported, preserve those distinctions as well.

Example:

Vivo Y20 Panel

Available: 35

Damaged: 2

Out for Test: 1

These quantities must come from real stock records.

## 2.2 Product page display

On the Products table, show low-stock warnings prominently.

The owner requested **red low-stock indicators**.

Use:

- Available: normal dark/green
- Low Stock: red warning badge
- Out of Stock: red
- Damaged: red badge/count
- Out for Test: blue/information

Use red deliberately; do not recolor the entire table.

## 2.3 Product detail

On Product Detail show:

Stock Overview

Available | Damaged | Out for Test | Total Physical Units

Damaged quantity must be clickable.

Click opens:

**Damaged Inventory**

Show:

- Quantity
- Product
- Current damaged location
- Original sale/return reference
- Reason
- Date/time
- Employee
- Photos if available
- Current disposition

## 2.4 Damaged inventory locations

Support damaged items stored in designated locations.

Example:

Rack D01 → Shelf A → Box 01

Label:

Damaged / Quarantine

An owner should be able to move damaged stock to another damaged-storage location.

Moving a damaged item between locations must not make it sellable.

## 2.5 Return classifications

When processing a return, allow:

**Sellable Return**

**Damaged Return**

**No Stock Restoration**

Behavior:

Sellable return:
Available stock increases.

Damaged return:
Damaged stock increases.
Available stock does NOT increase.

No restoration:
No physical stock increase.

Do not implement these as a loose direct edit of product.quantity.

Use auditable inventory movements and condition balances.

## 2.6 Damaged stock actions

Authorized users can:

- View
- Transfer damaged location
- Attach condition notes/photos
- Mark repaired/recovered
- Return to sellable inventory after inspection
- Write off with reason

When damaged stock becomes sellable:

decrease damaged balance

increase available balance

record one atomic reclassification.

## 2.7 Damaged sales/returns history

Show a dedicated tab/filter:

Damaged Returns

Columns:

Date
Product
Quantity
Customer
Invoice
Reason
Location
Employee
Status

Click entry to inspect the originating transaction.

## 2.8 Important accounting rules

Prevent:

- Damaged stock appearing available in POS
- Damaged stock being sold unintentionally
- Double restoration on repeated returns
- Returning more quantity than sold
- Reversing a return twice
- Damaged stock disappearing during transfers

Use idempotency, transaction locks, constraints and audit logs.

When a service consumes a physical part, preserve the linkage necessary for an authorized future return.

## 2.9 Acceptance tests

Test:

- Sellable return of one panel
- Damaged return of one panel
- Movement between damaged locations
- Recovery from damaged to sellable
- Write-off
- Repeat request/idempotency
- Concurrent adjustment
- Correct available-stock and total-physical-stock figures

---

# STAGE 3 — Customer Ledger as a Timeline

## 3.1 Improve the existing Credit/Customer pages

Do not redesign the overall navigation.

Keep the existing customer and credit account screens.

Add a professional chronological activity view.

The idea is similar to a clean messaging timeline, but it must remain business/accounting software.

## 3.2 Customer timeline

When opening a customer account, show:

**Activity / Ledger**

Entries such as:

**Sale Completed**

14 Oct 2026 — 11:43:21 AM

Vivo Y20 Panel Replacement

Invoice: TM-INV-000123

Amount: PKR 1,750

**Credit Given**

14 Oct 2026 — 11:44:03 AM

Outstanding: PKR 1,750

**Payment Received**

15 Oct 2026 — 02:18:07 PM

Cash payment: PKR 1,000

Remaining: PKR 750

**Product Returned**

16 Oct 2026 — 10:35:49 AM

Damaged: 1 Vivo Y20 Panel

Use accurate amounts and actual database timestamps.

Do not use invented values in live account views.

## 3.3 Timeline event types

Include:

- Sale
- Credit sale
- Payment received
- Payment reversal
- Return
- Refund
- Out for Test
- Test item returned
- Test converted to sale
- Credit adjustment
- Customer/account note
- Reminder prepared/sent manually, where verifiable

Every event must link to its actual underlying record.

Financial ledger entries must remain auditable and immutable except through authorized corrections/reversals.

## 3.4 Customer notes

Allow authorized staff to add internal notes.

Example:

Customer says he will pay remaining PKR 750 on Friday.

Show:

Employee
Exact timestamp
Note

Do not confuse internal notes with actual customer messages or proof that WhatsApp was sent.

## 3.5 Timeline filters

Add compact filters:

All
Sales
Payments
Returns
Credit
Test Items
Notes

Date range filter.

Newest first by default.

Optional older-first sorting.

Pagination/load more.

## 3.6 Customer detail summary

At top show:

Customer Name

Mobile

WhatsApp

Account Type

Outstanding Balance

Credit Limit if configured

Next Due Date

Overdue Status

Quick actions:

New Sale

Receive Payment

View Receipts

View Returns

WhatsApp Reminder

Edit Account

## 3.7 Returns inside customer detail

Add dedicated:

**Returns**

tab/section.

Show all returns associated with this customer.

Each row must link to:

Original invoice
Returned items
Reason
Condition
Refund
Employee
Timestamp

---

# STAGE 4 — Searchable Receipts & Return Lookup

## 4.1 Remove exact-code-only dependency

Currently return lookup is too restrictive.

Allow searching by:

- Full invoice number
- Partial invoice number
- Last digits
- Customer name
- Customer phone
- Product name
- Receipt date
- Cashier/employee

## 4.2 Partial invoice search

Examples:

`TM-INV-000123`

`000123`

`123`

`23`

Partial searches must display matching candidate receipts.

Do not automatically open the first result when the query is ambiguous.

If many receipts match, show a filtered list with useful metadata.

Example:

TM-INV-000123

Ali Raza

14 Oct 2026

PKR 1,750

Cashier: Hamza

## 4.3 Quick return lookup

On Returns page:

Search Receipt

Search input:

`Search invoice, customer, phone or product...`

Results should appear immediately.

Selecting a receipt opens its returnable items.

Show quantity already returned and remaining returnable quantity.

## 4.4 Central Receipts page

Provide a dedicated receipts list if one does not already exist.

Show:

Invoice
Date
Customer
Employee
Amount
Payment Status
Return Status

Filters:

Date
Employee
Customer
Status
Payment Method

## 4.5 Receipts by employee

From Employee Detail:

Receipts / Transactions

Show receipts created by that employee.

Preserve the ability to see all receipts from the central Transactions/Receipts page.

Employees may only see information allowed by their permissions.

## 4.6 Receipt actions

View Receipt

Print

Download PDF

Send Virtual Receipt

Start Return

Open Original Transaction

Keep receipt preview permanently white in light and dark themes.

Do not regenerate sale records when reprinting or downloading.

## 4.7 Receipt QR

Preserve the existing signed, customer-safe receipt reference.

Scanning with Taha Staff should locate the transaction if authorized.

External customers should only access permitted receipt information.

Do not place protected financial information in the QR payload.

---

# STAGE 5 — Credit Due Dates & WhatsApp Reminders

## 5.1 Due date configuration

On credit sales and credit accounts support:

Due Date

Due Time

Optional reminder policy

Credit limits remain independent of due dates.

Allow the owner to enable/disable due-date enforcement and reminders.

## 5.2 Calendar/time picker

Use polished Taha UI controls.

Calendar for date.

Time selector for time.

Store backend timestamps with timezone-safe handling.

Display in:

**Asia/Karachi**

Show seconds where an exact timestamp is available.

Example:

14 Oct 2026 — 05:30:00 PM

Do not invent exact seconds for events where the time was never recorded.

## 5.3 Remaining time

Show:

Due in 5 days

Due tomorrow

Due today

Overdue by 2 days

For short intervals, optionally display hours/minutes.

Use server time/current clock rather than saving a stale "days left" count.

## 5.4 Credit account reminders

On Credit Accounts show:

Outstanding

Next Due

Days Remaining

Status

Actions

Statuses:

Current

Due Soon

Due Today

Overdue

Paid

The owner may configure how many days before due a warning appears.

## 5.5 Separate Test-Out and Credit reminders

These are different obligations.

**Credit reminder:** asks customer to pay outstanding money.

**Out-for-Test reminder:** asks customer to return an item or contact the shop to arrange purchase.

Do not send a payment reminder for an item that is merely Out for Test with no debt.

## 5.6 Customer communication fields

Support:

Primary Phone

WhatsApp Number

Same as Phone checkbox

Optional separate WhatsApp number.

Normalize Pakistani numbers for international WhatsApp links.

Example:

`03001234567` → `923001234567`

Do not display private contact details to unauthorized users.

## 5.7 WhatsApp button

Provide:

**Send WhatsApp Reminder**

This opens a preview modal with:

Customer
Phone
Outstanding/Due
Message
Copy Message
Open WhatsApp

The owner/employee reviews it before opening WhatsApp.

No automatic sending or bots in this phase.

## 5.8 Credit payment reminder template

Example:

**TAHA MOBILES — Payment Reminder**

Hello Ahmed,

Our records show the following outstanding payment:

Invoice: TM-INV-000123

Item/Service: Vivo Y20 Panel Replacement

Purchased: 14 Oct 2026, 11:43:21 AM

Payment Due: 17 Oct 2026, 06:00:00 PM

Outstanding Amount: PKR 1,750

Please arrange payment by the due date or contact Taha Mobiles if you have already paid.

Thank you,  
Taha Mobiles

Use real data.

Do not include wrong totals or stale outstanding balances.

## 5.9 Overdue message

When overdue, adapt the wording.

Example:

Your payment is overdue by 2 days.

Avoid aggressive, threatening or misleading language.

## 5.10 Out-for-Test reminder

Example:

**TAHA MOBILES — Item Return Reminder**

Hello Ali,

Item: Vivo Y20 Panel

Quantity: 1

Taken On: 14 Oct 2026, 11:43:21 AM

Return Due: 15 Oct 2026, 06:00:00 PM

Please return the item or contact Taha Mobiles to arrange its purchase.

Thank you,  
Taha Mobiles

Do not invent an outstanding payment for an unpaid test item.

## 5.11 WhatsApp integration

Use a correctly encoded WhatsApp click-to-chat URL.

The message should be prefilled.

The user manually presses Send in WhatsApp.

Also support:

Copy Message

Edit Before Sending

Do not falsely mark a message as delivered merely because WhatsApp was opened.

## 5.12 Reminder history

Track:

Reminder prepared
WhatsApp opened
Manually marked contacted
Actual sent status only if verifiable

Audit employee/time where appropriate.

## 5.13 In-app reminders

Create owner/authorized-staff alerts for:

Credit due soon
Credit overdue
Out-for-Test due soon
Out-for-Test overdue

Link each alert to the relevant customer/account/item.

Avoid duplicate spam notifications.

---

# STAGE 6 — UI Consistency, Fonts & Dark Mode

Do not redesign the existing approved pages.

Polish them.

## 6.1 Typography

Audit the current Manrope/Inter/font configuration.

Use one consistent primary interface font.

Prefer **Inter** or **Manrope**, whichever provides better readability across:

POS
Tables
Forms
Ledger
Inventory
Settings
Mobile

Do not mix unrelated fonts across pages.

Keep the custom Taha Mobiles logo typography unchanged.

Bundle font assets appropriately; do not depend on external Google Fonts loading at runtime in the Windows EXE.

## 6.2 Dark theme

Create a refined professional neutral dark mode with layered surfaces, similar in usability to modern productivity applications.

Do not copy ChatGPT branding or UI components.

Suggested initial token direction:

| Token | Suggested color |
|---|---|
| Background | `#111316` |
| Sidebar | `#0D0F12` |
| Surface | `#1B1E23` |
| Raised Surface | `#242830` |
| Border | `#39404A` |
| Primary Text | `#F5F6F8` |
| Secondary Text | `#B8C0CB` |
| Muted Text | `#A4ADBA` |
| Gold Action | `#FACC15` |
| Red Accent | `#F87171` |
| Success | `#4ADE80` |
| Warning | `#FBBF24` |

These are starting values, not mandatory final values.

Validate contrast and refine the exact combinations rather than applying them blindly.

## 6.3 Accessibility

Target WCAG AA where applicable.

Normal text:
At least 4.5:1 contrast.

Large text:
At least 3:1.

Meaningful interactive boundaries and focus states should be distinguishable.

Ensure warning/error states are not communicated through color alone.

## 6.4 Dark mode component coverage

Audit:

- Sidebar
- Dropdowns
- Comboboxes
- Popovers
- Dialogs
- Tables
- Ledger timeline
- Calendar
- Return form
- Service mention tokens
- Damaged-stock badges
- Tooltips
- Notifications
- Mobile screens

Open AND close animations should remain smooth.

## 6.5 Light mode

Preserve the current light theme as the default.

Do not make it darker or more colorful unnecessarily.

## 6.6 Receipt exception

Invoices and thermal receipt paper previews must **always remain white**, even when the application is in dark mode.

## 6.7 Low-stock UI

On Products and Stock pages:

Use a prominent red warning for Low Stock.

Clicking the warning should open useful information:

Available Quantity

Reorder Threshold

Locations

Receive Stock action

Do not create a dead decorative badge.

## 6.8 Responsive validation

Check:

1920×1080

1440×900

1366×768

1024×768

390×844

412×915

Ensure new dialogs, timelines, service inputs and receipt searches work on smaller screens.

---

# STAGE 7 — Backend, Offline & Security Rules

## 7.1 Custom backend only

Continue using the existing custom:

NestJS
PostgreSQL
REST API

Do not add Supabase production dependencies.

## 7.2 Local/demo parity

All new business features should use existing repository abstractions.

Implement local/demo behavior where practical and clearly distinguish it from API-authoritative operation.

## 7.3 Offline restrictions

Do not silently allow risky stock mutations offline.

If linked-service inventory consumption cannot yet be reconciled safely with the current offline cash architecture, block that action offline with a clear explanation.

Preserve existing offline-safe functionality.

## 7.4 Offline financial blockers

The project audit identifies unresolved paid-offline cash reconciliation.

Do not claim this is solved by general retry or idempotency alone.

If it remains unresolved, retain it as a P0 production blocker and document the precise required financial reconciliation workflow.

## 7.5 Security

Enforce permissions on:

Service creation/editing
Service-linked part consumption
Damaged stock reclassification
Stock write-off
Credit ledger access
Receipt lookup
Returns
Contact information
Reminder preparation

Do not merely hide controls in React.

## 7.6 Audit trail

Record:

Employee
Store
Action
Reference
Product/Service
Quantity
Stock condition
Old/new states
Exact timestamp
Reason

Never expose passwords, PINs or authentication tokens.

---

# STAGE 8 — Automated End-to-End Verification

Run existing test suites and add coverage for new workflows.

At minimum verify the following scenarios.

## Scenario A — Saved intelligent service

Initial:

Vivo Y20 Panel: 36 available.

Employee types:

`Y20 panel replacement`

System recognizes correct panel.

Employee enters:

PKR 1,750.

Employee checks:

Save as reusable service.

Completes sale.

Expected:

- One sale
- One service line
- One linked material consumption
- Available quantity becomes 35
- Cost protected
- Receipt correct
- Ledger/audit correct
- Saved service available next time

## Scenario B — Ambiguous product

Two similar Y20 panels exist.

Fuzzy engine must not silently choose the wrong SKU.

Show compact confirmation/disambiguation.

## Scenario C — Service only

Software Installation:

PKR 800.

No linked product.

Sale completes without stock movement.

## Scenario D — Damaged return

Initial available: 35.

Customer returns one damaged panel.

Expected:

Available remains 35.

Damaged becomes 1.

Correct customer timeline entry.

Correct physical inventory/return reference.

## Scenario E — Sellable return

One sellable panel returned.

Available increases by one.

Damaged remains unchanged.

## Scenario F — Credit ledger timeline

Customer buys an item on credit.

Later pays partially.

Then returns an item.

The timeline displays correct chronological events, references, balances, and timestamps.

Old debt collection must not count as another sale.

## Scenario G — Partial receipt search

Search:

`23`

System returns matching receipts.

User selects correct invoice using customer/date/total.

Return flow opens.

No wrong invoice is silently selected.

## Scenario H — WhatsApp reminder

Customer has:

Outstanding PKR 1,750.

Due date and time configured.

Click:

Send WhatsApp Reminder.

Verify:

- Correct number normalization
- Correct name
- Correct amount
- Correct invoice
- Correct date/time
- Correct message preview
- Correct URL encoding
- No automatic claim of delivery

## Scenario I — Permissions

Employee lacking stock-adjustment permission must not create damaged reclassification or write-off through direct API calls.

## Scenario J — UI

Verify:

- Custom service inline matching
- Saved service suggestions
- Dark mode
- Custom checkboxes
- Timeline
- Calendar
- Low-stock badge
- Receipt search
- Mobile responsiveness

---

# STAGE 9 — Build, Test & Final Report

Run:

- Frontend production build
- Backend build
- Frontend lint
- Backend lint
- Existing unit tests
- PostgreSQL integration tests
- Transaction/concurrency tests
- Browser workflow tests
- Responsive/visual smoke tests

Use isolated development fixtures for destructive financial tests.

Do not deploy to Hostinger in this phase.

Do not install unrelated packages or rebuild Windows/Android artifacts unless needed to verify the features and supported by the available toolchain.

## Required implementation report

Create:

`docs/PHASE5C_IMPLEMENTATION.md`

Include:

### 1. Smart Custom Services
- Saved templates
- Instant suggestions
- Inline tokens
- Fuzzy matching
- Linked products
- Stock deduction
- Pricing
- Backend behavior

### 2. Damaged Inventory
- Available/damaged quantities
- Damaged locations
- Sellable returns
- Damaged returns
- Reclassification
- Write-offs
- History

### 3. Customer Ledger
- Timeline
- Payments
- Returns
- Internal notes
- Accurate balances
- Exact timestamps

### 4. Receipt Search
- Invoice lookup
- Partial search
- Customer search
- Employee receipts
- Returns integration

### 5. Credit Reminders
- Due dates
- Calendar
- Days remaining
- WhatsApp templates
- Manual message workflow
- In-app alerts

### 6. UI Improvements
- Font
- Dark theme
- Low-stock red badges
- Dropdowns
- Animations
- Responsive behavior

### 7. Tests
Report exact test counts and results.

### 8. Known Issues
Clearly identify incomplete or unverified features.

### 9. Existing P0 Blockers
State the current status of:

- Native terminal UUID/offline grant
- Offline cash reconciliation
- Windows EXE build
- Hostinger deployment
- Durable mobile photo recovery

### 10. Next Recommendation
Recommend the next bounded phase based on actual evidence.

**Important:** Do not mark Windows/native, offline financial, or hosted deployment features as complete simply because their source files exist.

---

# Final instruction

Actually implement the requested functionality.

Preserve the existing codebase and user interface.

Prioritize correctness over visual decoration.

The service recognition should feel intelligent and nearly automatic, but inventory mutations must remain deterministic, authorized and auditable.

**Complete the stages in order. Test each stage before proceeding. If execution is interrupted, preserve the working state and provide a precise continuation report. Do not claim unfinished stages are complete.**