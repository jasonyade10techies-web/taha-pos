param(
  [Parameter(Mandatory=$true)][string]$Address,
  [ValidateRange(1024,65535)][int]$Port=3443
)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskIp=$null
if(-not [System.Net.IPAddress]::TryParse($Address,[ref]$taskIp)-or $taskIp.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork){throw 'Address must be the current reachable IPv4 address of this PC (router, Ethernet or hotspot).'}
$taskFolder=Join-Path $taskRoot 'server\data\lan-tls'
New-Item -ItemType Directory -Force -Path $taskFolder | Out-Null
# A local private key stays outside Git and APK assets. Restrict it to this Windows user.
$taskIdentity=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $taskFolder /inheritance:r /grant:r "${taskIdentity}:(OI)(CI)F" | Out-Null
if($LASTEXITCODE -ne 0){throw 'Cannot restrict the TLS private-key folder.'}
$taskKey=Join-Path $taskFolder 'counter-key.pem'
$taskCert=Join-Path $taskFolder 'counter-cert.pem'
$taskOpenSsl=(Get-Command openssl.exe -ErrorAction Stop).Source
if(-not(Test-Path -LiteralPath $taskKey)){
 & $taskOpenSsl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out $taskKey 2>$null
 if($LASTEXITCODE -ne 0){throw 'Could not create the counter TLS key.'}
}
# Preserve the existing key/pin when a router or hotspot changes the counter IP.
& $taskOpenSsl req -x509 -new -key $taskKey -out $taskCert -days 365 -sha256 -subj '/CN=Taha Local Counter' -addext "subjectAltName=IP:$Address,DNS:localhost,IP:127.0.0.1" 2>$null
if($LASTEXITCODE -ne 0){throw 'Could not create the counter TLS certificate.'}
$env:TAHA_LAN_TLS_CERT=$taskCert
$env:TAHA_LAN_TLS_KEY=$taskKey
$env:TAHA_LAN_TLS_PORT=[string]$Port
$env:TAHA_LAN_TLS_ORIGIN="https://${Address}:$Port"
@{version=1;port=$Port;preferredAddress=$Address}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $taskFolder 'runtime.json') -Encoding utf8
Write-Output "Protected counter address: $env:TAHA_LAN_TLS_ORIGIN"
Write-Output 'Environment is configured in this PowerShell session. Start the existing API from this same session. The phone authenticates the certificate pin from the PC QR; do not install a system-wide CA or bypass Android certificate checks.'
