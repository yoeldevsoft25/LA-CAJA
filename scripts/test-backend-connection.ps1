# Script para probar la conexión del backend después de configurar Supabase

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "🧪 Probando conexión del backend a Supabase" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Verificar que el .env existe
$envPath = "apps\api\.env"
if (-not (Test-Path $envPath)) {
    Write-Host "❌ Error: No se encontró el archivo $envPath" -ForegroundColor Red
    exit 1
}

# Verificar DATABASE_URL
$databaseUrl = (Get-Content $envPath | Select-String "^DATABASE_URL=").ToString()
if ($databaseUrl -match "localhost") {
    Write-Host "⚠️  ADVERTENCIA: DATABASE_URL todavía apunta a localhost!" -ForegroundColor Yellow
    Write-Host "   URL actual: $databaseUrl" -ForegroundColor Gray
    Write-Host ""
    Write-Host "💡 Debes actualizar el .env con tu connection string de Supabase" -ForegroundColor Cyan
    Write-Host "   Ejecuta: .\update-env-supabase.ps1 'TU_CONNECTION_STRING'" -ForegroundColor White
    Write-Host ""
    exit 1
}

if ($databaseUrl -match "supabase") {
    Write-Host "✅ DATABASE_URL configurado para Supabase" -ForegroundColor Green
    Write-Host "   $databaseUrl" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "⚠️  DATABASE_URL no parece ser de Supabase" -ForegroundColor Yellow
    Write-Host "   $databaseUrl" -ForegroundColor Gray
    Write-Host ""
}

# Iniciar el backend
Write-Host "🚀 Iniciando backend..." -ForegroundColor Cyan
Write-Host ""
Write-Host "   Busca este mensaje de éxito:" -ForegroundColor Yellow
Write-Host "   ✓ [InstanceLoader] TypeOrmModule dependencies initialized" -ForegroundColor Green
Write-Host ""
Write-Host "   Si ves errores de conexión, verifica:" -ForegroundColor Yellow
Write-Host "   1. Tu connection string en .env es correcta" -ForegroundColor Gray
Write-Host "   2. Las migraciones están ejecutadas en Supabase" -ForegroundColor Gray
Write-Host "   3. Tu contraseña de Supabase es correcta" -ForegroundColor Gray
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

npm run dev:api
