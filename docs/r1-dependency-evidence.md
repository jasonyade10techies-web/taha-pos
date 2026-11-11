# R1 dependency evidence — 11 November 2026

The source dependency correction is limited to the frontend and backend manifests and lockfiles. The backup gate was confirmed by the coordinating agent before installation. No application or test source was changed for this dependency correction; install scripts were disabled and no major-version or forced update was used.

Evidence directory: `.test-postgres/r1-20261111/dependencies/`. Baseline reports: `.test-postgres/audit-20261111/frontend-dependency-audit.json` and `backend-dependency-audit.json`.

## Exact changes

| Package | Locked and installed before | Locked and installed after | Manifest change |
| --- | --- | --- | --- |
| Frontend `dompurify` | 3.4.16 | 3.4.17 | `^3.4.16` → `^3.4.17` |
| Backend `@nestjs/platform-express` | 11.2.7 | 11.2.9 | `^11.1.0` → `^11.2.9` |
| Backend `multer` | 2.4.0 | 2.5.0 | `^2.0.2` → `^2.5.0` |
| Backend `body-parser` | 2.3.0 | 2.4.0 | Transitive only |
| Backend `qs` | 6.16.0 | 6.17.1 | Transitive only |
| Backend `sanitize-html` | 2.18.0 | 2.18.1 | `^2.18.0` → `^2.18.1` |
| Backend `deepmerge` | 4.3.1 | Removed | Removed through `sanitize-html` update |

The other Nest packages remain at 11.2.7; platform-express 11.2.9 accepts core/common `^11.0.0`. Swagger and its existing js-yaml override remain unchanged. JSON comparison confirmed that only the root manifest entry and listed package entries changed in each lockfile. Installed versions match the corrected locks; `npm ls` exits successfully for both affected dependency trees.

`sanitize-html` 2.18.1 removes its `deepmerge` dependency, so no substitute or override is needed for the unpatched deepmerge advisory. Express's existing ranges accept body-parser 2.4.0 and qs 6.17.1. The Node runtime used was 22.23.1, satisfying sanitize-html's unchanged `>=22.12.0` requirement. Exact published package metadata and integrity values are saved in `registry-patched-metadata.json`.

## Findings and application reachability

Reachability here is based on source and installed dependency inspection. An advisory's published severity is not a claim that the deployed application was exploited.

| Finding | Application evidence | Correction / primary source |
| --- | --- | --- |
| DOMPurify template/shadow-root bypass, critical | `src/lib/description.ts` sanitizes strings into strings for the description editor and product display. No `SAFE_FOR_TEMPLATES`, DOM-returning mode, attached shadow input, or template engine use was found in this path. | 3.4.17; [GHSA-cg2g-xh64-v4q7](https://github.com/advisories/GHSA-cg2g-xh64-v4q7) |
| DOMPurify detached-subtree handlers with IN_PLACE hooks, high | No `IN_PLACE` or sanitizer hooks were found in application source. | 3.4.17; [GHSA-mrv2-3pqr-j5jr](https://github.com/advisories/GHSA-mrv2-3pqr-j5jr) |
| DOMPurify XHTML/SMIL guard bypass, low | No XHTML parser mode was found. The description allowlist excludes SVG/SMIL tags. | 3.4.17; [GHSA-c6gr-qvv4-5v3f](https://github.com/advisories/GHSA-c6gr-qvv4-5v3f) |
| body-parser compressed-body stream teardown, high | `server/src/main.ts` uses default Nest body parsing. The Express adapter installs JSON and extended URL-encoded parsers without disabling inflation. This is a matching request-processing surface; no network attack was performed. | 2.4.0; [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) |
| multer pending asynchronous fileFilter teardown, high; platform-express inherited finding | Authenticated media/camera upload routes use `FileInterceptor` with single-file and size limits. No asynchronous `fileFilter` was found, so the advisory's specific condition was not established. Nest's old adapter pinned multer 2.4.0; changing only the direct multer would leave that path vulnerable. | multer 2.5.0 and platform-express 11.2.9; [GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m) |
| sanitize-html discarded-iframe recursion, moderate | `sanitizeDescription` receives product HTML, permits up to 30,000 characters, and discards iframe tags. An isolated assertion against the actual function reproduced stack overflow with 16,000 characters before the update and passed afterward. This demonstrates a function-level failure, not a deployed-process exploit. | 2.18.1; [GHSA-c9rx-x947-fp3h](https://github.com/advisories/GHSA-c9rx-x947-fp3h) |
| deepmerge returned-object prototype poisoning, low | The only backend dependency parent was sanitize-html. Its deepmerge calls merge configured classes/styles; application sanitizer options are static, do not enable those attributes, and are not supplied by callers. No attacker-controlled object-merge path was established. | No published deepmerge patch; removal through sanitize-html 2.18.1. [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), [patched package metadata](https://registry.npmjs.org/sanitize-html/2.18.1) |
| qs comma-array stringify exception, moderate | Express/body-parser use `qs.parse`. No application `qs.stringify` call or comma-array serialization was found. | First patched 6.16.1; installed 6.17.1 within existing dependency ranges. [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw) |

## Commands and validation

Targeted installation commands, run in their respective project directories:

```powershell
# Frontend
npm install --ignore-scripts --no-audit --no-fund --save 'dompurify@^3.4.17'
# Backend
npm install --ignore-scripts --no-audit --no-fund --save '@nestjs/platform-express@^11.2.9' 'multer@^2.5.0' 'sanitize-html@^2.18.1'
npm update body-parser qs --ignore-scripts --no-audit --no-fund
```

| Check | Result | Evidence file |
| --- | --- | --- |
| Frontend `npm audit --omit=dev --json` | Exit 0; zero package findings, previously one critical package finding | `frontend-audit-after.json` |
| Backend `npm audit --omit=dev --json` | Exit 0; zero package findings, previously six (three high, two moderate, one low) | `backend-audit-after.json` |
| Frontend/backend affected dependency trees | Both exit 0 | `frontend-tree-after.json`, `backend-tree-after.json` |
| Frontend typecheck | Exit 0 | `frontend-typecheck.log` |
| Frontend lint | Exit 0 | `frontend-lint.log` |
| Frontend build | Exit 0 | `frontend-build.log` |
| Backend typecheck, initial concurrent media recovery | Exit 2: media controller called read with five arguments while recovery signature accepted two to four | `backend-typecheck.log` |
| Backend typecheck after media recovery | Exit 0 | `backend-typecheck-after-recovery.log` |
| Backend lint | Exit 0 | `backend-lint.log` |
| Backend build | Exit 0 | `backend-build.log` |
| Existing product-hardening tests | 9 passed, 0 failed | `product-hardening.log` |
| Client credential boundary | Exit 0 | `client-boundary.log` |
| Malformed iframe sanitizer assertion | Before: expected assertion failure from stack overflow; after: exit 0 | `sanitizer-regression-red.log`, `sanitizer-regression-green.log` |

The isolated sanitizer assertion was run in `server/` before and after the update:

```powershell
node --import tsx -e 'const assert=require("node:assert/strict");const {sanitizeDescription}=require("./src/business/product-content.ts");assert.doesNotThrow(()=>sanitizeDescription("<iframe>".repeat(2000)),"sanitizer must handle bounded malformed iframe HTML without stack overflow");console.log("sanitizer malformed iframe regression passed");'
```

These checks cover this dependency correction. The coordinating agent owns the complete post-freeze regression run, media recovery, and release packaging. Existing installers, APKs, and `artifacts/managed/taha-api-0.5.0` are not evidence of an updated deployment; release packages must be regenerated from the corrected locks before distribution. No deployment was performed by this task.
