#!/usr/bin/env bash
# Explicit maintenance action. Never called by startup/build/deployment scripts.
set -euo pipefail
umask 077
directory="${1:?Provide the absolute backup directory}"
stamp="${2:?Provide the backup timestamp}"
[[ "$directory" == /* && "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || { echo 'Invalid backup path/timestamp'; exit 1; }
[[ "${TAHA_RESTORE_CONFIRM:-}" == 'RESTORE_TAHA_DATABASE' ]] || { echo 'Test a restore on an isolated VPS first. To replace this database set TAHA_RESTORE_CONFIRM=RESTORE_TAHA_DATABASE.'; exit 1; }
cd "$directory"
sha256sum -c "checksums-$stamp.txt"
# Reject unsafe archive paths before extraction.
tar -tzf "media-$stamp.tar.gz" | awk '$0 !~ /^media(\/|$)/ || $0 ~ /(^|\/)\.\.(\/|$)/ {bad=1} END {exit bad}'
docker compose --project-directory "${TAHA_SERVER_DIRECTORY:?Set the absolute server directory}" stop api
docker compose --project-directory "$TAHA_SERVER_DIRECTORY" exec -T postgres pg_restore -U taha_migrator -d taha_pos --clean --if-exists --no-owner --exit-on-error < "database-$stamp.dump"
docker compose --project-directory "$TAHA_SERVER_DIRECTORY" run --rm --no-deps -T --user node --entrypoint tar api -C /workspace/server/data -xzf - < "media-$stamp.tar.gz"
docker compose --project-directory "$TAHA_SERVER_DIRECTORY" up -d api
echo 'Database and uploads restored. Verify health, login, stock balances, invoice totals and private images before reopening the counter.'
