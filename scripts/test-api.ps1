# Script de prueba para verificar que el API funciona
# Ejecuta: .\test-api.ps1

Write-Host "🧪 Probando API de LA CAJA..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Health endpoint
Write-Host "1. Probando /health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ /health responde correctamente" -ForegroundColor Green
        $response.Content | ConvertFrom-Json | ConvertTo-Json
    }
} catch {
    Write-Host "   ❌ Error en /health: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Sync endpoint
Write-Host "2. Probando /sync/push..." -ForegroundColor Yellow
try {
    $body = @{
        store_id = "00000000-0000-0000-0000-000000000000"
        device_id = "11111111-1111-1111-1111-111111111111"
        client_version = "1.0.0"
        events = @()
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "http://localhost:3000/sync/push" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -UseBasicParsing

    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ /sync/push responde correctamente" -ForegroundColor Green
        $response.Content | ConvertFrom-Json | ConvertTo-Json
    }
} catch {
    Write-Host "   ❌ Error en /sync/push: $_" -ForegroundColor Red
    Write-Host "   Asegúrate de que el servidor esté corriendo: npm run dev:api" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "✅ Pruebas completadas" -ForegroundColor Green

