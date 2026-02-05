<#
.SYNOPSIS
    Harden Windows Firewall - LA-CAJA Security Layer
.DESCRIPTION
    Configures Windows Defender Firewall to:
    1. Allow API (3000) from Private Networks/Tailscale.
    2. Block External access to DB (5432) and Redis (6379).
    3. Allow Localhost access to DB/Redis (Critical for API).
.NOTES
    File Name      : harden-firewall.ps1
    Author         : Antigravity Agent
    Requires       : Run as Administrator
#>

Write-Host "Starting Firewall Hardening..." -ForegroundColor Cyan

# Define Ports
$ApiPort = 3000
$DbPort = 5432
$RedisPort = 6379

# Remove existing rules to avoid duplicates (Clean Slate for these/ports)
Write-Host "Cleaning old rules..." -ForegroundColor Yellow
Remove-NetFirewallRule -DisplayName "LaCaja-API-In" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "LaCaja-DB-In" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "LaCaja-Redis-In" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "LaCaja-Block-Public-DB" -ErrorAction SilentlyContinue

# 1. ALLOW API (3000)
# We allow it on Domain and Private profiles (Home/Office/VPN).
# Public profile is debatable; usually safer to block unless needed.
New-NetFirewallRule -DisplayName "LaCaja-API-In" `
    -Direction Inbound `
    -LocalPort $ApiPort `
    -Protocol TCP `
    -Action Allow `
    -Profile Private,Domain `
    -Description "Allow Access to NestJS API"
Write-Host "Allowed Inbound TCP $ApiPort (Private/Domain)" -ForegroundColor Green

# 2. SECURE DB & REDIS
# Strategy: Allow from specific subnets OR Localhost. 
# Windows Firewall is "Allow" by default on open ports unless Blocked?
# Actually default inbound is Block. So we just need to ALLOW localhost and maybe VPN.

# Rule: Allow DB from Localhost
New-NetFirewallRule -DisplayName "LaCaja-DB-Local" `
    -Direction Inbound `
    -LocalPort $DbPort `
    -Protocol TCP `
    -Action Allow `
    -RemoteAddress LocalSubnet `
    -Description "Allow Postgres from Local Subnet"
Write-Host "Allowed Inbound TCP $DbPort (Local Subnet)" -ForegroundColor Green

# Rule: Allow Redis from Localhost
New-NetFirewallRule -DisplayName "LaCaja-Redis-Local" `
    -Direction Inbound `
    -LocalPort $RedisPort `
    -Protocol TCP `
    -Action Allow `
    -RemoteAddress LocalSubnet `
    -Description "Allow Redis from Local Subnet"
Write-Host "Allowed Inbound TCP $RedisPort (Local Subnet)" -ForegroundColor Green

# Rule: EXPLICIT BLOCK Public DB Access (Defense in Depth)
# Even if default is block, we add a specific block for Public profile
New-NetFirewallRule -DisplayName "LaCaja-DB-Block-Public" `
    -Direction Inbound `
    -LocalPort $DbPort `
    -Protocol TCP `
    -Action Block `
    -Profile Public `
    -Description "BLOCK Public Access to Postgres"
Write-Host "BLOCKED Public access to $DbPort" -ForegroundColor Green

New-NetFirewallRule -DisplayName "LaCaja-Redis-Block-Public" `
    -Direction Inbound `
    -LocalPort $RedisPort `
    -Protocol TCP `
    -Action Block `
    -Profile Public `
    -Description "BLOCK Public Access to Redis"
Write-Host "BLOCKED Public access to $RedisPort" -ForegroundColor Green

Write-Host "Firewall Hardening Complete." -ForegroundColor Cyan
Write-Host "Double check connectivity to localhost:3000 after this." -ForegroundColor Yellow
