# Hostinger compiled ZIP lockfile correction — 2026-11-16

Release `0.5.0-r3a.4` failed on Hostinger after a successful `npm install`:
`Release verification failed: package-lock.json`. The supplied build log confirms
Node 22, NestJS, root `./`, entry `main.js`, and `npm run build`.

The failure was reproduced locally. npm normalized the copied server lockfile,
removed 146 development-only entries and root metadata, and changed its raw hash.
No runtime version, download source or integrity pin changed. Earlier acceptance
used `npm ci`, so it did not exercise Hostinger's install behavior.

Release `0.5.0-r3a.5` normalizes the production lockfile before packaging and keeps
a separate immutable `release-lock.json`. The verifier permits installer metadata
normalization and omitted development/platform-optional entries, but rejects
changed runtime versions, sources, integrity hashes, links, unexpected packages,
missing required packages and changed root dependencies. Application files,
migrations and the approved dependency snapshot retain strict byte/hash checks.
The package acceptance runner now uses `npm install --omit=dev` in production mode.

No business logic, shop records, credentials or owner login were changed.
The previous ZIP must not be retried. Upload the new version as a new deployment.

Settings: Node 22.x (minimum 22.13), NestJS, root `.`, build `npm run build`, entry
`main.js`, start `npm start`. Where editable, leave static output/publish directory
blank: the entire server package is needed, including `public/` and `dist/`.
Keep the existing private environment configuration. Do not upgrade npm globally
or move TypeScript/Vite into runtime dependencies for this compiled package.

Verification evidence is retained under `.test-postgres/hostinger-zip-20261116/`.
Passing local/CI acceptance does not establish successful Hostinger deployment,
trusted proxy configuration or physical Windows/Android acceptance.
