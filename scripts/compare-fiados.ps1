# Compare fiado data between local Docker Postgres and a remote Supabase/Postgres.
param (
    [Parameter(Mandatory=$false)]
    [string]$ConnectionString
)

if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
    Write-Error "Docker no está instalado o no está en el PATH."
    exit 1
}

if (-not $ConnectionString) {
    Write-Host "Ingresa la cadena de conexión de Supabase (pgpool o session):"
    Write-Host "Ej: postgres://postgres.xxxx:pass@aws-1.region.pooler.supabase.com:5432/postgres?sslmode=require"
    $ConnectionString = Read-Host "Connection String"
}

if (-not $ConnectionString) {
    Write-Error "Es necesario suministrar una cadena de conexión remota."
    exit 1
}

$tempDir = Join-Path $env:TEMP "la-caja-fiados"
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir | Out-Null
}

$localCsv = Join-Path $tempDir "fiado-local.csv"
$remoteCsv = Join-Path $tempDir "fiado-remote.csv"

$query = @"
COPY (
  SELECT 
    store_id,
    customer_id,
    debt_id,
    debt_amount_bs,
    debt_amount_usd,
    balance_bs,
    balance_usd
  FROM customer_debt_balance
  ORDER BY store_id, customer_id, debt_id
) TO STDOUT WITH CSV HEADER
"@

Write-Host "1. Exportando saldo de fiados (local docker)..." -ForegroundColor Cyan
$localRows = & docker exec -i la-caja-db psql -U postgres -d la_caja --command $query 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error al exportar datos locales: $localRows"
    exit 1
}
$localRows | Set-Content -Path $localCsv -Encoding UTF8

Write-Host "2. Exportando saldo de fiados (remoto Supabase)..." -ForegroundColor Cyan
$remoteRows = & docker run --rm postgres:17-alpine psql $ConnectionString --command $query 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error al exportar datos remotos: $remoteRows"
    exit 1
}
$remoteRows | Set-Content -Path $remoteCsv -Encoding UTF8

Write-Host "3. Comparando resultados..." -ForegroundColor Cyan
$localLines = Get-Content $localCsv
$remoteLines = Get-Content $remoteCsv
$diff = Compare-Object -ReferenceObject $localLines -DifferenceObject $remoteLines -IncludeEqual

if ($diff -and $diff.Count -gt 0) {
    $changes = $diff | Where-Object { $_.SideIndicator -ne "==" }
    if ($changes) {
        Write-Host "`nSe detectaron diferencias. Primeras 20 líneas:" -ForegroundColor Yellow
        $changes | Select-Object -First 20 | Format-Table -AutoSize
        Write-Host "`nArchivos CSV guardados en:"
        Write-Host "  Local : $localCsv"
        Write-Host "  Remoto: $remoteCsv"
        Write-Host "Puedes usar Excel o `diff` sobre esos CSV para investigar cada fila."
        exit 1
    }
}

Write-Host "`nNo se detectaron diferencias en `customer_debt_balance`." -ForegroundColor Green
Write-Host "CSV de respaldo (por si quieres revisar manualmente):"
Write-Host "  Local : $localCsv"
Write-Host "  Remoto: $remoteCsv"
