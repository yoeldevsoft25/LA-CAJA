# Script para detener todos los procesos de Node.js

Write-Host "Deteniendo todos los procesos de Node.js..." -ForegroundColor Yellow
Write-Host ""

# Obtener todos los procesos de Node
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue

if ($nodeProcesses.Count -eq 0) {
    Write-Host "[OK] No hay procesos de Node.js ejecutandose" -ForegroundColor Green
    exit 0
}

Write-Host "Procesos encontrados: $($nodeProcesses.Count)" -ForegroundColor Cyan
$nodeProcesses | ForEach-Object {
    Write-Host "   PID: $($_.Id) - CPU: $($_.CPU) - Memoria: $([math]::Round($_.WorkingSet / 1MB, 2)) MB" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Intentando detener procesos..." -ForegroundColor Yellow

# Metodo 1: Stop-Process
$nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2

# Verificar si quedan procesos
$remaining = Get-Process node -ErrorAction SilentlyContinue

if ($remaining) {
    Write-Host "Algunos procesos no se detuvieron, usando taskkill..." -ForegroundColor Yellow
    
    # Metodo 2: taskkill
    taskkill /F /IM node.exe 2>$null | Out-Null
    
    Start-Sleep -Seconds 2
    
    # Verificar de nuevo
    $stillRemaining = Get-Process node -ErrorAction SilentlyContinue
    
    if ($stillRemaining) {
        Write-Host ""
        Write-Host "[ERROR] Aun quedan procesos activos (pueden requerir permisos de administrador):" -ForegroundColor Red
        $stillRemaining | ForEach-Object {
            Write-Host "   PID: $($_.Id) - Memoria: $([math]::Round($_.WorkingSet / 1MB, 2)) MB" -ForegroundColor Yellow
        }
        Write-Host ""
        Write-Host "Opciones:" -ForegroundColor Cyan
        Write-Host "   1. Ejecuta este script como Administrador" -ForegroundColor White
        Write-Host "   2. Deten los procesos manualmente desde el Administrador de Tareas" -ForegroundColor White
        Write-Host "   3. Reinicia tu computadora si es necesario" -ForegroundColor White
    } else {
        Write-Host "[OK] Todos los procesos de Node.js han sido detenidos exitosamente" -ForegroundColor Green
    }
} else {
    Write-Host "[OK] Todos los procesos de Node.js han sido detenidos exitosamente" -ForegroundColor Green
}

Write-Host ""
