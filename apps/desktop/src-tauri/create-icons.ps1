# Script para crear iconos basicos para Tauri
# Este script crea iconos placeholder simples

$iconsDir = "$PSScriptRoot\icons"
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir | Out-Null
}

Write-Host "Creando iconos basicos para LA CAJA..." -ForegroundColor Cyan

# Verificar si ImageMagick esta disponible
$magick = Get-Command magick -ErrorAction SilentlyContinue

if ($magick) {
    Write-Host "ImageMagick encontrado, generando iconos..." -ForegroundColor Green
    
    # Crear una imagen base simple
    magick -size 1024x1024 xc:"#646cff" -pointsize 200 -fill white -gravity center -annotate +0+0 "LA`nCAJA" "$iconsDir\app-icon.png"
    
    # Generar los iconos necesarios
    magick "$iconsDir\app-icon.png" -resize 32x32 "$iconsDir\32x32.png"
    magick "$iconsDir\app-icon.png" -resize 128x128 "$iconsDir\128x128.png"
    magick "$iconsDir\app-icon.png" -resize 256x256 "$iconsDir\128x128@2x.png"
    
    # Crear icon.ico (Windows) - multiples tamanos
    magick "$iconsDir\app-icon.png" -define icon:auto-resize=256,128,64,32,16 "$iconsDir\icon.ico"
    
    Write-Host "Iconos creados exitosamente!" -ForegroundColor Green
} else {
    Write-Host "ImageMagick no esta instalado" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Usando Tauri icon generator..." -ForegroundColor Cyan
    Write-Host "Para generar iconos correctamente:" -ForegroundColor Yellow
    Write-Host "  1. Crear app-icon.png (1024x1024px) en este directorio" -ForegroundColor Gray
    Write-Host "  2. Ejecutar: npm run tauri icon" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Creando iconos placeholder minimos..." -ForegroundColor Yellow
    
    # Por ahora, vamos a usar el comando de Tauri para generar iconos
    # Pero primero necesitamos una imagen base
    Write-Host "Ejecutando: npm run tauri icon (requiere app-icon.png)" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Iconos en: $iconsDir" -ForegroundColor Cyan
