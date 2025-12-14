# Script para iniciar backend y frontend en modo desarrollo con acceso desde la red local

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Gray
Write-Host "🚀 LA CAJA - Desarrollo con Acceso desde Red Local" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Gray
Write-Host ""

# Obtener IP local
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notlike "*Loopback*" -and 
    $_.IPAddress -notlike "169.254.*" -and
    $_.IPAddress -notlike "192.168.*" -or $_.IPAddress -like "192.168.*"
} | Select-Object -First 1).IPAddress

if (-not $ip) {
    $ip = "localhost"
}

Write-Host "📍 Tu IP local: $ip" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔧 URLs de acceso:" -ForegroundColor Cyan
Write-Host "   Frontend (PWA): http://$ip`:5173" -ForegroundColor White
Write-Host "   Backend (API):  http://$ip`:3000" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  IMPORTANTE:" -ForegroundColor Yellow
Write-Host "   1. Asegúrate de que tu móvil esté en la misma red WiFi" -ForegroundColor Gray
Write-Host "   2. Actualiza la variable VITE_API_URL si es necesario" -ForegroundColor Gray
Write-Host "   3. Para cambiar la IP del API, edita: apps/pwa/src/lib/api.ts" -ForegroundColor Gray
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Gray
Write-Host ""

# Iniciar backend
Write-Host "📦 Iniciando Backend (puerto 3000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; npm run dev:api" -WindowStyle Normal

# Esperar un poco antes de iniciar el frontend
Start-Sleep -Seconds 3

# Iniciar frontend
Write-Host "📦 Iniciando Frontend (puerto 5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; npm run dev:pwa" -WindowStyle Normal

Write-Host ""
Write-Host "✅ Servidores iniciados en ventanas separadas" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Accede desde tu móvil usando:" -ForegroundColor Yellow
Write-Host "   http://$ip`:5173" -ForegroundColor White
Write-Host ""

