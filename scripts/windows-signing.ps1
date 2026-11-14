param(
 [ValidateSet('Initialize','Sign')][string]$Mode='Initialize',
 [string]$KeyDirectory='D:\Taha-Private-Recovery\Windows-Updater-Staging-20261114',
 [string]$File,
 [string]$Version
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$projectRoot=Split-Path -Parent $PSScriptRoot
$keyRoot=[IO.Path]::GetFullPath($KeyDirectory)
$allowedRoot=[IO.Path]::GetFullPath('D:\Taha-Private-Recovery')+[IO.Path]::DirectorySeparatorChar
if (-not $keyRoot.StartsWith($allowedRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Use the private recovery directory, outside source and public artifacts.' }
$identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name
if (-not (Test-Path -LiteralPath $keyRoot)) { New-Item -ItemType Directory -Path $keyRoot | Out-Null }
& icacls.exe $keyRoot /inheritance:r /grant:r ($identity+':(OI)(CI)F') 'SYSTEM:(OI)(CI)F' > $null
if ($LASTEXITCODE -ne 0) { throw 'Cannot restrict signing directory permissions.' }
$keyFile=Join-Path $keyRoot 'staging.key'
$passwordFile=Join-Path $keyRoot 'password.dpapi'
$entropy=[Text.Encoding]::UTF8.GetBytes('TahaPOS Windows staging updater v1')
$node='C:\Users\hassa\AppData\Local\hermes\node\node.exe'
$cli=Join-Path $projectRoot 'node_modules/@tauri-apps/cli/tauri.js'
if (-not (Test-Path -LiteralPath $cli)) { throw 'Install existing project dependencies first.' }
if ($Mode -eq 'Initialize') {
 if ((Test-Path -LiteralPath $keyFile) -or (Test-Path -LiteralPath $passwordFile)) { throw 'Signing recovery already exists; refusing to replace an identity.' }
 $randomBytes=New-Object byte[] 48
 $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
 try { $rng.GetBytes($randomBytes) } finally { $rng.Dispose() }
 $password=[Convert]::ToBase64String($randomBytes)
 $protected=[Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($password),$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 [IO.File]::WriteAllBytes($passwordFile,$protected)
 $output=& $node $cli signer generate --ci --write-keys $keyFile --password $password 2>&1
 if ($LASTEXITCODE -ne 0) { throw 'Tauri key generation failed; preserve partial files for review. No key content is printed.' }
 if (-not (Test-Path -LiteralPath ($keyFile+'.pub'))) { throw 'Public verification key was not created.' }
 $publicKey=[IO.File]::ReadAllText($keyFile+'.pub').Trim()
 [IO.File]::WriteAllText((Join-Path $projectRoot 'src-tauri/updater-staging.pub'),$publicKey+"`n")
 Write-Output 'Created protected local staging updater identity. Only its public key was copied into source.'
} else {
 if (-not $File -or $Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Specify the inspected artifact and its exact version.' }
 $artifact=(Resolve-Path -LiteralPath $File).Path
 if (-not $artifact.StartsWith([IO.Path]::GetFullPath((Join-Path $projectRoot 'artifacts'))+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Sign only an inspected local artifact.' }
 if (Test-Path -LiteralPath ($artifact+'.sig')) { throw 'Refusing to overwrite an existing signature.' }
 $password=[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($passwordFile),$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser))
 $priorPassword=$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD
 try {
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD=$password
  $output=& $node $cli signer sign --private-key-path $keyFile --app-version $Version $artifact 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'Tauri signing failed. No private key/password content is printed.' }
  if (-not (Test-Path -LiteralPath ($artifact+'.sig'))) { throw 'Expected signature was not created.' }
  Write-Output ('Signed artifact: '+[IO.Path]::GetFileName($artifact)+'; version is bound into the signature.')
 } finally { $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD=$priorPassword }
}
$password=$null
$output=$null
