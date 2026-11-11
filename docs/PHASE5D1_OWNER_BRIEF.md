
# TAHA POS — PHASE 5D.1
## Screenshot-Based Workflow Corrections, Customer Workspace Redesign, Owner-Only Mode and Mobile Sales

**Project:** `D:\Inventory system POS`  
**Business:** Taha Mobiles  
**Date:** 21 October 2026  
**Backend:** Existing custom NestJS/PostgreSQL API  
**Deliverables:** Updated working localhost application, updated Android test APK, verification evidence, and an honest remaining-work report.

Continue the existing project. Do not rebuild it.

This is a concrete implementation brief based on the owner’s screenshots and physical use of the application. It supersedes earlier instructions where explicitly stated.

## 1. Scope, priorities and existing decisions

Preserve the approved Dashboard structure, desktop POS split layout, product media editor, coded logo, bundled Manrope font, light-first interface, charcoal sidebar, and red/yellow/gold branding.

Preserve the custom backend, permission boundaries, financial transaction engine, damaged-stock accounting, service/material linkage, receipt generation, device bridge, and offline reconciliation.

Do not reconnect Supabase, assume a Hostinger VPS, deploy hosting, install Windows build tools, or begin an unrelated Windows packaging phase.

### New decisions

- The current shop needs **Owner-only mode**, with employee and shift workflows hidden.
- Staff mode must remain available as a reversible setting.
- The Android app now needs **simple mobile sales**. The previous blanket prohibition on mobile sales is superseded.
- Customer account pages and Product Detail need targeted redesigns.
- Add/Edit Product and its Shopify-inspired media layout are approved; refine them rather than replacing them.
- Website functionality is disabled for now.
- “Customer dashboard” means an internal customer account workspace—not customer login accounts or a public portal.

### Implementation order

1. Inspect actual source, reproduce screenshot problems, and establish baseline tests.
2. Introduce the reversible operating-mode/settings foundation.
3. Redesign the customer workspace first.
4. Repair dashboard navigation, transactions, returns, and POS header behavior.
5. Improve product details, stock clarity, selectors, receiving, and transfers.
6. Implement dedicated mobile sales and receipt sharing.
7. Verify integrations, build the updated APK, and launch the current localhost application.

Maintain a progress checklist. Continue through the stages without stopping for routine design questions. If a real blocker remains, finish independent work and report the precise blocker.

## 2. Inspect and reproduce before changing code

Read the latest available implementation reports, including Phase 5C, 5C.1 and 5D, plus the October 14 audit. Prefer current source and reproducible behavior over earlier completion claims.

Inspect the actual frontend, API repositories, backend operations, settings, Android Java/native bridge, SQLite interfaces and tests.

The Android implementation previously used Java/AndroidX WebViewAssetLoader with bundled React assets. Verify its current implementation; do not assume Capacitor or introduce another mobile framework.

Create:

`docs/PHASE5D1_REQUIREMENTS_AND_PROGRESS.md`

Map every requirement below to its affected component, implementation status, and verification.

### Screenshot problems to reproduce

- Dashboard summaries and rows do not offer sufficiently broad click targets.
- Recent Activity exposes technical action labels such as `sale · returned`.
- Credit reminders omit useful due/taken information.
- Selecting a POS customer changes the header’s height and duplicates customer information.
- Transactions show confusing payment summaries such as `Cash + Cash`.
- Receipt selection requires clicking a small invoice link.
- Transactions and customer history still expose browser-style calendars.
- Supplier selection looks custom, while the grade field opens a different-looking suggestion popup.
- Product Detail has excessive whitespace and a visibly broken image.
- Stock numbers are far from their meaning/status.
- Receiving selectors include a service among physical products; investigate and prevent inappropriate stock receiving.
- Quick creation requires leaving the current workflow.
- Customer detail repeats Activity/Ledger, Ledger, Invoices, Returns and other navigation without a clear hierarchy.

Do not assume zero sales, zero stock, or “Unassigned” are incorrect merely because they look empty. Inspect the underlying records.

Do not recreate the Windows taskbar, browser chrome, red screenshot markings, or floating screen-recording/voice controls as application components.

Preserve all existing data. Test product names and duplicated-looking records are not permission to delete them.

## 3. Owner-only mode and setup assistant

Create a centralized, persisted shop operating mode:

**Owner only**  
**Owner with staff**

For this shop, make Owner-only mode available as the recommended selection.

### Owner-only behavior

Remove employee-specific controls from normal daily screens:

- Employees and Shifts navigation.
- Employee filters in transactions and reports.
- Employee selection and PIN switching prompts.
- Staff scheduling and attendance prompts.
- Unnecessary cashier fields in forms.

Use the authenticated owner as the actor automatically. Keep the owner profile, authentication, permissions, terminal identity, device sessions and audit trail.

Receipt cashier-name display may be configurable. Hiding the printed name must not remove the actor from the underlying transaction.

Rename “Staff Phone” to “My Phone” or “Connected Phones” where appropriate in Owner-only mode. Do not change the working device-bridge authorization architecture.

### Reversibility and safety

Disabling Staff mode must not:

- Delete employees, old shifts or transactions.
- Rewrite historic cashier attribution.
- Transfer another person’s credentials to the owner.
- Turn off authorization.
- Discard pending outbox or reconciliation records.

Check for active shifts and unresolved operations before switching. Explain anything requiring resolution instead of silently closing or deleting it.

Enabling Staff mode later restores the relevant workflows and preserved data.

### Setup assistant

Add a resumable setup assistant for new installations and a **Review Shop Setup** action for existing installations.

Ask only practical questions:

- Shop name, contact details and receipt information.
- Owner-only or staff operation.
- Enabled features: credit, test items, repairs, used-device buying, suppliers, mobile sales.
- Storage terminology and initial rack/shelf/box names.
- Damaged-item handling and quarantine destination.
- Payment methods and proof preference.
- Receipt printing mode and existing tax settings.

Keep website functionality off by default.

Do not force existing users through setup on every launch. Prepopulate known settings. Saving setup must not reset the shop, seed artificial stock, or overwrite historical data.

Module visibility is a usability setting, not a substitute for backend permissions. Keep customer accounts, receipts and financial history accessible when needed to settle existing obligations.

## 4. Customer workspace — highest-priority redesign

Replace the confusing customer-detail tab arrangement with one coherent account workspace.

### Desktop structure

Use approximately **30% left / 70% right**, adjusting naturally to screen width.

**Top:** Customer name, type, compact avatar, and primary actions.

**Left column:**

1. Customer/contact card.
2. Balance and next-due summary.
3. Upcoming obligations.
4. Ready-to-review reminder message.

**Right column:**

A wide, compact account-history panel with search, filters, and a Timeline/Ledger switch.

On smaller screens, stack these sections logically. Do not create several competing scroll containers or hide content behind sticky elements.

### Customer/contact card

Show name, individual/business type, mobile, WhatsApp and address when available.

Use compact actions:

**Receive Payment · New Sale · WhatsApp · Edit**

Move less frequent actions into a consistent overflow menu.

“New Sale” preselects this customer without losing an existing unrelated draft. If another cart already exists, offer a clear choice rather than silently replacing its customer.

### Financial summary

Use a restrained colored emphasis for:

- **Outstanding:** current unpaid amount.
- **Credit charged:** explain the period/scope.
- **Paid and adjusted:** with a breakdown separating payments, returns, and reversals.
- **Next due:** nearest relevant outstanding obligation.

Do not display both “Outstanding” and “Remaining” as separate identical values.

Do not label returned goods or debt adjustments as cash received. Summary values must reconcile to the underlying ledger.

### Due-date behavior

For a configured due date:

`Due 24 Oct 2026, 6:00 PM · 3 days left`

For overdue debt:

`Overdue by 4 days · Due 17 Oct 2026, 3:00 AM`

For debt without a deadline:

`No time limit`  
`Taken on 17 Oct 2026, 2:59 AM`

Use actual timestamps. Where only a date exists, do not manufacture a time.

For multiple outstanding invoices, show the nearest due obligation and a count/link for the others. Show undated obligations separately. A settled account should not display a stale overdue warning.

### Account history

Default view: **Timeline**.

Alternative: **Ledger**.

Use one filter row:

**All · Purchases · Payments · Returns · Test Items · Notes**

“Purchases” provides invoice access; do not add a second competing set of Activity/Ledger/Invoices tabs.

Each timeline entry should clearly show:

- Human-readable event.
- Product/service or concise description.
- Amount and direction where relevant.
- Exact available date/time.
- Invoice/payment/return reference.
- Status and remaining obligation where useful.

Example:

**Panel replacement purchased**  
Vivo Y20 Panel Replacement · TM-INV-…  
PKR 1,750 charged · Payment due 24 Oct  
21 Oct 2026, 11:43:21 AM

Do not invent missing product, customer or actor information.

### Clickable history

Clicking anywhere on a history entry opens the correct detail sheet or page.

The detail includes relevant items, quantities, amounts, payment history, return condition, original invoice and attachments permitted for the current user.

Closing it restores history position and filters.

A return and its refund may be shown together as related activity, but their separate accounting records must remain intact. Do not double-count events when presenting summaries.

### Ledger view

Keep proper debit/credit/balance behavior. Use understandable column labels or help text explaining them.

Compute balances across the complete relevant ledger before pagination; do not reset the balance on each page.

Keep invoice links inside the ledger. Combining the interface must not collapse sales, collections, returns and refunds into one ambiguous record type.

### Reminder panel

Show the relevant outstanding amount, due date/taken date and an editable prepared message.

Actions:

**Copy Message · Open WhatsApp**

Use the existing manual reminder system, current amounts and correct customer number. Keep payment reminders separate from test-item return reminders.

Validate the destination number. For an invalid or missing number, offer Edit Number or Copy Message; do not generate an apparently valid link using malformed digits.

Record “prepared,” “opened,” or explicitly confirmed contact—not delivered merely because WhatsApp opened.

## 5. Make dashboard information actionable

Keep the six-card dashboard arrangement.

Implement these destinations using the existing routes and report architecture:

| Dashboard element | Destination |
|---|---|
| Sales | Relevant sales breakdown for the selected period |
| Cash Collected | Confirmed cash collections, including separately identified old-debt payments |
| Digital Payments | Confirmed electronic-payment breakdown |
| Credit Given | Credit issued during the selected period |
| Gross Profit | Authorized profit breakdown |
| Low Stock | Inventory filtered using the same threshold/count definition |
| Recent Activity entry | Its specific sale, return, location, payment or other source record |
| Low-stock product row | Product stock detail |
| Credit reminder row | Customer account and relevant obligation |

Preserve selected shop, date range and filters when navigating. Returning to the dashboard should restore its state.

The destination must explain the number clicked. Do not link net sales to an unrelated gross-invoice list or count old debt collections as new sales.

### Link behavior

Hover gives a pointer/subtle highlight; **navigation happens on click, keyboard activation, or tap—not merely on hover**.

Use actual links for navigation where possible and real buttons for actions. Native link semantics provide navigation behavior that an arbitrary element with a link role does not automatically acquire.

### Recent Activity wording

Replace technical labels with a centralized formatter.

Examples, only when supported by source data:

- “Returned 1 Samsung A15 Charging Board.”
- “Created Rack 15.”
- “Marked Box 04 as damaged storage.”
- “Received PKR 1,000 from Ali Mobiles.”

Retain technical action codes in audit diagnostics, not everyday dashboard copy.

### Credit reminder details

Include customer name, outstanding amount, due state and taken date. If there is no deadline, explicitly show **No time limit**.

### Chart behavior

Preserve the date controls and fix tooltip/animation behavior.

Use actual buckets and timezone-aware dates. Zero activity is valid: show a clear “No sales in this period” state with working range controls rather than fabricated chart data.

Keep animation restrained and respect reduced motion.

## 6. POS customer header — no layout jumping

Preserve the desktop New Sale layout.

Give the customer selection and Custom Service area a stable, compact layout for:

- Walk-in Customer.
- Named individual.
- Business account.
- Customer with outstanding balance.
- Long customer/business name.

Show customer details once. Reserve a consistent secondary line for type/contact/authorized outstanding information, or use an expandable details popover.

Keep Custom Service aligned with the selector. Long names must wrap or truncate predictably without moving the cart and checkout controls around.

Test before/after bounds when switching customers. Do not solve the problem by making the whole header unnecessarily tall.

Keep anonymous walk-in sales. Owner-only mode must not require choosing an employee.

Preserve smart services, saved suggestions, explicit material matching, and stock deduction only at completed checkout.

A generic description such as “Mobile replacement” must not cause the system to invent which physical parts were consumed. Keep ambiguous matching explicit; broader natural-language inference is deferred.

## 7. Transactions and Returns

### Transactions

Make the usable row area clickable, not just the invoice number.

Keep compact rows, visible hover/focus, readable amount/status columns and a sticky header where helpful.

Nested controls—checkboxes, menu buttons, copy actions—must work without also opening the row.

Preserve filters and scroll position after viewing a transaction.

Remove employee filters in Owner-only mode.

### Correct “Cash + Cash”

Trace its source before changing it.

Group repeated confirmed payments using the same payment method/account for summary display, while preserving individual payment records in detail.

Do not combine an incoming cash payment and outgoing cash refund as two payment methods.

Use explicit refund/return information and keep payment status separate from return status.

### Returns: two-column workspace

Use approximately **40% receipt search / 60% selected receipt and return work**.

Left:

- Search receipt/customer/phone/product.
- Recent matching receipts.
- Compact status, amount and date.
- Paid/credit/partial-return/full-return indicators.

Right:

- Selected receipt summary.
- Remaining returnable quantities.
- Sellable/damaged/no-restoration choice.
- Refund/debt-adjustment review.
- Linked return history.

Before selection, show a concise explanation—not a huge empty form.

Fully returned or voided invoices remain clickable for inspection. Disable only creation of an invalid additional return, with a specific explanation.

Use a detail drawer for history entries. No unnecessary navigation away from the selected receipt.

Preserve all return quantity, stock-condition, financial, authorization and idempotency checks.

## 8. One consistent calendar and selector system

The screenshots show inconsistent behavior: custom supplier menus, different-looking grade suggestions, and native-looking date popups.

Inspect the actual rendered controls, including `<datalist>` behavior. Do not assume everything is already fixed because closed triggers look styled.

### Shared selectors

Reuse one searchable, accessible combobox system for:

Brand, model, grade, color, category, supplier, product, customer and location.

Provide search, selected state, clear action, loading/error/empty states, keyboard navigation and authorized creation.

WAI’s combobox guidance distinguishes choosing existing values from editable suggestions; implement the correct pattern rather than merely styling a text input.

### Shared date controls

Use the existing custom DatePicker/DateRangePicker consistently across Transactions, Returns, Customers, Credit, Receiving and Reports.

Support month/year navigation, Today, Clear, visible format guidance, keyboard operation and a mobile-appropriate presentation.

The WAI date-picker example provides useful focus and calendar interaction guidance, but it is an example to adapt and test—not production code to copy blindly.

Use Asia/Karachi for shop-date interpretation and backend filtering. Do not change an invoice timestamp merely to match a date label.

Menus, calendars, sheets and accordions need both entrance and exit transitions. Prevent clipping and preserve focus when they close.

## 9. Product Detail redesign; preserve Add/Edit Product

### Product Detail

Replace the large sparse label sheet with a compact product workspace.

Header:

Product name · code · status  
Edit · Duplicate · More

Main content:

- Reliable product image/gallery preview.
- Model, brand, grade and color.
- Selling price and minimum price.
- Available quantity beside its stock status.
- Damaged and Out for Test quantities.
- Full storage paths.

Secondary views:

**Overview · Stock & Locations · History**

Keep protected financial information in an authorized pricing section.

Do not repeat “Available stock” in several places unnecessarily.

Investigate the visibly broken product image. Check file references, authentication, URL resolution and thumbnail loading. Provide a consistent fallback without making private media public or hiding the underlying error.

### Add/Edit Product

Keep the approved two-column editor and compact gallery.

Add small information buttons next to terms the shop owner may not understand:

- **Initial stock:** “How many units you already have when adding this product.”
- **Low-stock alert at:** “Warn when available quantity reaches this number or less.”
- **Minimum selling price:** “Lowest permitted price without an authorized override.”
- **Purchase cost:** “What the shop paid. Restricted to authorized accounts.”
- **Aliases:** “Other names customers use when asking for this item.”

Use an information icon, not an eye icon that implies showing/hiding a value. Tooltips should work on hover and keyboard focus; interactive or longer help belongs in a popover/dialog.

## 10. Separate product status, grade and stock condition

Do not implement damaged stock as a substitute for Active/Archived.

Use three separate concepts:

| Concept | Examples |
|---|---|
| Product status | Active, Archived |
| Quality grade | Original, Grade A, Grade B, Copy, custom |
| Stock condition | Sellable, Damaged/Quarantine |

A single active product can have both sellable and damaged units.

On new-product opening inventory, allow the owner to select the condition of those initial units and an appropriate destination.

Damaged opening stock must enter damaged inventory and must not become available in POS.

Changing product status or typing “damaged” as a custom grade must not silently reclassify existing stock. Existing stock condition changes use the audited recovery/quarantine workflow.

Default ordinary new stock to Sellable, while preserving deliberate owner selection.

## 11. Quick-create without leaving the current workflow

### Master values

Brand, category, model, grade and color selectors should accept previously saved values and permit authorized custom creation.

Example:

Type `Vivo` → select saved Vivo.  
Type a new brand → `Create “…”`.

Save through the correct repository, return its ID, refresh suggestions, and select it immediately.

Prevent duplicate values caused by casing, surrounding whitespace or repeated submission. Do not save every keystroke as a new catalogue value.

### Supplier

Add **+ Add Supplier** inside the supplier selector.

Open a compact modal or side sheet for name, contact and optional details. Save, select the new supplier, and return focus to the original form.

Keep supplier management accessible from its existing management page/settings link too.

### Product inside Stock Receiving

Include **+ Add Product** inside the receiving product search.

Open an inline creation sheet. Preserve the receiving document, all existing rows, supplier, date, quantities and costs.

After saving, select the new product in the intended receiving row.

**Important:** A product created from Receiving must not receive opening stock and then receive the same stock again. Default that quick-create operation to catalogue-only creation; the receiving document creates the inventory movement once.

If the user explicitly needs opening stock, clearly separate it from the pending receipt.

Canceling a quick-create sheet must not clear the parent form. Reuse the main form’s validation and permission rules rather than creating an insecure second implementation.

## 12. Stock and storage clarity

### Stock table

Bring the key information together:

Product | Available and status | Damaged | Out for Test | Storage | Alert threshold | Actions

Keep secondary totals optional or in a detail disclosure to avoid widely separated columns.

Examples:

`1 available · Low stock`  
`0 available · Out of stock`  
`98 available · In stock`

Use red warnings for low/out-of-stock states, with text and icon—not color alone.

Zero damaged stock should be neutral. Reserve red emphasis for an actual damaged quantity or actionable issue.

### Context and click targets

Provide useful hover/focus/tap help:

- “0 units currently available to sell.”
- “1 damaged unit in quarantine.”
- “2 units temporarily held by customers for testing.”
- “No storage balance assigned yet.”

Clicking a quantity opens its breakdown/history. Clicking storage opens that location. Clicking the product opens Product Detail.

Preserve correct totals. Define “Total tracked units” and distinguish items physically in the shop from items out for testing. Do not add overlapping balances together.

### Storage hierarchy

Keep permanent IDs and editable friendly names.

Show the relationship clearly:

`Rack 12 → Shelf B → Box 04`

The Locations page must identify which rack/shelf the next column belongs to, highlight the selected path, and explain empty selections.

Support customized terminology and names. Where a level is not used, simplify its presentation without corrupting existing hierarchy, labels or history.

Rename changes display names—not identity.

Never rename an existing “Rag 15” or other unusual label automatically; it may be intentional.

Distinguish damaged/quarantine locations visibly and prevent ordinary receiving into them without an explicit damaged-stock operation.

## 13. Receiving and Transfers

### Receiving

Use a short explanation:

“Add newly received items to the selected storage location.”

Searchable product results should show image, name, variant, code and current stock.

Exclude service-only records from physical stock receiving. Individually tracked phones must use the appropriate per-device intake rules, not an unrestricted bulk quantity.

Support row-specific destinations and condition.

Preserve drafts, quick-add supplier/product, totals and final review.

Unknown purchase cost must not silently become zero. Preserve the existing distinction between unknown cost and an explicitly free item.

### Transfers

Use a short explanation:

“Move items between storage locations. The total quantity does not change.”

Show:

Selected product → From → To → Quantity

Below it:

Source before/after  
Destination before/after  
Total unchanged

Use readable full paths, not only `TM-L-…` identifiers.

Only allow compatible condition transfers. A damaged-location transfer must not turn items into sellable stock.

Validate positive quantity, different source/destination, sufficient stock and permission on the server. Preserve atomic paired movements.

## 14. Dedicated mobile sales — newly required

Implement a genuine mobile sales flow inside the existing Android shell.

Do not display the desktop POS, desktop sidebar, or three-column product grid on a phone.

Add an obvious **New Sale/Sales** destination to mobile navigation, preserving the central Scan action and access to Devices/Profile. Respect saved navigation preferences where possible.

### Mobile flow

**Search or Scan → Add items → Review cart → Choose payment → Complete sale → Share receipt**

Use:

- Large search input.
- Compact product/service results with image, price and availability.
- Searchable product selection.
- Sticky “View Cart” with item count and total.
- Quantity controls.
- Optional customer selection/quick add.
- Custom Service with name and one PKR charge.
- Saved service/material behavior where applicable.
- Cash, electronic, credit and split payment through existing backend operations.
- Clear success screen with invoice number.

Owner-only mode attributes the sale to the authenticated owner automatically.

### Product not found

Offer authorized **Add Product** or **Add Custom Service** as distinct choices.

Do not turn an unknown physical product into a service merely to bypass stock tracking. Do not invent available quantity.

### Payment and receipt

Use the same server pricing, tax, permissions, payment-proof and receipt logic as desktop.

Electronic proof can use the phone’s own camera/gallery without sending a camera request to itself.

After completion:

**View Receipt · Share PDF · Copy Receipt Link · New Sale**

Use the Android Sharesheet and permission-scoped content URIs for sharing generated files; do not expose private filesystem paths. Android’s file-sharing guidance supports temporary URI permissions for this purpose.

Retain manual WhatsApp message/link preparation. Sharing/opening must not be recorded as confirmed message delivery.

### Mobile concurrency and offline boundary

Mobile sales introduce another stock writer even when there is only one owner.

Use the same server-authoritative sale operation as desktop. PostgreSQL provides row locking and transaction isolation, but correctness still depends on applying those mechanisms to the actual business operation.

Test desktop and phone attempting to sell the final unit concurrently.

For this phase, mobile final checkout requires backend acceptance. Offline mobile may preserve drafts and cached lookup; do not invent a second offline financial engine.

Review the existing Windows offline authorization/reservation policy. Online concurrency tests do not resolve stock already promised to an offline counter.

Reuse a trustworthy reservation/coordination mechanism where implemented. Otherwise block mobile completion in unsafe stock states and explain that pending counter activity must synchronize or be reconciled first. Do not silently disable existing desktop offline protections or claim guaranteed offline stock availability.

Keep separate device/cart IDs. A mobile sale must not overwrite the desktop draft or take over the customer display automatically. Display casting, if used, must explicitly target the intended counter.

## 15. UI consistency and integrations

Use shared components for buttons, checkboxes, calendars, selectors, row actions, help, drawers and notifications.

Keep normal desktop controls compact and mobile controls comfortably tappable. Do not solve density by shrinking the entire application or relying on browser zoom.

Test at normal browser zoom and common display scaling.

Ensure:

- Keyboard and touch access for every clickable element.
- Readable dark-mode surfaces.
- White receipt/invoice paper in either theme.
- No clipped menu, image, toast, footer or modal.
- Visible focus.
- Reduced-motion support.
- No disruptive layout shifts.
- Real loading/error states instead of fabricated zero values.

Preserve device pairing, photo upload, media crop/order/primary behavior, universal scanner and private file access.

Keep Staff/Owner presentation changes separate from Device Bridge authentication. A hidden employee menu must not break phone pairing.

## 16. Backend and data rules

Implement features through existing repositories and custom API services.

No fake success toasts for unsaved data.

Feature configuration, customer details, master values, quick-created products, storage settings and mobile sales must persist and read back correctly in API mode.

Use versioned migrations and non-destructive upgrades. Inspect the intended development database before applying them.

Keep source actor attribution, historical pricing/tax snapshots, cash/refund separation and idempotency intact.

Do not change original receipts or outbox payloads to accommodate UI labels.

If setup is incomplete, show a contextual action to finish the missing configuration rather than silently inventing payment accounts, supplier details or storage locations.

No production secrets belong in frontend assets, APKs, logs or reports.

## 17. Acceptance tests and evidence

Create failing reproductions for the screenshot defects before fixing them.

Run isolated tests, then verify the actual API-backed browser preview. Demo-only assertions are insufficient for persistence claims.

Minimum acceptance coverage:

| Area | Required result |
|---|---|
| Owner-only mode | Staff UI disappears; authentication, historical attribution, receipts and phone pairing remain |
| Setup | Existing settings prepopulate; changes persist; no repeated wizard or data reset |
| Customer workspace | Two-column layout; coherent timeline/ledger; every history entry opens correct details |
| Credit reminders | Exact due date or No time limit/taken date; no stale reminder for settled debt |
| Dashboard | Every highlighted card/row opens its matching filtered detail |
| POS header | Customer switching does not shift cart layout or duplicate customer data |
| Transactions | Whole-row navigation; nested actions unaffected; payments/refunds summarized correctly |
| Returns | Search left, work/history right; fully returned receipt viewable but not returnable again |
| Selectors | Brand/model/grade/calendar popups use the same design and keyboard behavior |
| Quick creation | Supplier/product creation returns to the correct form without clearing its draft |
| Receiving | New product receives stock once; service-only record cannot be received |
| Stock | Available/status adjacent; damaged/test quantities correct and inspectable |
| Product Detail | Compact image-first layout; broken-image cause fixed or truthful fallback |
| Transfers | Full paths and before/after quantities; condition preserved |
| Mobile sale | Real sale, correct stock/ledger/payment, stable invoice, PDF share |
| Concurrency | Desktop/mobile final-unit competition and duplicate submission handled safely |
| Regressions | Existing services, damaged returns, tax, receipts and offline reconciliation remain correct |

Use representative isolated fixtures, including a customer with no due date, a partially paid invoice, a fully returned invoice, a damaged item, an ambiguous service match and multiple storage locations.

Do not insert these fixtures into real shop data or delete the owner’s existing test records.

### Visual review

Capture and inspect:

Customer workspace, customer history drawer, dashboard hover/focus, POS customer before/after, transactions, split Returns view, open calendars, open grade/supplier selectors, quick-add product, Product Detail, Stock, Receiving, Transfers, mobile sale/cart/payment/receipt.

Test light/dark at:

1920×1080, 1440×900, 1366×768, 1024×768, 390×844 and 412×915.

Report full-suite results honestly. Separate initial failures from passing reruns. Do not delete tests, weaken assertions, or fabricate native/physical acceptance.

## 18. Updated APK and localhost handoff

Build the updated mobile frontend and Android test APK using the current project’s tools.

Determine the latest installed version/code and increment correctly. Preserve the existing test signing identity where available so installation can update the current app.

Do not hardcode an old LAN IP, invent a production backend, or claim release signing when only debug signing exists.

Provide:

- APK version/build.
- Exact local artifact path.
- Verified download endpoint when available.
- SHA256 and signature verification.
- Actual current backend address for development.
- Physical test steps.

Preserve existing phone connection, pairing and settings across an update wherever compatible.

Start or reuse the current safe development backend and current frontend source build. Prefer existing ports, but inspect processes rather than assuming old URLs.

Verify health, login, Dashboard, customer workspace, POS, stock and mobile API operations.

Do not terminate unrelated services or reset databases. Do not present an APK link or localhost URL until verified.

If the environment cannot keep the preview process alive, provide a simple launcher and say so.

## 19. Final report

Create:

`docs/PHASE5D1_IMPLEMENTATION_AND_ACCEPTANCE.md`

Include:

1. Screenshot issue → root cause → change → verification.
2. Owner-only/staff mode behavior and preserved history.
3. Customer redesign and exact account/ledger calculations.
4. Dashboard destination/filter map.
5. Transactions/returns corrections.
6. Master-value and quick-create behavior.
7. Product/stock/location/receiving/transfer improvements.
8. Mobile sales scope and offline/concurrency limitations.
9. New migrations and API changes.
10. Fresh test results and screenshot paths.
11. Verified localhost and APK details.
12. Remaining blockers for daily production use.

Give the owner a short test sequence beginning with:

**Customer account → history entry → reminder → dashboard drill-through → quick-add receiving → mobile sale → receipt sharing.**

Distinguish:

**Implemented · Automatically tested · Physically tested · Deployed**

The objective is a usable, testable application—not a claim that every production requirement is finished.

**Implement these stages now. Preserve working behavior, address the customer workspace first, and finish with a verified browser preview and updated Android test build.**