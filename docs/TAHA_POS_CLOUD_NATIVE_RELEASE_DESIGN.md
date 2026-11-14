# Taha POS cloud and native release direction

Date: 14 November 2026. Owner's corrected deployment request supersedes the earlier downloads-only/manual-hosting scope. Preserve R3A/baselines and all saved data. Work branch: `codex/cloud-native-release`.

## Architecture and scope

One Hostinger Node.js Web App serves compiled React, custom NestJS `/api/v1` and public software downloads under one HTTPS origin. PostgreSQL and private originals/thumbnails remain external. Business changes propagate through authenticated HTTPS revision polling; software releases are separate versioned operations. The independent LAN Device Bridge is retained. No PHP backend, Supabase migration, MySQL conversion, UI redesign, paid resource creation or real-data staging copy.

Selected integration candidate: existing approved Neon Free staging PostgreSQL17 and private Neon Object Storage, subject to fresh provider verification. Both were actually provisioned/provider-tested in R2C; do not ask the owner to create duplicate resources without checking them. Hostinger's authenticated native window showed Node onboarding with selected temporary domain `maroon-louse-575853.hostingersite.com`; that is a **candidate origin**, not a deployed/verified API. Computer Use stopped on URL-confidence enforcement before account changes. No account interaction may bypass that block.

## Approaches

The owner explicitly selected full custom NestJS/PostgreSQL cloud plus bundled Windows/Android clients. A standalone download site is retained as an optional adapter, not the main product. Separate frontend/API sites are unnecessary unless Hostinger's actual runtime proves combined hosting unsuitable. A VPS or MySQL rewrite is outside scope. The owner authorized independent implementation immediately; no further design-approval round is inferred.

## Windows implementation boundary

Use GitHub `windows-2022` with its MSVC/Windows SDK and a pinned official Rust toolchain. Build a separately identified **staging** native app from bundled API-mode assets, including SQLite/DPAPI/native windows/splash. Preserve release HTTPS endpoint validation. A configured candidate URL must be clearly distinguished from cloud reachability. Do not install MSVC or SDK on the owner's computer.

Add the official Tauri updater Rust plugin, with public verification key only in source. Keep persistent staging private key/password recovery locally protected; never upload it to an unprotected CI environment. CI can compile unsigned Windows installers; locally sign and independently verify their Tauri update signatures. Authenticode is a separate certificate/billing/configuration gate and must not be falsely claimed. No installer release on ordinary pushes; validation artifacts are distinct from approved release publication.

## Release/public portal boundary

Keep Android13 and its signing identity. Extend the existing public Node/Nest download handler with Windows release metadata, checksums, instructions and a combined portal. Preserve existing Android paths/QR/manifests. Missing platforms/channels must show unavailable, not fabricated versions. Private business media and public software artifacts use separate keys/metadata; neither goes into source history. Durable release object storage and authenticated promotion must survive Hostinger redeployment. Publishing occurs only after actual file/hash/signature verification and explicit release approval.

## Verification and acceptance

Fresh status table distinguishes packaged local acceptance, actual cloud configuration, code gaps, external authorization and physical acceptance. Preserve current R3A CI failures/fixes rather than assuming pending runs passed. Use disposable local PostgreSQL/files and synthetic provider branches only. Do not alter saved port55439.

Check native compilation, signed artifact bytes, updater rejection cases, production-style API/SPA routes, private media, empty setup, financial persistence/idempotency/concurrency, revision catch-up, provider storage compatibility and backup/restore. Windows offline/reconnect and Android hardware tests remain explicit until exercised; Computer Use is currently unavailable for native UI acceptance in this turn.
