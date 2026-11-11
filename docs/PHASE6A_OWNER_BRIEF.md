# TAHA POS — PHASE 6A
## Real Vercel Deployment, Cloud Database, Secure Storage & Complete Online Acceptance

**Project directory:** `D:\Inventory system POS`

**Business:** Taha Mobiles  
**Application:** Taha POS / Taha Staff  
**Date:** 29 October 2026  
**Target:** A real, shareable, HTTPS staging application that works on desktop and mobile without requiring the owner's computer to remain running.

You are the senior deployment engineer, full-stack developer, database engineer, security reviewer and QA engineer responsible for deploying the existing Taha POS application.

**The owner needs to demonstrate this software to another person using an actual online URL.**

The goal is NOT to publish a frontend that only looks functional.

The goal is a working online staging system with real authentication, one shared database, persistent product images, correct inventory operations and verified sales/credit/return workflows.

Implement the necessary integration, perform safe deployment when authorized, and test the public staging URL.

Do not rebuild the approved UI.

---

# PART 1 — Investigate the existing application

## 1. Read the project

Inspect the current repository, latest reports, package configurations and Git status.

Review:

- React/Vite frontend.
- Existing client-side routing.
- NestJS backend.
- PostgreSQL migrations and financial operations.
- Authentication/session implementation.
- Product and inventory repositories.
- POS transaction engine.
- Smart Custom Services.
- Customers and credit ledger.
- Returns and damaged stock.
- Tax, payment and receipts.
- Media uploads and private file storage.
- Device Bridge and real-time transport.
- Mobile browser layout and Android-only integrations.
- Offline synchronization and reconciliation.
- Environment configuration.
- Existing deployment packages.

Latest previously reported baseline:

- Backend: 176 passing tests.
- Browser: 164 passing, one skipped.
- Android: 24 passing.
- Latest documented APK: 0.5D.2-test, build 10.

These are historical results, not proof that the current build passes.

Re-run appropriate tests and report fresh results.

## 2. Build an actual readiness matrix

For each module, determine whether it is:

- Fully API-backed.
- Partially API-backed.
- Local demo only.
- Dependent on a running LAN service.
- Dependent on a desktop/native API.
- Broken or unverified.

Inspect code, routes and database operations rather than assuming completion from previous reports.

Create:

`docs/PHASE6A_VERCEL_READINESS_AUDIT.md`

Identify every remaining obstacle to a working online demonstration.

Prioritize authentication, database integrity, POS transactions, media persistence and browser accessibility.

---

# PART 2 — Select a valid Vercel architecture

## 3. Preferred deployment architecture

Prefer two Vercel projects from the existing repository if that best fits the codebase.

### Frontend project

React/Vite SPA deployed on Vercel.

Responsibilities:

- Dashboard.
- New Sale.
- Products.
- Inventory.
- Customers.
- Credit and ledger.
- Returns.
- Reports.
- Settings.
- Browser-compatible mobile sales.
- Invoice and receipt previews.

### Backend project

Existing NestJS API deployed through Vercel Functions/Fluid compute where compatible.

Responsibilities:

- Authentication.
- Permissions.
- PostgreSQL access.
- Financial transactions.
- Product management.
- Stock movements.
- Customer/credit operations.
- Return/refund accounting.
- Receipt endpoints.
- Media authorization.
- API health and diagnostics.

### PostgreSQL

External managed PostgreSQL, preferably a compatible provider such as Neon through the Vercel Marketplace.

### Private file storage

Private Vercel Blob or another approved persistent private object-storage provider.

### Real-time delivery

Evaluate the existing WebSocket implementation against current Vercel WebSocket capabilities and distributed Function execution.

As of October 2026, Vercel supports WebSockets, but connections are limited by Function lifecycle and instance isolation.

Use Redis/pub-sub where necessary for cross-instance events and presence, or implement a tested database revision/polling fallback.

Do not rely on a process-global Map or in-memory event emitter for durable shared state between Function instances.

## 4. Do not overcomplicate this staging deployment

One frontend project and one backend project are acceptable.

The person receiving the demonstration link should only need to open the frontend URL.

Use an appropriate same-origin `/api` proxy/rewrite when practical. If the API requires a separate HTTPS origin, configure strict CORS, session cookies and WebSocket URLs correctly.

Test rather than assume WebSocket upgrade forwarding works through a rewrite.

Do not migrate the project to Next.js just because it is deployed on Vercel.

Do not replace NestJS.

Do not switch PostgreSQL to MySQL.

Do not reintroduce Supabase as the application's authentication/backend architecture.

---

# PART 3 — Hosting account, staging isolation and costs

## 5. Check Vercel readiness

Inspect whether Vercel CLI authentication, project access and required permissions already exist.

Check the actual team/account plan.

Taha POS is a commercial/client application. Do not assume Vercel Hobby is permitted for this deployment.

Report any required plan, paid database, storage or Redis resource before provisioning it.

Use existing approved resources where appropriate.

Do not purchase services, upgrade plans or enable new billing without explicit owner approval.

If authentication is missing, request the unavoidable secure sign-in/authorization step.

Do not ask the owner to paste passwords, API tokens or connection strings into chat.

## 6. Separate staging from production

Create an isolated staging environment with:

- Its own PostgreSQL database.
- Its own file-storage namespace/store.
- Staging-specific authentication configuration.
- Staging secrets.
- Staging application origin.
- Clear staging branding/indicator.
- Independent backup/restore configuration.

Never connect a public staging demonstration to the owner's live shop database by default.

Do not copy real customer phone numbers, credit records, payment proofs or private photos into staging without explicit authorization.

A dedicated staging Vercel project using its deployment domain is acceptable; it need not use a paid custom domain immediately.

Do not require the owner to purchase a domain before testing.

Use the actual generated `.vercel.app` domain.

Ensure the chosen protection method permits the intended invited reviewer to access the site without inadvertently exposing backend data.

---

# PART 4 — Deploy the frontend correctly

## 7. Prepare the Vite build

Inspect the existing project layout and build scripts.

Configure the actual frontend root directory and Vercel build settings.

Use the existing production build process.

Ensure:

- Bundled local fonts.
- Taha logo.
- Correct styles.
- Icons.
- Routing.
- Mobile responsive layouts.
- Current neutral-gray themes.
- Functional login page.

Add correct SPA fallback routing for actual application routes.

Test direct navigation and refresh at:

`/dashboard`

`/pos`

`/products`

`/customers`

`/transactions`

`/returns`

`/settings`

Also test nested customer/product/invoice routes.

Do not let a generic SPA catch-all intercept `/api` requests.

## 8. Eliminate localhost dependencies

Search production code and deployment configuration for:

`localhost`

`127.0.0.1`

`192.168.`

`http://`

Hardcoded development ports.

Replace development-specific assumptions with appropriate configuration.

Do not remove local-development settings where they are intentionally used for localhost testing.

Production/staging builds must not silently connect to the owner's PC.

No browser should need the Vite development server running.

## 9. Configure environment values

Client-visible settings must contain only public, non-secret configuration such as an API origin, deployment environment and appropriate feature flags.

Keep database credentials, signing secrets, storage tokens and session secrets server-side.

Do not expose secrets through `VITE_` environment variables.

Clearly separate development, staging and production configurations.

---

# PART 5 — Deploy the actual NestJS API

## 10. Adapt the NestJS bootstrap for Vercel

Inspect the current API architecture.

Use Vercel's supported NestJS function entrypoint arrangement.

Avoid starting a persistent TCP listener as the only route for a Function deployment if the framework adapter does not expect it.

Ensure the application can initialize correctly inside the Function environment.

Do not start the local LAN device listener from every cloud Function invocation.

Do not depend on local filesystem persistence or long-running process memory.

Verify:

`GET /api/v1/health`

The response must check actual backend health.

Provide a separate authenticated readiness/diagnostic check for database and required integrations as appropriate.

Do not expose infrastructure secrets in public health responses.

## 11. Database connections

Use appropriate TLS and connection pooling for the hosted PostgreSQL provider.

Protect against excessive connections during multiple cold starts.

Inspect the existing SQL transaction implementation.

Preserve:

- Atomic sales.
- Idempotency.
- Row-level locking.
- Inventory consistency.
- Permission enforcement.
- Credit accounting.
- Return/refund integrity.
- Immutable audit/history.
- PostgreSQL functions/triggers/extensions actually used.

Do not run schema migrations on every API startup.

## 12. Run migrations safely

Create an isolated staging database.

Inspect all existing migrations, their order and dependencies.

Apply migrations using the supported deployment workflow.

Verify schema version and required PostgreSQL capabilities.

Do not create tables using a simplified alternative schema just to make the frontend work.

Use approved initial test data.

Run database validation and concurrent-sale tests against the staging database.

---

# PART 6 — Authentication and session reliability

## 13. Fix login before launching the demonstration

The previous localhost restart failed to establish a confirmed healthy backend.

Investigate startup failures rather than copying the same environment to cloud hosting.

Verify:

- API health.
- Database health.
- User lookup.
- Password verification.
- Session creation.
- Session refresh.
- Logout.
- Expired-session recovery.
- Role/permission checks.
- Authorized access from both desktop and mobile browsers.

Do not use a hardcoded owner password in the deployed frontend.

Do not expose test credentials in Git or browser logs.

## 14. Secure browser sessions

Inspect cross-origin/same-origin choices.

Use:

- HTTPS.
- Secure cookies where appropriate.
- HttpOnly refresh credentials.
- Correct SameSite/domain behavior.
- CSRF protections where applicable.
- Server-side authorization.
- Rate limiting for authentication and sensitive actions.
- Appropriate CORS allowlists.

Ensure session renewal remains usable after page refresh.

The same account may be used on two authorized devices, but sessions should remain independently revocable.

Do not equate desktop browser login with unrestricted Android device pairing.

---

# PART 7 — Persistent cloud media

## 15. Replace local-disk assumptions

Inventory product photos, profile images, receipts, payment proofs and captured evidence must survive:

- API cold starts.
- New deployments.
- Browser refresh.
- Backend instance replacement.

Use the existing file-storage abstraction.

Add a staging cloud-storage implementation without breaking local disk use in development.

Preserve original files and thumbnails as appropriate.

## 16. Secure uploads

Vercel Functions have request-body limits, including 4.5 MB for a Function request.

Inspect current mobile photos and multipart upload sizes.

Use an authenticated, authorized direct-upload mechanism where necessary, with scoped short-lived upload grants.

Validate:

File type
Actual content
Maximum size
Ownership
Associated shop/branch
Associated product/customer/payment
Upload completion
Duplicate capture ID
Expired upload
Cancel/retry
Access permissions

Store metadata in PostgreSQL.

Never place private proof images into a publicly accessible store.

Ensure only authorized users can retrieve sensitive files.

## 17. Verify media persistence

Test:

Create product with image.

Refresh.

Open the same product from another device.

Update the image.

Verify thumbnail.

Download/read only with appropriate permission.

Test interrupted upload and retry.

Test a photo larger than the API's ordinary Function body limit through the approved upload flow.

---

# PART 8 — Real-time data and mobile compatibility

## 18. Cross-device updates

When a product is added or stock changes on one device, the other device must obtain the updated information without requiring an application restart.

Use the existing revision/synchronization architecture where suitable.

WebSocket functionality is optional for initial staging acceptance if equivalent reliable short-interval polling is implemented for the relevant business views.

The data itself must be authoritative.

WebSocket/polling failure must not invent stock, duplicate sales or mark a transaction as complete prematurely.

## 19. Device bridge separation

The existing physical phone camera bridge and PC counter pairing remain a separate integration.

Cloud hosting must not assume it can reach a private `192.168.x.x` counter address from Vercel.

Preserve the LAN bridge.

Clearly distinguish:

- Browser mobile sales over HTTPS.
- Android native scanner/camera.
- LAN counter pairing.
- Cloud authenticated sessions.

Do not claim online staging proves physical camera/QR pairing.

If a cloud-accessible photo-upload workflow is available through an authenticated mobile browser, verify it separately.

## 20. Mobile browser functionality

Open the hosted URL using a real mobile browser or an available device/browser test environment.

Verify:

- Login.
- Dashboard.
- Product search.
- Customer lookup.
- New Sale.
- Cart.
- Payment selection.
- Completion.
- Receipt preview.
- Receipt sharing/copy link.
- Profile.
- Logout.

Do not display the entire desktop sidebar squeezed onto the phone.

Preserve the existing mobile-specific React components.

If browser camera access is supported, use it securely under HTTPS.

Do not call an Android-native-only feature available in a mobile browser if the browser implementation is absent.

---

# PART 9 — Critical POS acceptance

## 21. Verify actual cross-device behavior

Use two isolated browser sessions or devices.

Device A: desktop.

Device B: mobile.

Both log into the same authorized staging shop.

Test:

**Product creation**

Create a product with category, price, cost, initial stock, rack location and photo.

Verify the product appears on the other device.

**Stock receiving**

Receive additional quantity.

Verify available stock increases once.

**Normal cash sale**

Sell one unit.

Verify stock decreases once, transaction is recorded and receipt is generated.

**Smart Custom Service**

Use `@` mention selection to link a real product.

Example:

Linked product selling allocation: PKR 2,000.

Combined customer charge: PKR 2,500.

Expected:

Product allocation: PKR 2,000.

Labor allocation: PKR 500.

Customer sees one line.

Stock decreases by one at completed checkout.

**Damaged return**

Return one item as damaged.

Available quantity must not increase.

Damaged quantity must increase.

**Sellable return**

Return a sellable item.

Available stock increases appropriately.

**Credit**

Make a credit sale.

Verify ledger, outstanding amount and due date.

Record a partial collection.

Verify balance and payment history.

**WhatsApp reminder**

Generate the correct message.

Copy Message should genuinely copy it.

Open WhatsApp should generate a valid prefilled manual message.

**Receipt**

View, print preview, download PDF and open a customer-safe virtual receipt.

A customer-safe receipt must not expose protected shop data.

## 22. Payment behavior

Do not confuse simulated/staging payments with real gateway confirmations.

For the demonstration, allow clearly identified test payment methods/records through the existing business operations.

Do not connect real merchant credentials unless explicitly approved.

Preserve payment-account selection, customer-display behavior and payment-proof handling.

---

# PART 10 — Security and data isolation

## 23. Protect the staging link

This must not be an anonymously writable public POS.

Require application authentication and appropriate authorization.

If demonstration visitors need access, create scoped staging accounts with known permissions and a secure credential-delivery method.

Avoid reusing live owner credentials.

Protect:

Purchase costs
Profit
Payment proofs
Customer phone numbers
Credit history
Stock adjustments
Financial reversals
Administrative settings

Enforce permissions in the API, not only the React UI.

## 24. Avoid unintended public exposure

Test:

- Anonymous access to protected API routes.
- Guessing product/media IDs.
- Accessing another shop/branch.
- Modifying a sale without permission.
- Downloading a private payment image.
- Reusing an expired receipt or upload token.
- Cross-origin requests.
- Rate-limit behavior.

Set noindex/noarchive appropriate to the staging site.

Configure response caching so private data is not served from shared public caches.

Remove diagnostic secrets from errors and logs.

---

# PART 11 — Stability, deployment and rollback

## 25. Background operations

Identify code that assumes a continuously running Node.js process.

Examples:

In-memory queues
Scheduled cleanup
WebSocket presence maps
Camera request expiry
Photo retry
Notifications
Background report processing

Move durable state to appropriate storage or use a suitable bounded job/cron architecture.

Use Vercel Cron only where the selected plan/environment supports the required cadence.

Do not depend on preview deployments running production cron jobs.

Do not introduce a paid Redis dependency if reliable polling is sufficient for this staging demonstration.

## 26. Backups and recovery

Configure the staging database's available backup/snapshot mechanism.

Document:

- Backup ownership.
- Retention.
- Restore steps.
- Database migration rollback strategy.
- Media backup/retention.
- Recovery from a failed release.

Actually verify restore using a separate disposable target if the provider permits it safely.

Do not destroy staging data just to test restore.

## 27. Deployment pipeline

Prepare repeatable Vercel builds from the existing repository.

Do not publish `.env` files, database dumps, private media, Android signing keys or local development credentials.

Preserve safe rollback capability.

Verify build artifacts, logs and health after deployment.

Document environment variables without revealing their values.

---

# PART 12 — Demonstration readiness

## 28. Create a presentation-ready staging shop

Use isolated, clearly labeled sample records.

Include representative:

Products
Mobile parts
Repair services
Stock locations
Customers
Credit accounts
Transactions
Returns
Damaged stock
Reports

Do not replace real customer data or import private customer records.

Provide enough connected sample history that the Dashboard, Sales & Profit graph, ledger, return history and reports can be demonstrated.

Sample data must be internally consistent.

Do not fake totals in frontend components.

Seed through validated backend/domain operations or a carefully tested staging seed process that maintains accounting invariants.

Provide a safe, staging-only reset mechanism if genuinely needed. Never expose it in production or grant it to demonstration visitors.

## 29. Make the application presentable

Keep approved branding and layouts.

Fix blocking UI problems only:

Blank pages
Missing icons
Broken product images
Unreadable dark mode
Overflowing mobile screens
Invisible buttons
Incorrect success states
Broken receipt previews
Broken links

Do not delay the hosting milestone by redesigning every module.

Add a discreet:

**STAGING / TEST DATA**

indicator.

Use professional demo content rather than randomly generated names or obviously artificial transactions.

## 30. End-to-end demonstrations

Run these user journeys using the actual HTTPS staging URL, not localhost:

**Journey A: Product to Sale**

Login → Products → Add Product → Receive Stock → New Sale → Cash Checkout → Receipt.

**Journey B: Customer Credit**

Customer → Credit Sale → Ledger → Partial Collection → Remaining Balance → Reminder.

**Journey C: Return**

Transactions → Select Invoice → Return Item → Damaged Stock → Inventory History.

**Journey D: Smart Service**

New Sale → `@Product` → Labor Allocation → Complete Sale → Inventory Deduction → Invoice.

**Journey E: Cross-device**

Create/update a record on desktop.

Read it on mobile.

Perform an authorized mutation on mobile.

Verify desktop reflects the change.

**Journey F: Persistence**

Complete a sale.

Close both browsers.

Reopen the domain.

Sign in again.

Verify products, sale, stock and customer history persist.

## 31. Performance and resilience

Measure:

Initial page load
Login
Dashboard fetch
Product search
Product save
Image upload
Checkout
Receipt generation
Mobile navigation

Fix significant delays where caused by unnecessary requests, server errors, stale caching or database connection problems.

Test:

Cold backend start
Browser refresh
Temporary network interruption
Two simultaneous sale requests
Failed upload/retry
Expired session
Duplicate checkout
New deployment followed by login

Do not invent load-test or reliability results.

---

# PART 13 — Perform the real deployment

## 32. Deployment execution

If the necessary approved Vercel account, project permissions, billing authorization and database/storage resources are available:

**Actually deploy the staging system.**

Do not stop after generating config files.

Deploy backend and frontend.

Run migrations.

Verify storage.

Test authentication.

Open the generated public HTTPS URL.

Execute the acceptance scenarios against it.

If unavoidable approval or credentials are missing, complete all independent preparation and testing, then report the exact missing prerequisite.

Do not bypass account permissions, purchase anything without approval, or claim a deployment happened when it did not.

## 33. Verify exact URLs

Report the actual addresses obtained from the successful deployment:

Frontend:
`https://<actual-deployed-domain>`

Backend health:
`https://<actual-api-domain>/api/v1/health`

These are placeholders, not URLs to invent.

Verify HTTP responses and page behavior.

Do not report a guessed Vercel domain as live.

---

# PART 14 — Reports and owner handoff

## 34. Create implementation report

Write:

`docs/PHASE6A_VERCEL_STAGING_IMPLEMENTATION.md`

Include:

1. Actual deployed architecture.
2. Frontend deployment result.
3. Backend deployment result.
4. Database provider and compatibility.
5. Applied migrations.
6. Private storage integration.
7. Authentication/security changes.
8. WebSocket/polling approach.
9. Data persistence verification.
10. Browser/mobile testing.
11. Financial/inventory integrity tests.
12. Receipt/media tests.
13. Performance findings.
14. Backup/restore status.
15. Plan and operating cost considerations.
16. Unresolved risks.
17. Actual URLs.
18. Screenshots/evidence.
19. Rollback procedure.

## 35. Create demonstration guide

Write:

`docs/PHASE6A_DEMO_GUIDE.md`

Make it understandable to a nontechnical customer.

Explain:

- Which link to open.
- How to sign in securely.
- How to show products.
- How to make a sample sale.
- How to view a customer's ledger.
- How to demonstrate an inventory return.
- How to demonstrate a mobile sale.
- How to view a receipt.
- What features are not yet production-ready.

Do not include private passwords or infrastructure secrets in the guide.

## 36. Final response format

Report these fields:

**Frontend:** Deployed / Not deployed

**Backend:** Deployed / Not deployed

**PostgreSQL:** Connected / Blocked

**Image Storage:** Working / Blocked

**Authentication:** Verified / Unverified

**Desktop Browser:** Verified / Unverified

**Mobile Browser:** Verified / Unverified

**Products & Inventory:** Verified / Unverified

**Checkout & Transactions:** Verified / Unverified

**Returns & Credit:** Verified / Unverified

**Smart Services:** Verified / Unverified

**Receipts:** Verified / Unverified

**Cross-device Data:** Verified / Unverified

**Persistence after restart:** Verified / Unverified

**Backup:** Verified / Unverified

**Security:** Reviewed / Outstanding

**Actual URL:** Exact verified deployment URL

**Tests:** Exact current pass/fail counts

**Remaining blockers:** Specific and honest

**Ready for customer demonstration:** YES / NO

**Ready for real daily commercial use:** YES / NO, with reasons

## Final rule

The main success criterion is:

**I can open a Taha POS staging link on a computer, open the same link on my mobile, sign in securely, and demonstrate real shared products, sales, stock, customer ledger, returns and receipts without relying on my personal computer.**

Do not substitute a local mock or an attractive but nonfunctional frontend for this outcome.

Start with the readiness audit, then implement the hosting changes, deploy when authorized, and verify the actual online system.

**BEGIN PHASE 6A NOW.**