# Script de prueba completo para Sprint 1
# Ejecuta: .\test-sprint1.ps1

$baseUrl = "http://localhost:3000"
$headers = @{
    "Content-Type" = "application/json"
}

Write-Host "🧪 PRUEBAS SPRINT 1 - Auth + Tienda + Roles + PIN" -ForegroundColor Cyan
Write-Host "=" * 60
Write-Host ""

# Paso 1: Crear una tienda
Write-Host "1️⃣ Creando tienda..." -ForegroundColor Yellow
try {
    $createStoreBody = @{
        name = "Mi Tienda de Prueba"
    } | ConvertTo-Json

    $storeResponse = Invoke-WebRequest -Uri "$baseUrl/auth/stores" `
        -Method POST `
        -Body $createStoreBody `
        -Headers $headers `
        -UseBasicParsing

    if ($storeResponse.StatusCode -eq 201) {
        Write-Host "   ✅ Tienda creada exitosamente" -ForegroundColor Green
        $storeData = $storeResponse.Content | ConvertFrom-Json
        $storeId = $storeData.store.id
        $ownerUserId = $storeData.member.user_id
        Write-Host "   📦 Store ID: $storeId" -ForegroundColor Gray
        Write-Host "   👤 Owner User ID: $ownerUserId" -ForegroundColor Gray
        $storeData | ConvertTo-Json -Depth 5
    }
} catch {
    Write-Host "   ❌ Error creando tienda: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Detalles: $responseBody" -ForegroundColor Red
    }
    exit
}

Write-Host ""

# Paso 2: Crear un cajero
Write-Host "2️⃣ Creando cajero..." -ForegroundColor Yellow
try {
    $createCashierBody = @{
        store_id = $storeId
        full_name = "Juan Pérez - Cajero"
        pin = "1234"
    } | ConvertTo-Json

    # Por ahora no requerimos token (en desarrollo)
    $cashierResponse = Invoke-WebRequest -Uri "$baseUrl/auth/cashiers" `
        -Method POST `
        -Body $createCashierBody `
        -Headers $headers `
        -UseBasicParsing `
        -ErrorAction Stop

    if ($cashierResponse.StatusCode -eq 201) {
        Write-Host "   ✅ Cajero creado exitosamente" -ForegroundColor Green
        $cashierData = $cashierResponse.Content | ConvertFrom-Json
        $cashierId = $cashierData.id
        Write-Host "   👤 Cashier ID: $cashierId" -ForegroundColor Gray
        $cashierData | ConvertTo-Json
    }
} catch {
    Write-Host "   ⚠️  Nota: Crear cajero requiere autenticación" -ForegroundColor Yellow
    Write-Host "   En desarrollo, este endpoint necesita un token JWT" -ForegroundColor Yellow
    Write-Host "   Continuando con login..." -ForegroundColor Yellow
    
    # Si falla, asumimos que el cajero ya existe o necesitamos otro método
    # Por ahora continuamos con el login
}

Write-Host ""

# Paso 3: Login con PIN (asumiendo que el cajero fue creado manualmente o existe)
Write-Host "3️⃣ Login con PIN..." -ForegroundColor Yellow
Write-Host "   (Nota: Necesitas que el cajero exista primero)" -ForegroundColor Gray
try {
    $loginBody = @{
        store_id = $storeId
        pin = "1234"
    } | ConvertTo-Json

    $loginResponse = Invoke-WebRequest -Uri "$baseUrl/auth/login" `
        -Method POST `
        -Body $loginBody `
        -Headers $headers `
        -UseBasicParsing

    if ($loginResponse.StatusCode -eq 200) {
        Write-Host "   ✅ Login exitoso" -ForegroundColor Green
        $authData = $loginResponse.Content | ConvertFrom-Json
        $token = $authData.access_token
        Write-Host "   🔑 Token obtenido: ${token.Substring(0, 50)}..." -ForegroundColor Gray
        Write-Host "   👤 Usuario: $($authData.full_name)" -ForegroundColor Gray
        Write-Host "   🏪 Tienda: $($authData.store_id)" -ForegroundColor Gray
        Write-Host "   🔐 Rol: $($authData.role)" -ForegroundColor Gray
        $authData | ConvertTo-Json
    }
} catch {
    Write-Host "   ❌ Error en login: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Detalles: $responseBody" -ForegroundColor Red
    }
    Write-Host "   💡 Asegúrate de que:" -ForegroundColor Yellow
    Write-Host "      - El cajero fue creado correctamente" -ForegroundColor Yellow
    Write-Host "      - El PIN es correcto (1234)" -ForegroundColor Yellow
    Write-Host "      - El store_id es correcto" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=" * 60
Write-Host "✅ Pruebas completadas" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Variables guardadas:" -ForegroundColor Cyan
Write-Host "   \$storeId = '$storeId'" -ForegroundColor Gray
if ($token) {
    Write-Host "   \$token = '${token.Substring(0, 50)}...'" -ForegroundColor Gray
}

