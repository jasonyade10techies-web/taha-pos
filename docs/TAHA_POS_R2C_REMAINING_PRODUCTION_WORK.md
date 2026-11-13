# R2C — remaining staging and production acceptance

Updated 13 November 2026. No cloud deployment or physical hardware pass is claimed. R2A counter corrections and R2B synchronization/readiness are preserved; this is not a new UI redesign.

## Required to finish hosted staging

| Priority | Work | Current evidence / acceptance needed |
|---|---|---|
| P1 | Verify actual Unlimited Node app allowance and target | Owner confirms plan/Web App upload. Official documentation lists Unlimited with five Node apps. Connector still points to a different inventory; remaining account slots, selected Node version, proxy and shared limits unverified. |
| P1 | Complete real PostgreSQL acceptance | Approved Free Neon project/database created; 69 migrations, actual TLS and SQL-restricted runtime verified. Create isolated acceptance branches; run real financial/concurrency/RLS/pooler workflows. |
| P1 | Complete private storage acceptance | Approved private Neon bucket created; real SDK privacy and exact-size POST checks 4/4 pass. Exact-origin browser CORS, completion/retry/thumbnail and hosted redeploy/object-backup acceptance remain. |
| P1 | Hostinger real deployment | New temporary HTTPS site only, secure environment, immutable package and logs. No DNS change or unrelated-site overwrite. Verify Node/Linux native dependencies and platform startup/restart, including the historical unexplained R2B cold-start timeout. |
| P1 | Hosted first-run and two-session acceptance | Re-run locally rehearsed owner initialization, wizard, first product/stock/sale/customer/credit/return, polling, auth renewal/revoke and outages on actual provider infrastructure. Local browser success is not cloud acceptance. |
| P1 | Interrupted authentication restoration | An immediate reload before restoration finished returned to Login in one retained rehearsal. Ordinary settled reload passes. Reproduce with isolated session/audit assertions and fix transport/lifecycle coordination safely if confirmed; do not relax strict token-replay enforcement. This remains an explicit hosted-acceptance gate. |
| P1 | Hosted backup and isolated restore | PostgreSQL plus private original/thumbnail backup, retention, integrity, recovery target and owner procedure. Never restore over the live shop during rehearsal. |

## Before daily shop production use

- **Android (P1, Medium/Large):** isolate corrupt photo-queue items without discarding valid captures; durable capture state across process death; build with shared polling updates, sign appropriately, verify actual phone camera/gallery/scanner/receipt/pairing/reconnect and cloud/LAN switching. Existing build 10 / `0.5D.2` is historical; R2C has not rebuilt an APK or certified the installed phone.
- **Windows (P1, Large):** verify/install the separately approved MSVC/SDK prerequisites, compile Tauri EXE/installer, and physically accept bundled launch, secure native session storage, SQLite cache/outbox/cash/receipt, stable invoice ID, conflicts and reconnect across restart. No existing browser preview is a native pass. No system software installation is part of this preparation.
- **Hardware (P1, Medium):** real 80mm printer and A4/PDF output, HID scanner, native second monitor, phone bridge and LAN without internet. Do not describe emulated mobile Chromium as native Android.
- **Repair accounting (P1 if used, Large):** material consumption, deposits, settlement, reversal/refund and ledger/profit integration remain a controlled accounting phase. Supported job creation/status changes are not proof that parts or money are posted. Unsafe unsupported advances must remain rejected. Do not collect repair money using an unaccepted shortcut.
- **Financial/operational release (P1, Medium):** production-role tests, distinct production data/resources/secrets, paid capacity/backup budget, account recovery/revocation, monitoring, incident/restore procedure and real payment-account confirmation. Expense-adjusted net profit remains separate from current gross-profit reporting.
- **Historical missing images (P1 where needed):** preserve metadata and truthful placeholders, inventory missing bytes with authorized read-only tools, recover only genuine originals from backups. Do not fabricate or delete history.
- **Production signing/update policy (P1, Medium):** owner-controlled signing material and secure recovery; no insecure auto-update or signing keys in source/release archives.

## Smallest next phase

Finish **R2C real-provider staging acceptance**, not another counter redesign: reuse the approved and created Free Neon resources, connect the correct Hostinger account, configure privately, migrate/init the isolated targets, upload the exact accepted package and verify the public HTTPS workflows. Stop if provider roles, POST policy, schema readiness or financial assertions fail. Native/hardware work can proceed independently after its prerequisites are approved; daily-shop release must wait for those applicable acceptance gates.

Do not copy the saved development database, real payment proofs or customer photos to any new service. Paid resources, production DNS and production launch require separate explicit authorization.
