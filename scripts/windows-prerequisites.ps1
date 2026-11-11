$ErrorActionPreference = 'Continue'
$taskCargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
if (Test-Path -LiteralPath $taskCargoBin) { $env:Path = $taskCargoBin + ';' + $env:Path }
Write-Output 'Taha POS Windows native prerequisite check'
foreach ($taskCommand in @('rustc','cargo','rustup')) {
  $taskExecutable = Get-Command $taskCommand -ErrorAction SilentlyContinue
  if ($taskExecutable) { & $taskExecutable.Source --version } else { Write-Output "$taskCommand : MISSING" }
}
if (Get-Command rustup -ErrorAction SilentlyContinue) { rustup show; rustup target list --installed }
$taskVsWhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (Test-Path -LiteralPath $taskVsWhere) { & $taskVsWhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath } else { Write-Output 'MSVC C++ Build Tools: MISSING (vswhere unavailable)' }
$taskSdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\Lib'
if (Test-Path -LiteralPath $taskSdk) { Get-ChildItem -LiteralPath $taskSdk -Directory | Select-Object -ExpandProperty Name } else { Write-Output 'Windows SDK: MISSING' }
