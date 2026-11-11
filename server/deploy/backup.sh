#!/usr/bin/env bash
# Run on the future VPS, from server/, after putting .env in place. Never invoked by builds.
set -euo pipefail
umask 077
destination="${1:?Provide an absolute private backup directory}"
[[ "$destination" == /* ]] || { echo 'Use an absolute backup directory'; exit 1; }
mkdir -p "$destination"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
docker compose exec -T postgres pg_dump -U taha_migrator -d taha_pos -Fc > "$destination/database-$stamp.dump"
docker compose exec -T api tar -C /workspace/server/data -czf - media > "$destination/media-$stamp.tar.gz"
(cd "$destination" && sha256sum "database-$stamp.dump" "media-$stamp.tar.gz" > "checksums-$stamp.txt")
echo 'Backup created. Encrypt and copy off the VPS; regularly exercise a separate restore.'
