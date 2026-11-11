# R1 MediaService recovery evidence

Recovery search and subsequent authorized reconstruction performed on 11 November 2026. The initial search was read-only except this report. After root verified the forensic source copy and full source/configuration snapshot, the agent reconstructed `server/src/media/media.service.ts`, added `server/test/media-recovery.test.ts`, ran builds and focused tests, and retained the focused test log under `.test-postgres/r1-20261111`. The owner database on port55439 was not accessed. Root separately handles owner-data preservation and the full regression suite. All filesystem timestamps below are UTC and are evidence of filesystem metadata, not proof of when corruption happened or its cause.

## Finding

No intact same-generation complete service was found in the targeted locations. The trustworthy complete baseline is the 8 October managed artifact. Its source and compiled files match the corresponding ZIP entries byte for byte. The 29 October Phase6A temporary fragment and three patch scripts retain substantial newer behavior, but do not by themselves provide every change made since 8 October. Recovery should be described as reconstruction against retained contracts unless a later intact source is found.

The damaged source is 33,538 bytes, modified `2026-10-29T10:27:18.6428111Z`, SHA256 `5B7ED60BE63DDB4BC05B5D90E86A62CC0E066093526D90A958B9AD6A902EBF3C`. This search did not attribute its corruption to a person or tool.

## Candidate manifest

Paths in this table are relative to `D:\Inventory system POS`.

| Path | Bytes | Last modified UTC | SHA256 |
|---|---:|---|---|
| `artifacts\managed\taha-api-0.5.0\src\media\media.service.ts` | 22176 | 2026-10-08T13:06:55.6603885Z | `88C51B5F067A0F3FEF075FF4FA9D4980FEC991367F0B0DF7CBF51DC15A76F89A` |
| `artifacts\managed\taha-api-0.5.0\dist\media\media.service.js` | 28128 | 2026-10-08T14:04:06.2565816Z | `6A25559663A9ACDC746BEDC3A5AB0B56CB557C0191D7AF6FC955D32E5FB3BF39` |
| `artifacts\managed\taha-api-0.5.0\dist\media\media.service.js.map` | 27443 | 2026-10-08T14:04:06.2565816Z | `E280FFE50DD7DB3CBB1A0CF8226B272E93D86865057D8A1DBB46DF671E6F5C1A` |
| `artifacts\managed\Taha-API-managed-0.5.0.zip` | 399053 | 2026-10-08T14:04:16.6309635Z | `B138D070C150D766F9675423C2C79CD4528A8F7BC98D41CBDCD6DC5B44B16B28` |
| `.test-postgres\phase6a-20261029\media-grant-methods.tmp` | 9300 | 2026-10-29T10:16:28.3099448Z | `CD222DB32A2FBCF2154047CC8EA64ABA8768E2D0D7E8A05C1937E30A71225C4B` |
| `.test-postgres\phase6a-20261029\refactor-media.py` | 4644 | 2026-10-29T10:22:12.9970229Z | `D46BDB5CC4321AD93E315667AF1365140ECDEDB587E1484C1B2611CDB341F544` |
| `.test-postgres\phase6a-20261029\fix-media.py` | 1417 | 2026-10-29T10:22:53.0429224Z | `6087A34BAE82F1CF6A1CF3E98012943DFA1B0F77F3504BBF22F731E37FD8FFC5` |
| `.test-postgres\phase6a-20261029\fix-media-drafts.py` | 1448 | 2026-10-29T10:27:17.1648492Z | `D081576ED7D98AE8FD817531EC30B40A2BFDC890B3FFF97FFA69CCBEAF3CEEDB` |
| `server\dist\media\media.service.js` | 55 | 2026-11-11T07:54:18.2130043Z | `89E5A07843A7613770A36628B01080324CF1397AF2FAB78CA60313B7069A345E` |
| `server\dist\media\media.service.js.map` | 127 | 2026-11-11T07:54:18.2130043Z | `70889802EA38E57916409400FA9BD6A4F28BE2ED73F8A290955402D49E4897AE` |

The ZIP members `src/media/media.service.ts`, `dist/media/media.service.js` and `dist/media/media.service.js.map` have the exact hashes/sizes of the expanded managed files above. ZIP timestamp resolution differs, as expected. The managed map references `../../src/media/media.service.ts` but has no `sourcesContent`. The fresh current map contains empty mappings and also no source text. Current compiled output therefore cannot recover the missing implementation.

## Retained contracts and reconstruction gaps

The managed baseline has the same six constructor dependencies, in order: `Database`, `LocalFileStorage`, `AuthService`, `CameraService`, `Configuration`, `CounterGateway`. It provides `upload`, `capture`, `removeDiagnostic`, `urls`, `read`, `crop`, `list`, `metadata`, `remove`, `avatar`, and `audit`, plus permission/capability helpers. Preserve these entry points because current media, camera, and business controllers call them directly.

Current `media.controller.ts` additionally requires:

- `createGrant(actor, store, body)` where body includes `uploadId`, `kind`, `mimeType`, `size`, `sha256`, optional `entityId`, `staged`, `cameraJobId`.
- `completeGrant(actor, store, grantId)` and `cancelGrant(actor, store, grantId)`.
- `read(id, token, thumbnail, original, secureTransport)`; the old baseline has only four arguments.

The saved `.tmp` contains `directActor`, `grantScope` and all three grant methods. It authorizes before exposing direct S3 upload fields; refuses companion sessions before database/storage use; rejects attempts to use direct grants for camera jobs; binds grant ownership to store/profile; validates exact MIME/size/SHA256; uses durable grant rows and `media_uploads` results; checks cancellation/expiry; verifies original bytes through `readBounded` plus Sharp; finalizes immutable processed/original/thumbnail objects; reuses completed results; and removes staging bytes after successful finalization. Its shape matches `server/migrations/202610290100_cloud_uploads.sql` and `LocalFileStorage.directUpload/readBounded`.

Do not restore the `.tmp` unchanged. Retained later corrections are material:

1. `refactor-media.py` extracts `persistImage` so upload-idempotency, direct completion and camera capture persist images using their existing transaction connection. Authorization/context work occurs before reserving that connection, and audit logging occurs after release. The current cloud-media fixture deliberately starts with pool size 1 and later tests concurrent completion with pool size 2; nested database operations can exhaust these pools.
2. `fix-media.py` moves idempotent upload audit work outside transaction-failure cleanup, and enforces the 16 MiB limit on both advertised file size and actual `file.buffer.length` inside image persistence. This distinction prevents an audit failure from deleting files after the metadata transaction committed.
3. `fix-media-drafts.py` returns a verified `attachmentId`. Missing/foreign records remain unbound rather than causing direct draft upload rejection. Device attachments resolve against `purchased_devices`, not `products`. Staged product uploads remain unbound. Completion must use the verified attachment ID.
4. The saved grant fragment locks per upload request ID, but its quota query counts all pending/recent grants per store/profile. Different request IDs can race through that count. Current test `parallel grants enforce outstanding quota and concurrent completion creates one image` deliberately delays inserts and requires eight successes plus one HTTP429 from nine parallel requests. A common store/profile lock around count-and-insert is required by this retained test; the historical concurrency-green log confirms a later change existed, but that exact change is not in the fragment/scripts.
5. Current companion policy is more recent than the baseline: protected camera sessions cannot gain general media access. `cloud-media-scope.test.ts` verifies the three direct grant entry points reject a companion before touching database/storage. `device-enrollment.test.ts` verifies a companion capture image URL uses HTTPS, the corresponding HTTP read returns403, and TLS read succeeds. The fifth `read` argument is actual socket encryption from the controller, consistent with `auth/companion-policy.ts`; forwarded headers are insufficient. Current `CameraService.safe` already selects `TAHA_LAN_TLS_ORIGIN` for companion image URLs. Preserve equivalent behavior in MediaService capability URLs/reads and retain camera-job authorization for companion reads.

Baseline functionality worth preserving includes server-side image processing, 50-million-input-pixel cap, original bytes and thumbnails, output-size cap, request/capture idempotency hashes, signed media audience/issuer/session/profile capability, live session authentication on reads, ownership/permission filtering, crop derivatives, primary/order metadata, and financial/camera/reference deletion protections. Do not substitute upload stubs or remove retained tests.

## Historical logs: evidence limits

| Path under `.test-postgres\phase6a-20261029` | Bytes | Modified UTC | SHA256 |
|---|---:|---|---|
| `media-concurrency-green.log` | 28138 | 2026-10-29T10:20:20.9801592Z | `1987D13133702294B470121ACAE47567EFF8BB71F45FB58E3D4D2050A0F7917F` |
| `media-smallpool-red.log` | 29127 | 2026-10-29T10:21:44.5731243Z | `677005B1C531178474A5D609EADC493092B975DA7088A9ACB9B94727833C7746` |
| `media-all-green.log` | 30761 | 2026-10-29T10:23:40.1382158Z | `45C38AFAAA71C3028AB38CA6E1237309806CE360CEC95259CD0E691E4BD644BB` |
| `media-scope-green.log` | 368 | 2026-10-29T10:16:50.4011106Z | `1F85110BF3D08D6D141D4CE39EF832E5E6367FD1DF4BE62031B43EF195D11ACD` |
| `media-final.log` | 78778 | 2026-10-29T10:27:18.9373981Z | `8BBA2E555E88E9672BB9C0E66436FFEB0BECA07B9F6DB832B3F62CC473DDDDB0` |

`media-all-green.log` has a TAP summary of 11 tests, 11 pass, 0 fail, and predates the final draft fix. `media-final.log` shows tests1–7 passing, including the newly added missing/foreign-draft test, but has no final TAP summary in the retained file. Treat both as historical evidence only. Fresh isolated verification is required after reconstruction: typecheck/lint/build; media scope/direct/provider-contract/local idempotency; enrollment/companion TLS; camera capture; permission and finance evidence protections; current wider backend regressions. These historical logs do not prove actual S3 provider or production acceptance.

## Targeted search coverage

- Repository source/artifacts/server build files and media-named backups/temp/patch files, excluding dependency directories and PostgreSQL binaries/data.
- Phase/audit `.test-postgres` source/script/temp/backup files, including all five Phase6A Python/tmp files. No newer complete service was present.
- VSCode `C:\Users\hassa\AppData\Roaming\Code\User\History`: only two `entries.json` indexes existed and neither referenced this project or service. `Code\Backups` contained no backup files. No matching project `workspace.json` entry was found in `workspaceStorage`.
- Top-level project/snapshot/archive names on `D:\`, and relevant names in Downloads, Desktop, Documents, OneDrive and `D:\D Download`. No relevant newer project archive/snapshot was found. The unrelated older archives were not opened.
- Codex temporary-directory inventories only: these showed plugin/launcher directories, not a source recovery candidate. No conversation/session logs, credential stores, databases, or unrelated private content were searched.

The initial discovery was intentionally bounded, not an exhaustive disk scan. It performed no Git reset, deletion, deployment, database mutation, or application-source edit.

## Authorized reconstruction and fresh focused verification

Root confirmed a byte/hash-verified forensic copy at `D:\Taha-Private-Recovery\R1-20261111-1336\media.service.ts.corrupt`, plus a verified full source/configuration/artifact snapshot, before source replacement. The reconstruction command independently checked that the forensic copy and damaged source both matched the original corruption SHA256.

The reconstructed implementation was assembled from the managed source and saved grant fragment, followed by the retained `refactor-media.py`, `fix-media.py` and `fix-media-drafts.py` corrections. Additional reconstructed behavior was derived from the present controller/security/test contracts: a profile-wide PostgreSQL advisory quota lock, socket-TLS-aware companion reads, camera-only companion media authorization, companion HTTPS URL origin, and early actual-byte bounds/internal multipart scope rejection. `HttpException(...,429)` implements the saved fragment's rate limit without importing a nonexistent Nest `TooManyRequestsException`. No explicit `any` types were added to the service and no controller/storage/migration/package/configuration/launcher files were edited by this agent.

At handoff, reconstructed `server/src/media/media.service.ts` is **34,082 bytes**, SHA256 **`B5DB3723B534C0E00371A0F0D15A8289B20A12D58E0BCDB61622DC8D2B6C0D3F`**. This is a tested reconstruction, not a claim of byte-identical recovery of the lost 29 October source.

Before replacement, current `cloud-media-scope.test.ts` failed with esbuild `Unexpected "\x00"`; backend typecheck and managed build failed with TS1127 invalid-character errors. The three new recovery tests were also run before replacement and failed on the same corrupted import.

Fresh post-reconstruction checks completed successfully:

- `npm run typecheck`: exit0.
- `npx eslint src/media/media.service.ts test/media-recovery.test.ts`: exit0.
- `npm run build`: exit0; managed Node package generated.
- `npx tsx --test --test-concurrency=1 test/cloud-media-scope.test.ts test/media-recovery.test.ts`: **4 tests, 4 pass, 0 fail**. The new tests exercise actual-byte overflow despite a small advertised size, an HTTP companion capability read, and internal companion general multipart upload rejection.
- `tsx --test --test-concurrency=1 test/cloud-media.test.ts test/device-enrollment.test.ts test/integration.test.ts`: **35 tests, 35 pass, 0 fail**, using only root-started isolated PostgreSQL on `127.0.0.1:55459`. Log: `.test-postgres\r1-20261111\media-recovery-focused.log`. This includes direct-upload exact content/private retrieval/restart/idempotency, quota concurrency, concurrent completion, missing/foreign draft isolation, companion TLS/read scope/session revocation, local multipart/camera and gallery/crop operations.

Root owns the wider regression run after the source freeze. Focused provider-contract tests use the retained independent HTTP S3 fixture, not a real hosted bucket. No production deployment or live-provider acceptance is claimed.
