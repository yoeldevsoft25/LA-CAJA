param(
  [Parameter(Mandatory = $true)]
  [string]$TailscaleAuthKey,

  [string]$ServerIp = "100.109.89.122",
  [string]$ServerPort = "3000",

  [string]$PrimaryApiUrl = "http://127.0.0.1:3001",
  [string]$FallbackApiUrl = "https://desktop-0kscckj.tail501d29.ts.net",
  [string]$TertiaryApiUrl = "https://naughty-clem-veloxpos-ee21de4c.koyeb.app"
)

$ErrorActionPreference = "Stop"

$env:TAILSCALE_AUTH_KEY = $TailscaleAuthKey
$env:TAILSCALE_SERVER_IP = $ServerIp
$env:TAILSCALE_SERVER_PORT = $ServerPort

$env:VITE_PRIMARY_API_URL = $PrimaryApiUrl
$env:VITE_FALLBACK_API_URL = $FallbackApiUrl
$env:VITE_TERTIARY_API_URL = $TertiaryApiUrl

Write-Host "TAILSCALE_SERVER_IP=$($env:TAILSCALE_SERVER_IP)"
Write-Host "TAILSCALE_SERVER_PORT=$($env:TAILSCALE_SERVER_PORT)"
Write-Host "VITE_PRIMARY_API_URL=$($env:VITE_PRIMARY_API_URL)"
Write-Host "VITE_FALLBACK_API_URL=$($env:VITE_FALLBACK_API_URL)"
Write-Host "VITE_TERTIARY_API_URL=$($env:VITE_TERTIARY_API_URL)"

Set-Location "apps/desktop"
npm run tauri dev
