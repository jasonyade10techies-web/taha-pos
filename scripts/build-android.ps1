$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskTools = Join-Path $taskRoot '.tools\android'
if (-not $env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME = Join-Path $taskTools 'gradle-cache' }
if (-not $env:TEMP -or (Get-PSDrive -Name C).Free -lt 1GB) {
  $taskTemp = Join-Path $taskTools 'temp'
  New-Item -ItemType Directory -Force $taskTemp | Out-Null
  $env:TEMP = $taskTemp; $env:TMP = $taskTemp
}
if (-not $env:JAVA_HOME -and (Test-Path -LiteralPath (Join-Path $taskTools 'jdk'))) {
  $env:JAVA_HOME = (Get-ChildItem (Join-Path $taskTools 'jdk') -Directory | Select-Object -First 1).FullName
}
if (-not $env:ANDROID_HOME -and (Test-Path -LiteralPath (Join-Path $taskTools 'sdk'))) { $env:ANDROID_HOME = Join-Path $taskTools 'sdk' }
if (-not $env:JAVA_HOME -or -not $env:ANDROID_HOME) { throw 'Set JAVA_HOME (JDK 17+) and ANDROID_HOME (Android SDK with platform 35/build-tools 35.0.0).' }
$taskGradle = Join-Path $taskTools 'gradle-8.11.1\bin\gradle.bat'
if (-not (Test-Path -LiteralPath $taskGradle)) { $taskGradle = Join-Path $taskRoot 'mobile\android\gradlew.bat' }
if (-not (Test-Path -LiteralPath $taskGradle)) { throw 'Gradle wrapper or Gradle 8.11.1 is required. See mobile/android/README.md.' }
Push-Location $taskRoot
try {
  npm run typecheck
  if ($LASTEXITCODE -ne 0) { throw 'Frontend TypeScript validation failed.' }
  npm run build:mobile
  if ($LASTEXITCODE -ne 0) { throw 'Bundled mobile frontend build failed.' }
} finally { Pop-Location }
Push-Location (Join-Path $taskRoot 'mobile\android')
try {
  & $taskGradle --no-daemon assembleDebug testDebugUnitTest lintDebug
  if ($LASTEXITCODE -ne 0) { throw 'Android build or validation failed.' }
  $taskOutput = Join-Path $taskRoot 'artifacts\android'
  New-Item -ItemType Directory -Force $taskOutput | Out-Null
  Copy-Item -LiteralPath 'app\build\outputs\apk\debug\app-debug.apk' -Destination (Join-Path $taskOutput 'Taha-Staff-test-5D2.apk') -Force
  $taskApk = Join-Path $taskOutput 'Taha-Staff-test-5D2.apk'
  $taskSigner = Join-Path $env:ANDROID_HOME 'build-tools\35.0.0\apksigner.bat'
  & $taskSigner verify --verbose $taskApk
  if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
  $taskStream = [IO.File]::OpenRead($taskApk)
  $taskHasher = [Security.Cryptography.SHA256]::Create()
  try { $taskHash = [BitConverter]::ToString($taskHasher.ComputeHash($taskStream)).Replace('-', '').ToLowerInvariant() } finally { $taskStream.Dispose(); $taskHasher.Dispose() }
  Set-Content -LiteralPath "$taskApk.sha256" -Value "$taskHash  Taha-Staff-test-5D2.apk" -Encoding ascii
  Write-Output $taskApk
} finally { Pop-Location }

