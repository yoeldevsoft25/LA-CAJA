# Script para compilar LA CAJA Desktop App para Windows
# Ejecutar desde la raiz del proyecto: .\build-desktop.ps1

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "🔨 Compilando LA CAJA Desktop App" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "apps\desktop")) {
    Write-Host "❌ Error: No se encuentra el directorio apps\desktop" -ForegroundColor Red
    Write-Host "   Ejecuta este script desde la raiz del proyecto" -ForegroundColor Yellow
    exit 1
}

# Verificar que Rust esta instalado
$cargoCheck = Get-Command cargo -ErrorAction SilentlyContinue
if (-not $cargoCheck) {
    Write-Host "❌ Error: Rust/Cargo no esta instalado" -ForegroundColor Red
    Write-Host "   Ejecuta primero: .\install-rust.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Rust encontrado: $(cargo --version)" -ForegroundColor Green
Write-Host ""

# Verificar que los iconos existen
$iconPath = "apps\desktop\src-tauri\icons\icon.ico"
if (-not (Test-Path $iconPath)) {
    Write-Host "⚠️  Iconos no encontrados. Generando iconos..." -ForegroundColor Yellow
    cd apps\desktop\src-tauri
    powershell -ExecutionPolicy Bypass -File generate-icons.ps1
    cd ..\..\..
    Write-Host ""
}

# Navegar al directorio de desktop
cd apps\desktop

Write-Host "📦 Instalando dependencias npm..." -ForegroundColor Cyan
npm install

Write-Host ""
Write-Host "🔨 Compilando aplicacion desktop..." -ForegroundColor Cyan
Write-Host "   Esto puede tardar varios minutos la primera vez..." -ForegroundColor Gray
Write-Host ""

# Compilar
npm run tauri:build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=" * 70 -ForegroundColor Green
    Write-Host "✅ Compilacion exitosa!" -ForegroundColor Green
    Write-Host "=" * 70 -ForegroundColor Green
    Write-Host ""
    Write-Host "📁 Archivos generados:" -ForegroundColor Cyan
    Write-Host "   Ejecutable: apps\desktop\src-tauri\target\release\la-caja-desktop.exe" -ForegroundColor White
    Write-Host "   Instalador: apps\desktop\src-tauri\target\release\bundle\nsis\la-caja-desktop_1.0.0_x64-setup.exe" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Error en la compilacion" -ForegroundColor Red
    Write-Host "   Revisa los mensajes de error arriba" -ForegroundColor Yellow
    exit 1
}

# Volver al directorio raiz
cd ..\..

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan

