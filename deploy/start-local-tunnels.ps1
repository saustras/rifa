param(
  [string]$HostName = "216.250.112.93",
  [string]$User = "root",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\rifa_vps_ed25519",
  [int]$LocalPostgresPort = 15432,
  [int]$LocalAdminPort = 18080
)

$ErrorActionPreference = "Stop"

function Start-TunnelIfMissing {
  param(
    [int]$LocalPort,
    [string]$RemoteForward
  )

  $existing = Get-NetTCPConnection `
    -LocalAddress 127.0.0.1 `
    -LocalPort $LocalPort `
    -State Listen `
    -ErrorAction SilentlyContinue

  if ($existing) {
    Write-Output "Tunnel already active on 127.0.0.1:$LocalPort"
    return
  }

  $args = @(
    "-i", $KeyPath,
    "-o", "ExitOnForwardFailure=yes",
    "-o", "ServerAliveInterval=30",
    "-o", "ServerAliveCountMax=3",
    "-L", "127.0.0.1:$LocalPort`:$RemoteForward",
    "-N", "$User@$HostName"
  )

  Start-Process -FilePath "ssh" -ArgumentList $args -WindowStyle Hidden | Out-Null
  Start-Sleep -Seconds 2

  $started = Get-NetTCPConnection `
    -LocalAddress 127.0.0.1 `
    -LocalPort $LocalPort `
    -State Listen `
    -ErrorAction SilentlyContinue

  if (-not $started) {
    throw "Tunnel failed on 127.0.0.1:$LocalPort"
  }

  Write-Output "Tunnel active on 127.0.0.1:$LocalPort"
}

Start-TunnelIfMissing -LocalPort $LocalPostgresPort -RemoteForward "127.0.0.1:55432"
Start-TunnelIfMissing -LocalPort $LocalAdminPort -RemoteForward "127.0.0.1:8080"

Write-Output "PostgreSQL tunnel: 127.0.0.1:$LocalPostgresPort"
Write-Output "Admin tunnel: http://127.0.0.1:$LocalAdminPort/"
