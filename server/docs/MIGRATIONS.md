# PostgreSQL migration inventory

`0000_compatibility.sql` provides internal auth identity and private storage metadata functions required by the established SQL engine. These are database compatibility names, not dependencies on hosted Supabase. No Supabase SDK is installed in the server.

The 17 versioned scripts under `migrations/legacy/` are immutable copies of the previously validated business schema, security policies, stock, pricing approvals, atomic sales/payment/credit/return/test workflows and reports. Supabase camera migration `202610030014` is intentionally not imported; the server uses its own private device/camera/media architecture.

Custom backend migrations:

- `202610030100_custom_auth_and_counter_media.sql`: Argon2 account registry, hashed refresh sessions, login limits, paired devices, camera jobs, private media and push subscriptions, granular customer/media/camera/appearance permissions.
- `202610030101_custom_service_lines.sql`: atomic idempotent custom service lines, price floor, invoice snapshots, zero physical-stock effects.
- `202610030102_media_helpers.sql`: self profile photo update and audited media actions.
- `202610030103_team_repairs_shifts.sql`: product-linked service catalog, repair intake/status/technician validation, branch RLS, cash reconciliation and immutable closing.
- `202610030104_account_and_media_hardening.sql`: owner provisioning of staff identities, authorized management account setup, hidden one-sale service catalog rows, shared-counter media capabilities.
- `202610030105_media_ownership.sql`: immutable requester ownership and uploading phone identity.
- `202610030106_auth_audit_and_references.sql`: append-only auth lifecycle audit, safe referenced-file deletion denial.
- `202610030107_repair_photo_categories.sql`: aligned Before/After/Damage/Customer-provided photo metadata.
- `202610030108_appearance_and_catalog_delegation.sql`: permitted appearance update and explicit custom-service catalog creation grant.
- `202610030109_remote_customer_display.sql`: hashed expiring display capabilities, terminal/session pairing, safe snapshot persistence and connection heartbeats; no public business grants.
- `202610030110_appearance_administrator_access.sql`: settings managers may update the same validated appearance tokens.
- `202610050111_custom_service_coupon_preview.sql`: coupon previews use the established rules and server floor for ephemeral custom-service lines without writing inventory/catalog records.
- `202610050112_receipt_footer_defaults.sql`: updates only the shipped receipt footer and future store defaults; customized store footers and issued invoice snapshots are preserved.
- `202610060108_instant_camera_bridge.sql`: expiring QR handoff capabilities, optional device assignment, immutable target slots, bounded multi-photo sessions and private idempotent capture records.
- `202610060109_camera_diagnostic_audit.sql`: allowlists only the diagnostic image-cleanup audit action within the existing audited-media helper.

The runner serializes with a PostgreSQL advisory lock, records SHA-256 checksums and applies each migration/ledger record in one transaction. An altered applied migration is rejected; create a new version to change a deployed database. Runtime credentials are distinct from migration credentials and never get SUPERUSER or BYPASSRLS privileges.

No fake sales, customers, financial history, owners, password defaults or production PINs are seeded. Only the real store/branch and system permission/default-payment configuration are imported. Browser/integration fixtures are confined to separate localhost test databases.

## Phase 5A

- `202610080200_desktop_sync.sql`: commit-ordered per-store revisions, append-only offline import references and stable UUID invoices assigned inside the existing financial transaction engine.
- `202610080300_media_outbox.sql`: private idempotent cloud upload references for the durable desktop image outbox.
