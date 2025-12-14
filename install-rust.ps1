# Script para instalar Rust en Windows
# Ejecutar: .\install-rust.ps1

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "🔧 Instalación de Rust para LA CAJA Desktop" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Verificar si Rust ya está instalado
$cargoPath = Get-Command cargo -ErrorAction SilentlyContinue
if ($cargoPath) {
    Write-Host "✅ Rust ya está instalado!" -ForegroundColor Green
    cargo --version
    rustc --version
    exit 0
}

Write-Host "📥 Descargando rustup-init.exe..." -ForegroundColor Yellow

# Crear directorio temporal si no existe
$tempDir = "$env:TEMP\rust-install"
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir | Out-Null
}

$rustupPath = "$tempDir\rustup-init.exe"

# Descargar rustup-init
try {
    Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile $rustupPath -UseBasicParsing
    Write-Host "✅ Descarga completada" -ForegroundColor Green
} catch {
    Write-Host "❌ Error al descargar rustup-init: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Alternativa: Descarga manual desde https://rustup.rs/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "🚀 Ejecutando instalador..." -ForegroundColor Yellow
Write-Host "   (Se abrirá una ventana. Presiona Enter para continuar con la instalación por defecto)" -ForegroundColor Gray
Write-Host ""

# Ejecutar rustup-init
Start-Process -FilePath $rustupPath -Wait -NoNewWindow

# Esperar un momento para que se actualice el PATH
Start-Sleep -Seconds 2

# Recargar variables de entorno
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Verificar instalación
Write-Host ""
Write-Host "🔍 Verificando instalación..." -ForegroundColor Yellow

$cargoCheck = Get-Command cargo -ErrorAction SilentlyContinue
if ($cargoCheck) {
    Write-Host "✅ Rust instalado correctamente!" -ForegroundColor Green
    cargo --version
    rustc --version
    Write-Host ""
    Write-Host "💡 IMPORTANTE: Si cargo no se encuentra, cierra y vuelve a abrir PowerShell" -ForegroundColor Yellow
    Write-Host "   o reinicia tu terminal para que se actualice el PATH." -ForegroundColor Yellow
} else {
    Write-Host "⚠️  Rust se instaló, pero cargo no está en el PATH actual." -ForegroundColor Yellow
    Write-Host "   Por favor, cierra y vuelve a abrir PowerShell, luego ejecuta:" -ForegroundColor Yellow
    Write-Host "   cargo --version" -ForegroundColor White
}

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan

