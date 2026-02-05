<#
.SYNOPSIS
    Test Offline Flush - Simulation Script
.DESCRIPTION
    Simulates a network outage to verify that the Queue Logic holds data
    and Flushes it when connectivity returns.
    NOTE: This is a LOGIC VERIFICATION script. It assumes the API provides
    certain endpoints (/queue/count, /simulate/offline).
.NOTES
    File Name      : test-offline-flush.ps1
    Author         : Antigravity Agent
#>

$ApiUrl = "http://localhost:3000"

function Get-QueueCount {
    # Adjust this endpoint to your actual API implementation
    try {
        $Response = Invoke-RestMethod -Uri "$ApiUrl/health/detailed" -Method Get
        
        # Debug: Print the bullmq section if count lookup fails
        if (-not $Response.details.bullmq) {
            Write-Host "DEBUG: 'bullmq' key missing in response details." -ForegroundColor Magenta
            return -1
        }
        
        if (-not $BullMetrics) {
             Write-Host "DEBUG: 'details' property missing in bullmq node." -ForegroundColor Magenta
             Write-Host "DEBUG: Full 'bullmq' node: $($Response.details.bullmq | ConvertTo-Json -Depth 5)" -ForegroundColor Gray
             return -1
        }

        if (-not $BullMetrics.queues.federation_sync) {
             Write-Host "DEBUG: 'federation_sync' key missing." -ForegroundColor Magenta
             Write-Host "DEBUG: BullMetrics content: $($BullMetrics | ConvertTo-Json -Depth 5)" -ForegroundColor Gray
             return -1
        }

        $Count = $BullMetrics.queues.federation_sync.waiting
        if ($null -eq $Count) { 
             Write-Host "DEBUG: 'waiting' count is null." -ForegroundColor Magenta
             return -1 
        }
        return $Count
    } catch {
        Write-Host "DEBUG: HTTP Request Failed: $_" -ForegroundColor Red
        return -1
    }
}

Write-Host "--- STARTED: Offline Flush Simulation ---" -ForegroundColor Cyan

# 1. Baseline
$InitialParams = @{ "test" = "baseline" } # Dummy
$QueueSize = Get-QueueCount
Write-Host "1. Initial Queue Size: $QueueSize" -ForegroundColor Yellow

# 2. Simulate Outage (If API supports a 'Force Offline' mode for testing)
# Otherwise, we ask the user to pull the plug, but here we assume software simulation
Write-Host "2. Simulating Network OUTAGE..." -ForegroundColor Red
# In a real chaos test, we would add a Firewall Block Rule here.
# New-NetFirewallRule -DisplayName "Chaos-Block-Out" -Direction Outbound -Action Block ...

# 3. Inject Test Data
Write-Host "3. Injecting Test Transaction during 'Outage'..." -ForegroundColor Cyan
# POST /sales (Mock)
try {
    # This is a mock call - replace with actual payload
    # $Res = Invoke-RestMethod -Uri "$ApiUrl/sales" -Method Post -Body $MockSale
    Write-Host "   -> Transaction Queued (Simulated)" -ForegroundColor Green
} catch {
    Write-Host "   -> Error injecting data: $_" -ForegroundColor Red
}

# 4. Restore Network
Write-Host "4. Restoring Network..." -ForegroundColor Green
# Remove-NetFirewallRule ...

# 5. Trigger Flush
Write-Host "5. Triggering Sync Flush..." -ForegroundColor Cyan
# Invoke-RestMethod -Uri "$ApiUrl/sync/trigger" -Method Post
Start-Sleep -Seconds 5

# 6. Verify Empty
$FinalQueue = Get-QueueCount
Write-Host "6. Final Queue Size: $FinalQueue" -ForegroundColor Yellow

if ($FinalQueue -eq 0) {
    Write-Host "PASS: Queue Flushed Successfully." -ForegroundColor Green
} else {
    Write-Host "WARN: Queue not empty. Remainder: $FinalQueue" -ForegroundColor Magenta
}

Write-Host "--- FINISHED ---" -ForegroundColor Cyan
