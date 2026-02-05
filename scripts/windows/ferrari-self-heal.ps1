<#
.SYNOPSIS
    Ferrari Self-Heal - System Auto-Recovery for Windows
.DESCRIPTION
    Reads the status from Healthcheck and performs remedial actions (Restart containers, services).
.NOTES
    File Name      : ferrari-self-heal.ps1
    Author         : Antigravity Agent
#>

# Configuration
$LogPath = "C:\ProgramData\LaCaja\logs"
$LogFile = "$LogPath\ferrari_self_heal.log"
$StatusFile = "$LogPath\ferrari_status.json"

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
        Write-Host $LogEntry -ForegroundColor Cyan
    }
}

# Check if Status File Exists
if (-not (Test-Path $StatusFile)) {
    Write-Log "No status file found at $StatusFile. Skipping self-heal cycle." "WARN"
    exit
}

# Read Status
try {
    $StatusObj = Get-Content -Path $StatusFile -Raw | ConvertFrom-Json
} catch {
    Write-Log "Failed to read status file: $_" "ERROR"
    exit
}

if ($StatusObj.Status -eq "OK") {
    Write-Log "System Healthy. No action needed." "INFO"
    exit
}

Write-Log "System Status is $($StatusObj.Status). Initiating Healing Procedures..." "WARN"

# Healing Logic: Docker Containers
$CriticalContainers = @("la-caja-db", "la-caja-redis")
foreach ($Container in $CriticalContainers) {
    $State = docker inspect -f '{{.State.Running}}' $Container 2>$null
    if ($State -ne 'true') {
        Write-Log "Attempting to start container: $Container" "INFO"
        try {
            docker start $Container
            Start-Sleep -Seconds 5
            $NewState = docker inspect -f '{{.State.Running}}' $Container 2>$null
            if ($NewState -eq 'true') {
                Write-Log "Successfully started $Container" "INFO"
            } else {
                Write-Log "Failed to start $Container" "ERROR"
            }
        } catch {
            Write-Log "Error starting ${Container}: $_" "ERROR"
        }
    }
}

# Healing Logic: Network/Tailscale (Placeholder for Phase 2)
# If Tailscale is down, we might try 'tailscale up' or check service status
if (Get-Command tailscale -ErrorAction SilentlyContinue) {
    # Check simple status again to be sure
    $TsStatus = tailscale status --json | ConvertFrom-Json
    if ($TsStatus.BackendState -ne "Running") {
         Write-Log "Tailscale is not running. Attempting to restart service..." "WARN"
         # This usually requires Admin rights
         Restart-Service -Name "Tailscale" -ErrorAction SilentlyContinue
    }
}

Write-Log "Self-Heal Cycle Complete." "INFO"
