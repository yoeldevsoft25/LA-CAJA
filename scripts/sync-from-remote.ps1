<#
.SYNOPSIS
    Clona la base de datos remota (Supabase) a la instancia local Docker.
.DESCRIPTION
    Este script realiza un dump de la base de datos remota y lo restaura inmediatamente
    en el contenedor local 'la-caja-db', sobreescribiendo los datos existentes.
.PARAMETER ConnectionString
    La cadena de conexión de postgres remota (ej: postgres://user:pass@host:5432/db).
#>
param (
    [Parameter(Mandatory=$false)]
    [string]$ConnectionString
)

Write-Host "=== Migrador de Base de Datos (Cloud -> Local) ===" -ForegroundColor Cyan
Write-Host "Este script clonará tu base de datos de producción a tu instancia local."
Write-Host "⚠️  ADVERTENCIA: Se perderán los datos locales actuales en 'la_caja'." -ForegroundColor Yellow
Write-Host ""

# 1. Verificar Docker
if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
    Write-Error "Docker no está instalado o no está en el PATH."
    exit 1
}

$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker no está corriendo. Por favor inicia Docker Desktop."
    exit 1
}

# 2. Solicitar Connection String si no se proveyó
if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    Write-Host "Por favor, ingresa el **Connection String** de Supabase (Transaction Pooler o Session)."
    Write-Host "Formato: postgres://postgres.xxxx:password@aws-0-region.pooler.supabase.com:5432/postgres"
    $ConnectionString = Read-Host "Connection String"
}

if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    Write-Error "Connection String es requerido."
    exit 1
}

# 3. Probar Conexión
Write-Host "`n1. Probando conexión remota..." -ForegroundColor Cyan
try {
    # Usamos docker para probar conexión (pg_isready o simple query)
    # Extraemos password para evitar warning de seguridad en linea de comando si es posible, 
    # pero para simplicidad en windows usaremos la variable de entorno dentro del comando docker
    
    # Truco: Pasar la URL completa a psql
    docker run --rm postgres:15-alpine psql "$ConnectionString" -c "SELECT 1;" | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Conexión exitosa." -ForegroundColor Green
    } else {
        throw "No se pudo conectar"
    }
} catch {
    Write-Error "Error: No se pudo conectar a la base de datos remota. Verifica tus credenciales."
    exit 1
}

# 4. Iniciar Migración (Pipe)
Write-Host "`n2. Iniciando clonación (Pipe Stream)..." -ForegroundColor Cyan
Write-Host "Esto puede tomar unos minutos..."

# Limpiar esquema local
Write-Host "Limpiando esquema local 'public'..." -ForegroundColor Gray
docker exec -i la-caja-db psql -U postgres -d la_caja -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Error limpiando la base de datos local. ¿Está corriendo el contenedor 'la-caja-db'?"
    exit 1
}

Write-Host "Descargando e importando..." -ForegroundColor Gray

# Comando Pipe en PowerShell
# Nota: PowerShell maneja pipes de texto diferente a bash/sh. 
# Para binary pipes seguros entre procesos docker, cmd /c es a veces más fiable, 
# pero intentaremos la sintaxis nativa de PS primero o un workaround si falla.
# El problema de PS es que puede corromper encoding binario.
# USANDO CMD /C para garantizar el pipe binario crudo que pg_dump custom format necesita.

$dumpCmd = "docker run --rm -i postgres:15-alpine pg_dump ""$ConnectionString"" --no-owner --no-acl --format=custom"
$restoreCmd = "docker exec -i la-caja-db pg_restore -U postgres -d la_caja --no-owner --no-acl --clean --if-exists"

cmd /c "$dumpCmd | $restoreCmd"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ ¡Migración Completada Exitosamente!" -ForegroundColor Green
    Write-Host "Tu base de datos local ahora es un clon de producción."
} else {
    Write-Error "`n❌ Hubo un error durante la migración."
    exit 1
}
