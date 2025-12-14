# Script para generar iconos basicos usando .NET
Add-Type -AssemblyName System.Drawing

$iconsDir = "$PSScriptRoot\icons"
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir | Out-Null
}

Write-Host "Generando iconos basicos para LA CAJA..." -ForegroundColor Cyan

# Crear una imagen base simple (1024x1024)
$size = 1024
$bitmap = New-Object System.Drawing.Bitmap($size, $size)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

# Fondo azul
$graphics.Clear([System.Drawing.Color]::FromArgb(100, 108, 255))

# Texto blanco
$font = New-Object System.Drawing.Font("Arial", 200, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center

$graphics.DrawString("LA`nCAJA", $font, $brush, $size/2, $size/2, $format)

# Guardar imagen base
$baseImagePath = "$iconsDir\app-icon.png"
$bitmap.Save($baseImagePath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Imagen base creada: app-icon.png" -ForegroundColor Green

# Generar tamanos PNG
$sizes = @(32, 128, 256)
foreach ($s in $sizes) {
    $resized = New-Object System.Drawing.Bitmap($bitmap, $s, $s)
    if ($s -eq 256) {
        $resized.Save("$iconsDir\128x128@2x.png", [System.Drawing.Imaging.ImageFormat]::Png)
    } else {
        $resized.Save("$iconsDir\${s}x${s}.png", [System.Drawing.Imaging.ImageFormat]::Png)
    }
    $resized.Dispose()
    Write-Host "Icono ${s}x${s}.png creado" -ForegroundColor Green
}

# Crear icon.ico (Windows) - usar el bitmap de 256x256
$icoSize = 256
$icoBitmap = New-Object System.Drawing.Bitmap($bitmap, $icoSize, $icoSize)
$iconHandle = $icoBitmap.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($iconHandle)

# Guardar como ICO
$icoPath = "$iconsDir\icon.ico"
$fileStream = [System.IO.File]::OpenWrite($icoPath)
$icon.Save($fileStream)
$fileStream.Close()

Write-Host "icon.ico creado" -ForegroundColor Green

# Crear icon.icns placeholder (macOS) - copiar PNG como placeholder
Copy-Item "$iconsDir\app-icon.png" "$iconsDir\icon.icns" -ErrorAction SilentlyContinue
Write-Host "icon.icns creado (placeholder)" -ForegroundColor Yellow

# Limpiar recursos
$icon.Dispose()
$icoBitmap.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
$font.Dispose()
$brush.Dispose()

Write-Host ""
Write-Host "Iconos generados exitosamente en: $iconsDir" -ForegroundColor Green
Write-Host "Nota: icon.icns es un placeholder. Para macOS, genera el .icns correctamente." -ForegroundColor Yellow
