# Script para actualizar DATABASE_URL con Supabase
# Uso: .\update-env-supabase.ps1 "postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres"

param(
    [Parameter(Mandatory=$true)]
    [string]$DatabaseUrl
)

$envPath = "apps\api\.env"

if (-not (Test-Path $envPath)) {
    Write-Host "❌ Error: No se encontró el archivo $envPath" -ForegroundColor Red
    Write-Host "💡 Crea el archivo .env primero con el contenido mínimo:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "DATABASE_URL=$DatabaseUrl" -ForegroundColor Cyan
    Write-Host "JWT_SECRET=tu-secret-key-super-seguro-minimo-32-caracteres-cambiar-en-produccion" -ForegroundColor Cyan
    Write-Host "JWT_EXPIRES_IN=7d" -ForegroundColor Cyan
    Write-Host "PORT=3000" -ForegroundColor Cyan
    Write-Host "NODE_ENV=development" -ForegroundColor Cyan
    exit 1
}

Write-Host "📝 Actualizando DATABASE_URL en $envPath..." -ForegroundColor Cyan

# Leer el archivo
$content = Get-Content $envPath

# Buscar y reemplazar DATABASE_URL
$updated = $false
$newContent = $content | ForEach-Object {
    if ($_ -match "^DATABASE_URL=") {
        $updated = $true
        "DATABASE_URL=$DatabaseUrl"
    } else {
        $_
    }
}

# Si no se encontró DATABASE_URL, agregarlo al principio
if (-not $updated) {
    $newContent = @("DATABASE_URL=$DatabaseUrl", "") + $newContent
}

# Escribir el archivo actualizado
$newContent | Set-Content $envPath

Write-Host "✅ DATABASE_URL actualizado exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "Nueva configuración:" -ForegroundColor Yellow
Write-Host "DATABASE_URL=$DatabaseUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔄 Ahora puedes reiniciar el backend con: npm run dev:api" -ForegroundColor Green
