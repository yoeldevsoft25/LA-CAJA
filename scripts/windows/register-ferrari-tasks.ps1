<#
.SYNOPSIS
    Register Ferrari Tasks - Windows Task Scheduler Integration
.DESCRIPTION
    Registers the Healthcheck and Self-Heal scripts to run automatically.
    Healthcheck: Every 5 minutes.
    Self-Heal: Every 5 minutes (offset by 1 min).
.NOTES
    File Name      : register-ferrari-tasks.ps1
    Author         : Antigravity Agent
    Requires       : Run as Administrator
#>

$ScriptPath = "C:\Users\Yoel Dev\Documents\GitHub\LA-CAJA\scripts\windows"
$HealthCheckScript = "$ScriptPath\ferrari-healthcheck.ps1"
$SelfHealScript = "$ScriptPath\ferrari-self-heal.ps1"
$User = "SYSTEM" # Run as SYSTEM for highest privileges and no interactive login requirement

# Helper to Create Task
function Register-MyTask {
    param (
        [string]$Name,
        [string]$Script,
        [string]$IntervalMinutes,
        [string]$Description
    )
    
    $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Script`""
    $Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
    # Set to run indefinitely
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable:$false
    
    Write-Host "Registering Task: $Name..." -ForegroundColor Cyan
    
    try {
        Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction SilentlyContinue
        Register-ScheduledTask -Action $Action -Trigger $Trigger -TaskName $Name -Description $Description -User $User -Settings $Settings -Force
        Write-Host "Task $Name registered successfully." -ForegroundColor Green
    } catch {
        Write-Host "Error registering task $Name : $_" -ForegroundColor Red
    }
}

# Register Healthcheck (Every 5 mins)
Register-MyTask -Name "Ferrari_Healthcheck" -Script $HealthCheckScript -IntervalMinutes 5 -Description "La Caja Ferrari - System Health Monitoring"

# Register Self-Heal (Every 5 mins)
Register-MyTask -Name "Ferrari_SelfHeal" -Script $SelfHealScript -IntervalMinutes 5 -Description "La Caja Ferrari - Automatic Recovery System"

Write-Host "All Ferrari Tasks Registered." -ForegroundColor Green
