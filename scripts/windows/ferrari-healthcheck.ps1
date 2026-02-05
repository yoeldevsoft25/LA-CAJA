<#
.SYNOPSIS
    Ferrari Healthcheck - System Vitality Monitor for Windows
.DESCRIPTION
    Checks the status of critical components (Docker, Network, Tailscale) and logs results.
    Part of the LA-CAJA High Availability "Ferrari" Plan.
.NOTES
    File Name      : ferrari-healthcheck.ps1
    Author         : Antigravity Agent
    Prerequisite   : Run as Administrator recommended for full access
#>

# Configuration
$LogPath = "C:\ProgramData\LaCaja\logs"
$LogFile = "$LogPath\ferrari_health.log"
$MaxLogSizeMB = 10

# Ensure Log Directory Exists
if (-not (Test-Path -Path $LogPath)) {
    New-Item -ItemType Directory -Path $LogPath -Force | Out-Null
}

# Logger Function
function Write-Log {
    param (
        [string]$Message,
        [string]$Level = "INFO"
    )
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogEntry = "[$Timestamp] [$Level] $Message"
    Add-Content -Path $LogFile -Value $LogEntry
    if ($Level -eq "ERROR") {
        Write-Host $LogEntry -ForegroundColor Red
    } else {
        Write-Host $LogEntry -ForegroundColor Green
    }
}

# Rotate Log if too big
if (Test-Path $LogFile) {
    $LogSize = (Get-Item $LogFile).Length / 1MB
    if ($LogSize -gt $MaxLogSizeMB) {
        Move-Item -Path $LogFile -Destination "$LogFile.old" -Force
        Write-Log "Log rotated due to size limit." "INFO"
    }
}

Write-Log "Starting Ferrari Healthcheck..." "INFO"

$GlobalStatus = "OK"

# 1. Check Internet Connectivity
$PingTargets = @("8.8.8.8", "1.1.1.1")
$InternetStatus = $false
foreach ($Target in $PingTargets) {
    if (Test-Connection -ComputerName $Target -Count 1 -Quiet) {
        $InternetStatus = $true
        break
    }
}

if ($InternetStatus) {
    Write-Log "Internet Connectivity: ONLINE" "INFO"
} else {
    Write-Log "Internet Connectivity: OFFLINE" "ERROR"
    $GlobalStatus = "DEGRADED"
}

# 2. Check Docker Containers
$CriticalContainers = @("la-caja-db", "la-caja-redis")
foreach ($Container in $CriticalContainers) {
    $State = docker inspect -f '{{.State.Running}}' $Container 2>$null
    if ($State -eq 'true') {
        Write-Log "Container ${Container}: RUNNING" "INFO"
    } else {
        Write-Log "Container ${Container}: STOPPED/MISSING" "ERROR"
        $GlobalStatus = "CRITICAL"
    }
}

# 3. Check Tailscale Status (If installed)
if (Get-Command tailscale -ErrorAction SilentlyContinue) {
    $TsStatus = tailscale status --json | ConvertFrom-Json
    if ($TsStatus.BackendState -eq "Running") {
        Write-Log "Tailscale: RUNNING" "INFO"
    } else {
        Write-Log "Tailscale: STOPPED/ERROR ($($TsStatus.BackendState))" "ERROR"
        $GlobalStatus = "DEGRADED"
    }
} else {
    Write-Log "Tailscale command not found (Skipping check)" "WARN"
}

# Final Status Output to File (for other scripts to consume)
$StatusObj = [PSCustomObject]@{
    Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Status = $GlobalStatus
    Internet = $InternetStatus
}
$StatusObj | ConvertTo-Json | Set-Content -Path "$LogPath\ferrari_status.json"

Write-Log "Healthcheck Finished. Global Status: $GlobalStatus" "INFO"
