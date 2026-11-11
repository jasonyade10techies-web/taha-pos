# Recovered local source baseline

The existing Taha POS checkout at `D:\Inventory system POS` contained no Git metadata when inspected on 11 November 2026. A new **local-only** repository is being established for Phase R1. Its initial commit is a snapshot of the recovered project; it does not restore or imply any earlier commit history.

MediaService was reconstructed from the verified 8 October managed source, surviving 29 October grant/refactor/draft patches, current controllers/storage/migrations and regression contracts. The corrupted 33,538-byte file was preserved byte-for-byte before replacement, SHA256 `5B7ED60BE63DDB4BC05B5D90E86A62CC0E066093526D90A958B9AD6A902EBF3C`. Its corruption cause is unknown. Recovery provenance and test boundaries are in `r1-media-recovery-evidence.md` and the R1 report.

The baseline excludes credentials, database clusters/dumps, uploaded media, native signing material, generated bundles/logs and delivered binaries. Those exclusions are not deletion instructions. Private pre-recovery source/config/artifact and stopped-database archives were verified entry-by-entry at `D:\Taha-Private-Recovery\R1-20261111-1336`, with hash-verified copies on the separate physical C disk at `C:\Users\hassa\.taha-private-recovery\R1-20261111`.

This repository has no authorized remote and must not be published or pushed without owner approval. Local Git is a history/recovery mechanism, not encryption or a substitute for database/media backups. Preserve protected runtime backups separately and rehearse restoration before production.
