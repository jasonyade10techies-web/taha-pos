param([ValidateRange(1,65535)][int]$Port = 3001, [ValidateSet('TCP','UDP')][string]$Protocol='TCP', [switch]$Apply)
$ErrorActionPreference = 'Stop'
$taskRuleName = "Taha POS development API $Protocol $Port"
Write-Output "Required inbound rule: $Protocol $Port, Private profile, remote LocalSubnet only."
if (-not $Apply) {
  Write-Output "Inspection only. To create the rule, run PowerShell as Administrator and use:"
  Write-Output "powershell -File scripts/windows-dev-firewall.ps1 -Port $Port -Protocol $Protocol -Apply"
  try { Get-NetFirewallRule -DisplayName $taskRuleName -ErrorAction Stop | Select-Object DisplayName,Enabled,Profile } catch { Write-Output 'Rule missing or firewall inspection needs administrator permission.' }
  exit
}
$taskPrincipal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $taskPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run this scoped helper in PowerShell as Administrator. No firewall changes were made.' }
if (-not (Get-NetFirewallRule -DisplayName $taskRuleName -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName $taskRuleName -Direction Inbound -Action Allow -Protocol $Protocol -LocalPort $Port -RemoteAddress LocalSubnet -Profile Private | Out-Null
}
Write-Output "Created/retained $taskRuleName. No public-profile or internet-wide rule was added."
