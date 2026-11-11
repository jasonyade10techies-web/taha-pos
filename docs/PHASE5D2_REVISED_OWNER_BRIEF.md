# TAHA POS — PHASE 5D.2 REVISED MASTER IMPLEMENTATION
## Neutral Gray UI, Smart @Product Services, QR Device Sign-In, Local LAN Operations & Retail Reliability

**Project:** `D:\Inventory system POS`  
**Date:** 22 October 2026  
**Application:** Taha POS / Taha Staff  
**Owner mode:** Single-shop, owner-only initially  
**Architecture:** Existing custom NestJS + PostgreSQL + React/Tauri + Android + SQLite

You are continuing the actual Taha Mobiles codebase.

The owner has reviewed the latest desktop screens, installed the Android APK and supplied additional screenshots. This prompt supersedes the earlier Phase 5D.2 brief.

**Do the engineering work. Do not merely describe a plan.**

This is a large architectural and usability task. Break the implementation into bounded, independently testable changes within the existing repository. Keep a documented progress checklist and integrate each completed stage without breaking the others.

Do not claim features are complete merely because their screens render.

---

# 1 — Preserve the existing project

Before editing, inspect:

- Latest implementation reports and Git status.
- Current custom-service implementation.
- Saved service templates and product matching.
- Existing product sale and transaction operations.
- PostgreSQL inventory movements.
- Offline cash/outbox/reconciliation.
- Device pairing and LAN bridge.
- Android shell and native scanner.
- Receipts and virtual receipts.
- Shop setup and feature flags.
- Current shared UI components/themes.

Preserve the approved New Sale layout, product cards, responsive customer cart, Add/Edit Product gallery, customer account workspace and Taha branding.

Preserve real financial/accounting records, historical prices, existing payments, returns, damaged stock, credits, permissions and audit trails.

Do not reconnect Supabase, assume a VPS, or perform production deployment.

Use non-destructive migrations and development/test databases for destructive scenarios.

Create:

`docs/PHASE5D2_REVISED_PROGRESS.md`

Track implementation and verification stage by stage.

---

# 2 — Neutral grayscale design system

The owner specifically rejects the navy-blue tint of the current themes.

Redesign the colors, **not the application's entire page structure**.

Light mode:

- Main background: `#F3F3F3`
- Cards: `#FFFFFF`
- Raised surfaces: `#F8F8F8`
- Borders: `#E2E2E2`
- Primary text: `#202020`
- Secondary text: `#626262`
- Sidebar: neutral charcoal
- Primary action: `#F2BC2D`

Dark mode:

- Main background: `#181818`
- Sidebar: `#141414`
- Cards: `#262626`
- Raised surfaces: `#303030`
- Borders: `#414141`
- Primary text: `#F2F2F2`
- Secondary text: `#C5C5C5`
- Primary action: `#F2BC2D`

Keep the Taha red branding.

These are initial tokens. Verify and adjust actual component contrast.

Do not introduce bluish backgrounds, excessively bright white borders, unreadable muted text or large colored cards.

Build semantic tokens for hover, focus, disabled, selected, warning, error, success, overlay, tooltip and chart states.

Apply the theme consistently to desktop and Android.

Keep the bundled primary font consistent.

Receipts and A4 invoices must stay white in both themes.

Create visual screenshots of the same pages in both themes and inspect actual readability.

---

# 3 — Implement a genuine Discord-style @Product service composer

This is a top-priority requirement.

The owner demonstrated that entering:

`@y20 panal screen replacement`

currently produces:

`Service only · no inventory will be consumed`

That is incorrect for an explicitly selected product mention.

## 3.1 Product mention trigger

In New Sale → Custom Service, support the `@` symbol as a product search trigger.

Examples:

`@y20`

`@y20 panal`

`@vivo y20 panel`

`@a15 charging`

Opening `@` should display a compact suggestion panel close to the caret.

Show:

Product image
Product name
Model/variant
Available stock
Selling price

Match typos using the existing search and alias engine.

Use keyboard navigation:

Arrow Up/Down
Enter or Tab to select
Escape to close

Allow mouse/touch selection.

Do not show a full-width generic dropdown.

Do not make an unmatched typed `@` phrase automatically deduct stock.

## 3.2 Selected mention token

Once the employee selects the product, the mention becomes a highlighted inline token.

Example:

`[Vivo Y20 Panel ✓] screen replacement`

Use a soft gold highlight, not Discord-blue branding.

The token must represent the actual immutable product ID and selected variant, not just the product name.

Support:

- Removing a token.
- Changing the product.
- Inspecting the linked product.
- Checking current stock.
- Editing the text around it.
- Copy/paste and keyboard deletion.
- Selection after typos.

Never corrupt the surrounding service description or cursor position.

Use a structured editor model; do not rely on parsing arbitrary HTML or plain text at checkout.

## 3.3 One product initially

Support one linked inventory component per custom-service line in this iteration.

If multiple components are needed, use another linked line or existing repair job/material workflow.

Do not implement a fragile free-text parser that tries to deduct five unrelated products automatically.

Future multiple-part bundles should be possible without redesigning the database again.

## 3.4 Linked inventory summary

When selected, immediately display a compact line beneath Service Name:

**Linked material: Vivo Y20 Panel × 1 · 36 available**

Alongside or beneath it:

**Normal selling price: PKR 2,000**

This summary replaces the existing text:

“Service only · no inventory will be consumed.”

The service-only message should appear only if there is genuinely no linked material.

If stock is zero, clearly warn that the material cannot currently be sold.

If stock exists at multiple rack/shelf/box locations, use the existing eligible-location allocation rules.

## 3.5 Combined description

After the highlighted token, allow the employee to type the service performed.

Examples:

`[Vivo Y20 Panel] screen replacement`

`[Samsung A15 Charging Board] installation`

`[iPhone 13 Battery] fitting`

Generate a clean customer-facing display name without showing `@`, internal IDs, or editor markup.

Allow deliberate manual editing of the customer-facing wording.

---

# 4 — Combined part + labor pricing

This is the most important pricing requirement.

The employee types **one final customer charge**.

The application calculates how much belongs to the linked product's selling allocation and how much is the service/labor charge.

Example:

Linked product selling price: PKR 2,000

Final amount charged: PKR 2,500

Breakdown:

Product allocation: PKR 2,000

Labor/service charge: PKR 500

Customer total: PKR 2,500

## 4.1 Live breakdown

Under the Charge input show two clearly aligned rows:

**Product portion: PKR 2,000**

**Service / labor: PKR 500**

Update immediately while editing the total.

Avoid huge empty spaces between these values and the action buttons.

Keep the modal compact.

## 4.2 Calculation rules

Let:

S = current valid product selling-price allocation per unit.

T = entered combined customer charge per unit.

When T >= S:

Product portion = S

Labor = T - S

When 0 <= T < S:

Product portion = T

Labor = 0

Discount against product selling basis = S - T

Do not produce negative labor.

Do not classify the difference as labor cost, purchase cost or shop profit.

## 4.3 Same-price example

Product selling price: PKR 2,000

Combined charge: PKR 2,000

Show:

Product: PKR 2,000

Labor: PKR 0

Do not add another service amount.

## 4.4 Lower-price example

Product selling price: PKR 2,000

Combined charge: PKR 1,800

Show a clear warning:

“Normal product selling price is PKR 2,000. Your combined charge is PKR 200 lower.”

Show:

Product allocation: PKR 1,800

Labor: PKR 0

Discount against product basis: PKR 200

Respect the existing minimum allowed selling price.

If the product floor or another existing approval rule would be violated, request authorized override rather than allowing a custom-service shortcut.

## 4.5 Purchase cost versus selling price

Do not confuse these.

The component's selling allocation uses its applicable customer-facing selling price.

The actual purchase cost is used separately for profit calculation and must remain hidden from unauthorized users.

A PKR 500 labor allocation is **labor revenue**, not necessarily PKR 500 profit.

Account for direct service expenses if the current business engine supports them.

## 4.6 Editing a combined service

After adding the item to the cart, show ONE item.

Example:

Vivo Y20 Panel Screen Replacement

PKR 2,500

Small subline:

Includes 1 Vivo Y20 Panel

Click the pencil icon.

Open the existing Service Price editor, now with:

Combined customer charge

Product portion (calculated)

Service/labor portion (calculated)

Any discount/override warning

All values update live.

Preserve the linked SKU and quantity.

If the product selling price changes before checkout, require explicit review instead of silently changing labor allocation.

## 4.7 Quantity

A combined service may have quantity greater than one only where valid.

Clearly distinguish unit price and line total.

Quantity 2 must consume two actual linked units.

Do not deduct stock twice when cart quantity changes or checkout is retried.

## 4.8 Saved service templates

“Save as reusable service” stores:

Service name
Associated linked product ID where appropriate
Default description
Optional default labor charge/pricing rule
Owner/employee attribution

Do not permanently freeze an outdated product selling price into a reusable template without identifying it as a snapshot.

When reopened, retrieve the current product and verify availability/price.

If its product is archived, unavailable or removed, require review.

---

# 5 — Backend implementation of combined services

The UI must not be the source of financial truth.

Extend the existing backend transaction domain to represent a compound service item:

Customer-facing single line
Linked inventory component
Component quantity
Service/labor allocation
Combined price
Discount/override
Tax allocation
Location movement
Audit metadata

Use the existing PostgreSQL financial transaction engine.

At checkout, atomically:

1. Validate product identity and availability.
2. Verify location and quantity.
3. Validate final charge and floor/override.
4. Persist immutable allocation snapshots.
5. Record a single customer-facing service line.
6. Record its linked material consumption.
7. Deduct stock exactly once.
8. Record payment/credit/tax.
9. Record movement, audit and idempotency identifiers.

Never deduct stock merely when a mention is selected or the line is added to the cart.

Do not create a second sale or count the part and service allocations as two separate customer charges.

Customer receipt:

**Vivo Y20 Panel Screen Replacement — PKR 2,500**

Internal reporting:

Product revenue allocation: PKR 2,000

Labor revenue allocation: PKR 500

Purchase cost: protected

Profit: derived correctly

Preserve correct tax behavior and immutable invoice history.

Test full/partial returns of such a service. Returned material must be explicitly classified sellable/damaged/no restoration. Refunding labor must follow an authorized policy and not happen automatically just because a physical part was returned.

---

# 6 — QR pairing without entering credentials on the phone

The owner wants an experience similar to linking a companion device.

The PC is already signed into Taha POS.

Phone opens Taha Staff.

Phone taps:

**Scan to Connect**

PC displays:

Settings → Devices → Connect Phone → QR

Phone scans QR.

PC shows:

**Authorize this phone?**

The owner approves.

Phone automatically obtains its own authorized Taha Staff session.

No email/password entry required on the phone for this pairing process.

## Security requirements

Do not place the owner's password, refresh token or reusable bearer token in the QR code.

Implement short-lived, single-use cryptographic enrollment.

Bind the enrollment to:

Shop
Branch
Counter
Device identity
Approving user
Permitted role/scope

Use a secure challenge exchange and proof of possession over a protected channel.

Require approval from the authenticated desktop owner or authorized manager.

The phone receives its own revocable session/credential stored using secure Android storage.

Implement:

Device list
Session expiry/refresh
Revoke device
Disconnect phone
Lost-phone recovery
Unauthorized-device rejection
Expired-code rejection
Replay protection

Avoid giving a newly paired phone permanent unrestricted owner privileges simply because it scanned a QR.

Any sensitive owner action should retain its existing authorization/reverification policy.

Do not create insecure LAN passwordless login via an HTTP URL containing credentials.

When cloud authentication is temporarily unavailable, distinguish previously trusted local sessions from new cloud enrollment; do not invent unverified authorization.

---

# 7 — Automatic PC and phone discovery

Support these practical connection arrangements:

**A. Same Wi-Fi router**

PC and Android connected to the same local network.

**B. PC Ethernet + phone Wi-Fi**

Both on the same reachable LAN.

**C. PC hotspot**

PC starts its hotspot.

Phone joins that hotspot.

Internet access on the hotspot is not mandatory for local device discovery and communication.

**D. Cloud connection**

When a production cloud backend exists, the phone may connect through HTTPS outside the shop.

Use appropriate Android local-network discovery where supported.

Consider Android NSD/mDNS with QR-address fallback.

Show nearby counters where genuinely discovered:

Taha Mobiles — Main Counter

Connected / Available / Not Reachable

Don't show fabricated devices.

QR may supply local counter identity and endpoint information, but must be authenticated and protected against endpoint spoofing.

If discovery is blocked by router isolation/firewall, show actionable diagnostics and preserve manual address fallback.

Do not assume a current 192.168.x.x IP remains permanent.

Test changing network interfaces, hotspot addresses and backend restarts.

Ensure the LAN device bridge is actually running and reachable; its existing separate-service dependency must not be hidden.

---

# 8 — Full local shop architecture during internet outages

Target the owner's preferred model:

The counter PC is the single authoritative local terminal for the shop while cloud connectivity is unavailable.

The phone is a client of that counter.

Architecture:

Taha POS Counter
→ Local authority / durable SQLite operations
→ Outbox
→ Cloud synchronization

Taha Staff Phone
→ Local authenticated counter transport
→ Same local stock and sale authority

Do not allow the phone and PC to independently deduct the same stock from unrelated offline databases.

## 8.1 Operating states

Show clear states:

Cloud Connected

Counter Connected — No Internet

Syncing

Offline — Counter Unreachable

Needs Owner Review

Use a small appropriate status indicator instead of showing an IP address prominently.

## 8.2 Offline operations

Preserve all already-verified local cash/offline reconciliation behavior.

Investigate how the mobile sale request can reach the counter PC's existing offline authority.

If safely supported, allow phone-initiated cash sales to commit at the local counter using the same transaction and invoice allocation rules.

Cash received remains durable and traceable even if later cloud synchronization conflicts.

Do not pretend cloud-confirmed JazzCash/bank payments are verified while the cloud is unavailable.

Do not allow unsafe credit, stock receiving, write-off or permission changes offline unless their existing authorization and reconciliation invariants are proven.

If a specific offline operation cannot be made safe, disable only that operation with a clear reason.

## 8.3 Failure handling

Test:

- PC and phone on hotspot without internet.
- Phone and PC on normal Wi-Fi.
- Wi-Fi connection drops during upload.
- PC app closes during a sale.
- App restarts with pending outbox records.
- Cloud responds after committing but before client confirmation.
- Last unit sold by another authorized device.
- Pending cash sale conflicts during sync.
- Product price changes during an offline session.
- An enrolled phone is lost/revoked.
- User signs out on the PC.
- Phone is paired to the wrong counter.

Use idempotency and the existing owner reconciliation workflow.

Do not claim full offline daily-use acceptance unless these tests actually pass in native environments.

---

# 9 — First-run setup and Settings

Introduce or refine the Shop Setup experience.

Use a compact onboarding sequence, not a giant settings form.

Initial steps:

Shop identity
Owner-only versus staff
Branch and counter
Payment methods
Tax and receipt preferences
Inventory/location organization
Damage/quarantine policy
Repair/service workflows
Phone pairing
Sync/backup readiness

Existing shops should use Review Shop Setup without resetting records.

Settings should be clearly grouped:

General
Shop
POS
Inventory
Repairs
Customers & Credit
Payments
Receipts
Devices
Appearance
Offline & Sync
Advanced

Constrain ordinary settings cards to comfortable reading widths; do not show one giant empty white card.

Provide clear Save/Discard status.

Use a subtle Taha logo startup sequence, real initialization progress and no artificial multi-second delay.

---

# 10 — Product, receipt and mobile UI corrections

Carry forward all unresolved requirements from the prior Phase 5D.2 brief.

## Desktop

- Compact Dashboard first-screen overview.
- Neutral gray light/dark palettes.
- Product filters in one compact toolbar.
- Correct service-only product status in catalogue.
- Stable POS layout and cart.
- Returns switch: Receipts / Return History.
- Seven receipts per Returns page.
- Clickable transaction rows with preserved filters.
- Compact invoice view and obvious Back control.
- Proper refund-versus-payment presentation.
- Customer Edit form consistent with the approved Product Editor.
- Compact help icons for credit, prices and inventory.
- Better Settings organization.
- Consistent styled selects, calendars, menus, checkboxes and dialogs.
- Compact delayed tooltips for meaningful business figures.
- Toast notifications entering near the top.

## Receipts

- Correct 80mm and A4 layouts.
- Always-white print previews.
- Readable QR size and quiet zone.
- Short, secure, non-guessable receipt references.
- Customer-safe virtual receipt that looks like a receipt.
- No protected details exposed.
- Correct paid/refunded/outstanding breakdown.

## Android

- Proper edge-to-edge native shell and insets.
- Working Settings navigation from drawer.
- Accurate coded logo.
- Product images or meaningful fallback with correct authenticated loading.
- Dedicated mobile sales.
- Receipt-style View Receipt after checkout.
- Share PDF/link using supported Android mechanisms.
- Reliable QR/barcode scanning with autofocus/zoom support.
- Camera requests and photo queues preserved.
- Clear local/cloud connection states.
- Stable device pairing after update.
- No visible localhost URL in ordinary navigation.

Investigate rather than assume the approximate 4 MB APK is missing its bundled UI.

Do not enlarge the APK artificially.

---

# 11 — Repair-shop operational scenarios

Audit the existing implementation against realistic shop cases.

At minimum test or document handling of:

## Sales and services

- Sale with one product.
- Sale with several products.
- Service only.
- Service consuming one part.
- Incorrect product mention.
- Ambiguous matching.
- No available part.
- Price lower than product retail.
- Price below minimum allowed.
- Changed price after item added to cart.
- Partial payment.
- Duplicate checkout click.
- Return/refund of combined service.

## Inventory and storeroom

- Incoming stock.
- Duplicate product names but different variants.
- Part moved between racks.
- Incorrectly placed item.
- Damaged return.
- Recovery to sellable stock.
- Item written off.
- Physical count discrepancy.
- Missing storage location.
- Stock reserved or out for test.
- Phone/PC both trying to sell the final item.

## Customers and credit

- Walk-in customer.
- Repeat customer.
- Business credit account.
- No credit due date.
- Overdue credit.
- Partial collection.
- Incorrect payment recorded and reversed.
- Item return against an unpaid invoice.
- WhatsApp reminder prepared manually.
- Customer changes phone number.

## Repairs and purchased phones

- Repair using linked parts.
- Repair canceled before work.
- Repair completed but customer has not collected device.
- Used device purchased and later resold.
- Duplicate IMEI.
- Device returned damaged.
- Repair service with no inventory consumption.

## Devices and connectivity

- Unpaired phone.
- QR expired.
- Phone paired to wrong counter.
- Router changed.
- PC hotspot without internet.
- Cloud outage.
- Photo upload interrupted.
- App closed and reopened.
- Phone lost/revoked.
- Windows offline cash pending sync.

Do not add speculative features just to fill this list. Where current workflows already cover the case, verify them. Where they do not, classify the missing behavior and implement only the changes necessary for this phase's core requirements.

---

# 12 — Tests and acceptance gates

Run the actual tests, not only source inspection.

Core acceptance:

1. Type `@y20 panal`.
2. Receive relevant inventory suggestions.
3. Select correct actual product.
4. See highlighted linked product token.
5. See available quantity.
6. Type `screen replacement`.
7. Enter PKR 2,500 with a PKR 2,000 product.
8. See Product PKR 2,000 / Labor PKR 500.
9. Add one combined cart line.
10. Edit price to PKR 2,000; labor becomes zero.
11. Edit below retail; warning and appropriate floor control appear.
12. Complete sale; one product unit is deducted.
13. Verify one customer-facing line and correct internal accounting.
14. Retry identical checkout; no second deduction.
15. Verify combined item returns and damage handling.
16. Pair a fresh phone by scanning PC QR without entering a password on the phone, after secure PC authorization.
17. Revoke that phone and verify access is rejected.
18. Discover PC through normal Wi-Fi and PC hotspot where test hardware is available.
19. Verify local LAN camera requests without internet.
20. Verify mobile sale/offline restrictions and reconciliation correctly.
21. Verify light and dark theme readability.
22. Verify receipt QR and virtual receipt behavior.
23. Re-run all existing browser/backend/SQLite/Android regressions.

Use isolated test data, especially for financial and stock scenarios.

Report physical testing separately from automated/emulated testing.

Do not weaken tests or invent successful hardware results.

---

# 13 — Final artifacts and handoff

Create:

`docs/PHASE5D2_REVISED_IMPLEMENTATION.md`

Include:

**A. Smart Services**
- Mention composer
- Matching
- Product linkage
- Calculation
- Saved templates
- Stock deduction
- Return behavior

**B. Pairing**
- QR login flow
- PC approval
- Device-scoped session
- Revocation
- Local/cloud distinctions

**C. Offline**
- Current authority
- LAN operation
- Cash sale behavior
- Synchronization/conflicts
- Remaining unsupported operations

**D. Themes and UI**
- Color tokens
- Light/dark screenshots
- Settings and startup
- Outstanding UI corrections

**E. Testing**
- Actual executed tests
- Pass/fail counts
- Network and security results
- Physical-device limits

**F. Deliverables**
- Verified localhost frontend URL
- Verified backend health
- Updated Android test APK version/path
- Verified APK signature and checksum
- Actual download URL where available

**G. Next blockers**
- Production cloud deployment
- Windows native installer
- Remaining offline native acceptance
- Hardware testing

Keep the frontend/backend running for the owner's localhost test when the environment permits.

Do not label the application production-ready until the real native Windows application, deployed backend, device pairing and financial/hardware acceptance have been demonstrated.

**Start with the @Product Custom Service because this is the owner's immediate functional priority. Then complete the authentication/LAN architecture, neutral-gray UI and remaining corrections in a controlled sequence.**