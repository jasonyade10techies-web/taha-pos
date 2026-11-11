$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
try {
  & node scripts/start-local-acceptance.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Local acceptance startup failed. Review .test-postgres/local-acceptance logs.' }
} finally { Pop-Location }
