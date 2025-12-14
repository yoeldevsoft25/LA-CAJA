# Script para copiar archivos de PWA a Desktop
# Ejecutar desde la raiz del proyecto: .\copy-pwa-to-desktop.ps1

$pwaSrc = "apps\pwa\src"
$desktopSrc = "apps\desktop\src"

$dirs = @("pages", "components", "services", "stores", "lib", "db", "utils")

Write-Host ""
Write-Host "Copiando archivos de PWA a Desktop..." -ForegroundColor Cyan
Write-Host ""

foreach ($dir in $dirs) {
    $src = Join-Path $pwaSrc $dir
    $dst = Join-Path $desktopSrc $dir
    
    if (Test-Path $src) {
        Write-Host "Copiando $dir..." -ForegroundColor Yellow
        
        # Eliminar destino si existe
        if (Test-Path $dst) {
            Remove-Item -Path $dst -Recurse -Force
        }
        
        # Copiar directorio
        Copy-Item -Path $src -Destination $dst -Recurse -Force
        Write-Host "  $dir copiado exitosamente" -ForegroundColor Green
    } else {
        Write-Host "  $dir no existe en PWA" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Proceso completado!" -ForegroundColor Green
Write-Host ""
Write-Host "Siguiente paso: cd apps\desktop && npm install" -ForegroundColor Cyan

