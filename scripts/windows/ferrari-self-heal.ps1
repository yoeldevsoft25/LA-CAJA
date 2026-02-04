param(
    [string]$ProjectRoot = "",
    [string]$ApiBaseUrl = "http://localhost:3000",
    [string]$ApiStartCommand = "npm --prefix apps/api run start:prod",
    [string[]]$RequiredContainers = @("la-caja-db", "la-caja-redis"),
    [string]$WireGuardTunnelName = "LA-CAJA-FALLBACK",
    [switch]$EnableWireGuardFallback
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$logDir = Join-Path $ProjectRoot "logs"
$logPath = Join-Path $logDir "ferrari-self-heal.log"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Write-Log {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR")][string]$Level = "INFO"
    )

    $line = "{0} [{1}] {2}" -f (Get-Date).ToString("yyyy-MM-dd HH:mm:ss"), $Level, $Message
    Add-Content -Path $logPath -Value $line
    Write-Host $line
}

function Test-ApiUp {
    param([Parameter(Mandatory = $true)][string]$BaseUrl)

    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/health" -TimeoutSec 6
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300)
    }
    catch {
        return $false
    }
}

function Ensure-ServiceRunning {
    param([Parameter(Mandatory = $true)][string]$ServiceName)

    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Log "Service $ServiceName not found" "WARN"
        return $false
    }

    if ($service.Status -eq "Running") {
        return $true
    }

    try {
        Start-Service -Name $ServiceName
        Start-Sleep -Seconds 2
        $service = Get-Service -Name $ServiceName
        if ($service.Status -eq "Running") {
            Write-Log "Service $ServiceName started"
            return $true
        }
        Write-Log "Service $ServiceName failed to start" "WARN"
        return $false
    }
    catch {
        Write-Log "Error starting service $ServiceName: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Ensure-DockerContainersRunning {
    param([string[]]$ContainerNames)

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Log "docker command not found" "WARN"
        return
    }

    foreach ($name in $ContainerNames) {
        try {
            $isRunning = @(docker ps --format "{{.Names}}" 2>$null) -contains $name
            if ($isRunning) {
                continue
            }

            $exists = @(docker ps -a --format "{{.Names}}" 2>$null) -contains $name
            if (-not $exists) {
                Write-Log "Container $name not found" "WARN"
                continue
            }

            docker start $name | Out-Null
            Write-Log "Container $name started"
        }
        catch {
            Write-Log "Failed to start container $name: $($_.Exception.Message)" "ERROR"
        }
    }
}

function Ensure-ApiRunning {
    param(
        [Parameter(Mandatory = $true)][string]$BaseUrl,
        [Parameter(Mandatory = $true)][string]$RootPath,
        [Parameter(Mandatory = $true)][string]$StartCommand
    )

    if (Test-ApiUp -BaseUrl $BaseUrl) {
        return $true
    }

    $listeners = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    if ($listeners) {
        Write-Log "Port 3000 already listening but health is down" "WARN"
        return $false
    }

    $cmd = "cd /d `"$RootPath`" && $StartCommand"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $cmd -WindowStyle Hidden
    Write-Log "API start command executed: $StartCommand"

    Start-Sleep -Seconds 12
    return (Test-ApiUp -BaseUrl $BaseUrl)
}

Write-Log "Self-heal started"

$tailscaleOk = Ensure-ServiceRunning -ServiceName "Tailscale"
Ensure-DockerContainersRunning -ContainerNames $RequiredContainers
$apiOk = Ensure-ApiRunning -BaseUrl $ApiBaseUrl -RootPath $ProjectRoot -StartCommand $ApiStartCommand

if ($EnableWireGuardFallback -and -not $tailscaleOk) {
    $wgServiceName = "WireGuardTunnel`$$WireGuardTunnelName"
    [void](Ensure-ServiceRunning -ServiceName $wgServiceName)
}

$healthScript = Join-Path $PSScriptRoot "ferrari-healthcheck.ps1"
$healthJson = & $healthScript -ApiBaseUrl $ApiBaseUrl -RequiredContainers $RequiredContainers -WireGuardTunnelName $WireGuardTunnelName -JsonOnly
$health = $healthJson | ConvertFrom-Json

if ($health.overall -eq "healthy") {
    Write-Log "Self-heal completed: healthy"
    exit 0
}

Write-Log "Self-heal completed: degraded" "WARN"
exit 2
