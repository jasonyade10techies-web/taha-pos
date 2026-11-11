# Phase 5D shared controls and navigation

Scope: shared controls, global quick search, sidebar/header/profile navigation, settings discoverability and accessibility. Source inspection began before edits. The approved branding, Manrope default, page layouts and installed dependency versions are preserved.

## Confirmed findings and repairs

- **P2 — Global search was page-only.** `src/components/navigation/command-menu.tsx` originally filtered only page labels/descriptions. It did not find products, customers, invoices, services or stock locations despite the header saying “Search anything”. The existing palette now has grouped authorized records, a 200 ms debounce, four results per record group and eight page results. Product matching reuses the existing local fuzzy/Roman Urdu matcher. Customer names/phones and service/location text use the existing Fuse dependency. Receipt search uses the existing paged repository search and does not silently select a receipt. Each result opens its specific existing record screen.
- **P2 — Navigation offered forbidden pages.** The original sidebar and command palette enumerated every navigation entry while route guards rejected unauthorized destinations. Sidebar groups and page results now use `canOpenRoute`; empty groups disappear. Header workspace settings and notification destinations are also checked.
- **P2 — Repeated profile actions stopped reopening.** The header navigates to `/profile#devices` and `/profile#password`. The original profile effect only ran when the hash changed; closing the dialog left the hash present, so selecting the same header action again did not reopen it. Dialog close now clears its corresponding hash. The password deep link also respects the individual-sign-in requirement in a shared terminal session.
- **P2 — Notification actions lacked keyboard menu semantics.** `src/components/layout/header.tsx` originally rendered navigation actions as raw buttons inside a Radix menu. Radix registers Menu.Item nodes for roving focus and prevents Tab within the menu, so keyboard users could reach “Mark all as read” but not the raw action buttons. Actions now use the existing DropdownItem component, close after selection, and their notification content has a viewport-bounded scrolling wrapper.

## Search interfaces and limits

Implementation: `src/components/navigation/workspace-search.ts`; presentation remains in the existing `command-menu.tsx`.

- Reads only existing repository projections: `products.pos`, `customers.list`, `sales.page`, `services.list`, `locations.list`.
- Cached reads are scoped by data provider, profile, store and current permission set. Receipt reads remain search-specific and paginated. A source failure leaves other groups and page navigation available and provides Retry search.
- Results use product `/products/:id`, customer `/customers/:id`, receipt `/transactions/:id`, service `/services/:id/edit`, location `/locations/:id`.
- Each group requires permission for its existing destination. Sales-only cashiers continue using the existing New Sale product search because they cannot open inventory product records; the palette does not link them to a forbidden detail screen. Receipt search requires sales-history access; return-only receipt lookup remains in Returns.
- Product/customer/service/location completeness is bounded by the existing list projections. In particular, the API customer repository currently reads at most 250 customers. No new backend search endpoint or paid AI was introduced.
- Search results do not display purchase cost, profit, payment-proof media or internal financial line data. Customer outstanding is shown only with the existing credit-reading grants and when supplied by the projection.

## Further shared-control observations

- `AppSelect` already portals its popup, constrains its height, supports Radix keyboard/outside-click behavior and uses shared theme colors. `Field` already labels its visible trigger correctly. Native `<select>` elements are intentional hidden form/automation mirrors, rather than visible native dropdowns.
- **P2 repaired:** direct POS price/reason, remaining-payment, approval, stock-adjustment, counter-mode and tax labels now label the visible custom trigger through `Field` or its explicit trigger ID. Label activation, keyboard opening and Escape are covered by the product/control regression. AppSelect options still use menu-item semantics with a visual selection check; a broader selection-role refinement remains a later accessibility improvement.
- **P2 repaired:** `AppCheckbox` now supports native and visual indeterminate state. The product bulk selector uses it for partial selection. Keyboard toggling and real row selection are covered; shared `DataTable` also prevents interactive child clicks from navigating the row.
- Dialogs use Radix trapping/scroll lock and depth-aware stacking; shared scroll frames already bound content to the viewport. Sidebar content already uses a dedicated scroll area. Reduced-motion CSS and `MotionConfig reducedMotion="user"` exist.
- Settings already gates sections and keeps backend overrides owner-only under the Windows Application advanced block. The long technical-first section list could be grouped more clearly, but it is a discoverability refinement rather than a dead daily workflow. Website publishing, branch expansion and native/hardware functions remain explicitly deferred; they were not reimplemented.

## Evidence

Focused fixture configuration: `.test-postgres/phase5d-controls/playwright.config.ts`, port 1442, separate browser contexts and local seeded data; no owner records mutated.

Initial red run: `.test-postgres/phase5d-controls/controls-red.log`. Four failures and one intentional API skip. Two failures reached the real UI (repeated Devices action; notification menu semantics). The first two cases failed during cold startup under concurrent disk/process load and are **not** evidence that their intended assertions ran. Source inspection establishes the page-only and permission-filtering gaps; later green tests must verify repaired behavior.

Targeted verification: seven local cases passed and one API-only case skipped in `controls-local-final.log` (37.7s); a separate API-shaped password-action case passed in `controls-api-green.log` (10.5s; six local cases skipped in that earlier seven-case collection). Product/shared-control regression: four passed in `.test-postgres/phase5d-20261016/product-controls-final.log` (22.8s). The main acceptance report records the subsequent broad suite and actual PostgreSQL journeys separately. No native/physical acceptance is implied.
