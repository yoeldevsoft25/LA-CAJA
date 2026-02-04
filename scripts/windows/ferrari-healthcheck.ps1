param(
    [string]$ApiBaseUrl = "http://localhost:3000",
    [string[]]$RequiredContainers = @("la-caja-db", "la-caja-redis"),
    [string]$WireGuardTunnelName = "LA-CAJA-FALLBACK",
    [switch]$JsonOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-CommandAvailable {
    param([Parameter(Mandatory = $true)][string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-HttpEndpoint {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSec = 8
    )

    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec $TimeoutSec
        return @{
            ok = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300)
            statusCode = [int]$response.StatusCode
            error = $null
        }
    }
    catch {
        $statusCode = 0
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }

        return @{
            ok = $false
            statusCode = $statusCode
            error = $_.Exception.Message
        }
    }
}

function Get-DockerStatus {
    param([string[]]$ContainerNames)

    $containers = @{}
    foreach ($name in $ContainerNames) {
        $containers[$name] = @{
            exists = $false
            running = $false
            state = "missing"
        }
    }

    if (-not (Test-CommandAvailable -Name "docker")) {
        return @{
            available = $false
            error = "docker command not found"
            containers = $containers
        }
    }

    try {
        $raw = docker ps -a --format "{{.Names}}|{{.State}}" 2>$null
        foreach ($line in $raw) {
            if ([string]::IsNullOrWhiteSpace($line)) {
                continue
            }

            $parts = $line -split "\|", 2
            if ($parts.Count -ne 2) {
                continue
            }

            $name = $parts[0].Trim()
            $state = $parts[1].Trim().ToLowerInvariant()

            if ($containers.ContainsKey($name)) {
                $containers[$name] = @{
                    exists = $true
                    running = ($state -eq "running")
                    state = $state
                }
            }
        }

        return @{
            available = $true
            error = $null
            containers = $containers
        }
    }
    catch {
        return @{
            available = $false
            error = $_.Exception.Message
            containers = $containers
        }
    }
}

function Get-TailscaleStatus {
    if (-not (Test-CommandAvailable -Name "tailscale")) {
        return @{
            available = $false
            ok = $false
            backendState = "not-installed"
            selfOnline = $false
            peerCount = 0
            error = "tailscale command not found"
        }
    }

    try {
        $statusJson = tailscale status --json 2>$null | Out-String
        $status = $statusJson | ConvertFrom-Json

        $backendState = [string]$status.BackendState
        $selfOnline = [bool]$status.Self.Online
        $peerCount = 0

        if ($status.Peer) {
            $peerCount = @($status.Peer.PSObject.Properties).Count
        }

        $ok = ($backendState -eq "Running") -and $selfOnline

        return @{
            available = $true
            ok = $ok
            backendState = $backendState
            selfOnline = $selfOnline
            peerCount = $peerCount
            error = $null
        }
    }
    catch {
        return @{
            available = $true
            ok = $false
            backendState = "unknown"
            selfOnline = $false
            peerCount = 0
            error = $_.Exception.Message
        }
    }
}

function Get-WireGuardStatus {
    param([Parameter(Mandatory = $true)][string]$TunnelName)

    $serviceName = "WireGuardTunnel`$$TunnelName"
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

    if (-not $service) {
        return @{
            installed = $false
            running = $false
            serviceName = $serviceName
            status = "missing"
        }
    }

    return @{
        installed = $true
        running = ($service.Status -eq "Running")
        serviceName = $serviceName
        status = [string]$service.Status
    }
}

$healthUrl = "$ApiBaseUrl/health"
$detailedUrl = "$ApiBaseUrl/health/detailed"

$apiHealth = Test-HttpEndpoint -Url $healthUrl
$apiDetailed = Test-HttpEndpoint -Url $detailedUrl
$docker = Get-DockerStatus -ContainerNames $RequiredContainers
$tailscale = Get-TailscaleStatus
$wireguard = Get-WireGuardStatus -TunnelName $WireGuardTunnelName

$criticalIssues = @()

if (-not $apiHealth.ok) {
    $criticalIssues += "api-health"
}

foreach ($containerName in $RequiredContainers) {
    $entry = $docker.containers[$containerName]
    if (-not $entry.running) {
        $criticalIssues += "container-$containerName"
    }
}

if (-not $tailscale.ok) {
    $criticalIssues += "tailscale"
}

$overall = if ($criticalIssues.Count -eq 0) { "healthy" } else { "degraded" }

$result = [ordered]@{
    timestamp = (Get-Date).ToString("o")
    overall = $overall
    criticalIssues = $criticalIssues
    api = @{
        baseUrl = $ApiBaseUrl
        health = $apiHealth
        detailed = $apiDetailed
    }
    docker = $docker
    tailscale = $tailscale
    wireguard = $wireguard
}

$json = $result | ConvertTo-Json -Depth 8

if ($JsonOnly) {
    Write-Output $json
}
else {
    Write-Host ""
    Write-Host "LA-CAJA Ferrari Healthcheck" -ForegroundColor Cyan
    Write-Host "Overall: $overall" -ForegroundColor $(if ($overall -eq "healthy") { "Green" } else { "Yellow" })
    if ($criticalIssues.Count -gt 0) {
        Write-Host ("Issues: " + ($criticalIssues -join ", ")) -ForegroundColor Yellow
    }
    Write-Host $json
}

if ($overall -eq "healthy") {
    exit 0
}

exit 2
