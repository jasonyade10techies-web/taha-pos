# R3A local Graphify and Claude handoff

## What was actually done

Initial bounded inspection found no Graphify executable, installed distribution or configured Graphify MCP. A similarly named tool was not treated as an installation. The verified upstream [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) uses the `v8` default branch and PyPI distribution **graphifyy0.9.108**; its older main branch is not the release authority.

The wheel SHA256 was verified against PyPI metadata:
`71a0011e13135091bf71d9c58e93f12dbe219821ea366600129132f1c5a8fe9c`.

An isolated environment was installed under `.tools/graphify-r3a-venv` on driveD.31 pinned wheel packages were resolved, recorded and installed using `--only-binary=:all: --require-hashes --no-compile`. Installation logs, metadata, wheel and lock are in `.tools/graphify-r3a-review/`. No system Python, package versions, MCP configuration, AGENTS.md or CLAUDE.md was changed. No assistant hooks were installed.

Indexing used a sanitized mirror of tracked/new source under these explicit prefixes: `src/`, `server/src/`, `server/migrations/`, `mobile/android/app/src/main/`, `src-tauri/src/`, `distribution/`; only TS/TSX/Java/Rust/MJS/SQL/CSS extensions. No environment files, reports, credentials, images, APKs, databases, customer data, node_modules or private archives were included. The mirror contained482 files at indexing time.

The process received a minimal environment without API keys. A Python audit hook blocked socket connection and name-resolution operations. Invocation: isolated Python `-m graphify extract <mirror> --code-only --no-cluster --no-dedup --out <local-output>`. No hosted model, embeddings, semantic extraction, paid API or network workspace was used.

## Results and limitations

Fresh local extraction exited0:450 code files,0 docs/papers/images; **2,774 nodes and11,912 edges**.32 CSS files were not classified.69 SQL files contributed no graph nodes because the optional SQL grammar was absent. One generated TypeScript database-type file had a parser warning/partial extraction, and five entry/side-effect files yielded no symbols. These are graph limitations, not proof that TypeScript or PostgreSQL is broken. SQL financial relationships still require migration/function inspection and actual database tests.

Local graph: `.test-postgres/r3a-20261114/graph/graphify-out/graph.json`.

Supporting evidence: `graphify.log`, `graph-input-manifest.json`, `graph-summary.json`, `graph-offline-guard/sitecustomize.py` under `.test-postgres/r3a-20261114/`. These are ignored local evidence, not source or deployment assets. Source changed further during integration, so regenerate from the same allowlist for an exact final-commit graph.

High-degree AST/import hubs included:

| Hub | Degree | Source |
|---|---:|---|
| Button |209| `src/components/ui/button.tsx` |
| AuthRequest |161| `server/src/auth/auth.guard.ts` |
| useSessionStore |120| `src/stores/session-store.ts` |
| Dialog |119| `src/components/ui/dialog.tsx` |
| Actor |108| `server/src/database/database.service.ts` |
| Desktop route root |108| `src/app/app.tsx` |
| Repository hook |108| `src/hooks/use-repository.ts` |

Degree is syntactic connectivity, not business importance or a proof of correctness. Imported third-party references also form hubs. Review primitives/auth/repositories carefully because their changes affect many workflows.

## Code navigation guide

- Browser routing/layout → `src/app/app.tsx` and layout components; dedicated mobile → `src/app/mobile-app.tsx`, mobile routes/root and native bundled entry.
- Authentication/permissions → `server/src/auth/`, `src/lib/api/client.ts`, session store and route guards. A hidden control is not server authorization.
- Checkout/inventory → POS features/cart, API repositories, `server/src/transactions/`/inventory services and actual PostgreSQL migrations/functions. Use SQL tests for atomicity/concurrency.
- Media → frontend gallery/capture, device bridge, `server/src/media/media.service.ts`, storage abstraction and private authorization. The recovered MediaService remains protected.
- Android → `MainActivity`, `ShopBridge`, `ScannerActivity`, `PendingPhotos`, `OriginalCaptures`, `AppUpdater`/`UpdatePolicy` and mobile React routes.
- Windows/offline → `src-tauri/`, desktop SQLite/repository/outbox/sync code. Native toolchain/hardware gates remain separate.

Claude Code can use the local graph JSON and source paths without a new MCP integration. Do not upload it to a hosted workspace by default. It contains code structure and must remain private. No Claude Design/Code source review or design synchronization is claimed. The actual audit/proposal brief is `docs/CLAUDE_DESIGN_TAHA_POS_HANDOFF.md`.
