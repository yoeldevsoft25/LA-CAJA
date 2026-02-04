param(
    [string]$ProjectRoot = "",
    [string]$TaskPrefix = "LA-CAJA-FERRARI",
    [int]$HealthIntervalMinutes = 1,
    [int]$HealIntervalMinutes = 2,
    [string]$ApiBaseUrl = "http://localhost:3000",
    [string]$ApiStartCommand = "npm --prefix apps/api run start:prod",
    [string]$WireGuardTunnelName = "LA-CAJA-FALLBACK",
    [switch]$EnableWireGuardFallback,
    [switch]$RunNow
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$healthScript = Join-Path $PSScriptRoot "ferrari-healthcheck.ps1"
$selfHealScript = Join-Path $PSScriptRoot "ferrari-self-heal.ps1"

if (-not (Test-Path $healthScript)) {
    throw "Health script not found: $healthScript"
}

if (-not (Test-Path $selfHealScript)) {
    throw "Self-heal script not found: $selfHealScript"
}

$healthTaskName = "$TaskPrefix-HEALTHCHECK"
$selfHealTaskName = "$TaskPrefix-SELFHEAL"

$taskUser = "$env:USERDOMAIN\$env:USERNAME"
$repeatHealth = New-TimeSpan -Minutes ([Math]::Max($HealthIntervalMinutes, 1))
$repeatHeal = New-TimeSpan -Minutes ([Math]::Max($HealIntervalMinutes, 1))
$repeatDuration = New-TimeSpan -Days 3650

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

$principal = New-ScheduledTaskPrincipal -UserId $taskUser -LogonType InteractiveToken -RunLevel Highest

$healthArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$healthScript`" -ApiBaseUrl `"$ApiBaseUrl`" -WireGuardTunnelName `"$WireGuardTunnelName`""
$healthAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $healthArgs
$healthTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval $repeatHealth `
    -RepetitionDuration $repeatDuration

$healArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$selfHealScript`" -ProjectRoot `"$ProjectRoot`" -ApiBaseUrl `"$ApiBaseUrl`" -ApiStartCommand `"$ApiStartCommand`" -WireGuardTunnelName `"$WireGuardTunnelName`""
if ($EnableWireGuardFallback) {
    $healArgs += " -EnableWireGuardFallback"
}
$healAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $healArgs
$healTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval $repeatHeal `
    -RepetitionDuration $repeatDuration

foreach ($taskName in @($healthTaskName, $selfHealTaskName)) {
    $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existing) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }
}

Register-ScheduledTask `
    -TaskName $healthTaskName `
    -Action $healthAction `
    -Trigger $healthTrigger `
    -Settings $settings `
    -Principal $principal `
    -Description "LA-CAJA Ferrari healthcheck task"

Register-ScheduledTask `
    -TaskName $selfHealTaskName `
    -Action $healAction `
    -Trigger $healTrigger `
    -Settings $settings `
    -Principal $principal `
    -Description "LA-CAJA Ferrari self-heal task"

Write-Host "Tasks registered:" -ForegroundColor Green
Write-Host "- $healthTaskName (every $($repeatHealth.TotalMinutes) min)"
Write-Host "- $selfHealTaskName (every $($repeatHeal.TotalMinutes) min)"

if ($RunNow) {
    Start-ScheduledTask -TaskName $healthTaskName
    Start-ScheduledTask -TaskName $selfHealTaskName
    Write-Host "Tasks started immediately." -ForegroundColor Green
}
