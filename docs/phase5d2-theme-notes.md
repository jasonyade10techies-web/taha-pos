# Phase 5D.2 neutral theme evidence

Scope: owner brief section 2 and plan Task 4, retaining the approved Dashboard, POS/cart, product gallery, customer workspace and coded Taha logo. No financial records, dependencies, service editor, backend authentication or Git metadata were changed by this work.

The light tokens are background `#F3F3F3`, card `#FFFFFF`, soft/raised `#F8F8F8`, border `#E2E2E2`, text `#202020`, secondary/muted `#626262`, charcoal sidebar `#202020`. Dark tokens are background `#181818`, sidebar `#141414`, card `#262626`, soft/raised `#303030`, border `#414141`, text `#F2F2F2`, secondary/muted `#C5C5C5`. Primary gold is `#F2BC2D` in both.

Semantic tokens cover hover, focus, selected, disabled, warning, error, success, overlay, tooltip, chart lines/grid and sidebar states. The logo retains `#E53935` as `--brand-red`; small red text uses `#C62828` light and `#F87171` dark for contrast. The sidebar's selected gold text has its own dark gold-tinted background in both themes. Chart sales use darker gold on white and bright gold on dark cards. Neutral surfaces replace navy drawer, overlay, avatar, thumbnail, startup and theme-preview colors. The staff shell inherits the bundled Manrope font like the desktop.

The exact previous shipped appearance defaults upgrade to the new gold. Deliberately customized colors/fonts remain preserved. Thermal and A4 paper retain local light tokens, white backgrounds and dark neutral text irrespective of app theme, including print media.

## Verification

Harness: `playwright.phase5d2-theme.config.ts`, isolated local demo port 1475, mock auth, bundled-mobile false, unavailable API target 39999 and the existing cold-module global setup. Staff-shell checks use the deterministic authenticated `staffUi` API fixture; they do not demonstrate a real phone connection.

Command (with bundled Node directory on PATH):

```powershell
node node_modules/@playwright/test/cli.js test --config playwright.phase5d2-theme.config.ts
```

Tests were written and run against the old palette first: exact token assertions failed on the old navy/blue-gray colors and paper text. Additional visual inspection reproduced the light selected-sidebar contrast defect and small red-text contrast of 3.81:1; these received browser assertions before correction. The checks require at least 4.5:1 for normal semantic text and at least 3:1 for focus and chart lines, and exercise actual primary/disabled/hover/overlay components.

Final theme run: **11 passed, 0 failed, exit 0 (6.8 minutes)**. This includes exact light/dark palette and semantic contrast/component states, 80mm/A4 screen/print paper, default-appearance migration, two dedicated staff viewport tests, and six same-page viewport matrix tests. Intermediate test-only failures were corrected for the actual demo basket state, CSS transition settling, browser alpha serialization and browser-path versus bundled hash routing; expected behavior assertions were retained. Scoped ESLint exited 0 for changed TS/TSX/config/test files. Products toolbar follow-up verification is recorded separately below.

Screenshots: `docs/screenshots/phase5d2-theme/`, 76 PNGs before the bounded Products toolbar follow-up: Dashboard, POS, Products, customer and Settings in both themes at 1920×1080, 1440×900, 1366×768, 1024×768, 390×844 and 412×915; dedicated staff home/products/profile in both themes at 390 and 412; thermal and A4 paper in both themes.

Inspected through `view_image`: Dashboard light/dark, desktop POS light, mobile POS dark, Products light, customer light, Settings dark, dedicated staff home light/dark and 80mm paper dark. The neutral palette is readable and page structure is preserved. Visual inspection also identified existing expanded Products filters and stretched Settings cards; the Products toolbar has a separately authorized bounded follow-up.

## Boundaries

Browser screenshots/print media checks are automated desktop/mobile viewport evidence, not physical Android display, camera, printer or Windows native acceptance. Android resource palette and scanner guide colors were updated; native host lifecycle/system-bar behavior still requires physical inspection. Native MainActivity background edits are coordinated with the device agent. No APK build/signature/hardware claims are made here.

Full project typecheck was attempted during concurrent integration and reported unrelated in-progress errors in root-owned mobile-service `setName` and accounting test line typing; both were sent to root. Scoped lint and final full typecheck/suite outcomes remain subject to integration verification.

## Final integration addendum — 22 October 2026

Products toolbar follow-up is implemented in `src/features/inventory/product-toolbar.css` and `products-page.tsx`. The final rerun of `tests/phase5d2-toolbar.spec.ts` passed1/1 in23.2seconds with all six widths/both themes; log `.test-postgres/phase5d2-20261022/toolbar-final.log`. Twelve toolbar screenshots bring this directory to88PNGs. Root re-inspected Dashboard dark and Products light at1366. The full frontend lint, typecheck and production build subsequently exited0; in-progress errors above were corrected. Theme implementation does not imply physical Android/native Windows acceptance. Final delivery and limits are in `PHASE5D2_REVISED_IMPLEMENTATION.md`.
