#!/bin/bash
# scripts/sync-from-remote.sh

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=== Migrador de Base de Datos (Cloud -> Local) ===${NC}"
echo "Este script clonará tu base de datos de producción (Supabase) a tu instancia local optimizada."
echo "⚠️  ADVERTENCIA: Esto SOBREESCRIBIRÁ tu base de datos local 'la_caja'."
echo ""

# 1. Verificar que Docker esté corriendo
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}Error: Docker no está corriendo.${NC}"
  echo "Por favor inicia Docker Desktop y vuelve a intentar."
  exit 1
fi

# 2. Obtener Connection String Remota
REMOTE_URL=$1
if [ -z "$REMOTE_URL" ]; then
  echo -e "Por favor, ingresa el **Connection String** de tu Supabase (Transaction Pooler o Session)."
  echo "Formato: postgres://postgres.xxxx:password@aws-0-region.pooler.supabase.com:5432/postgres"
  read -p "Connection String: " REMOTE_URL
fi

if [ -z "$REMOTE_URL" ]; then
  echo -e "${RED}Error: Connection String es requerido.${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}1. Probando conexión remota...${NC}"
# Usamos un contenedor temporal de postgres para probar conexión sin instalar cliente local
if docker run --rm -e PGPASSWORD=${REMOTE_URL##*:} postgres:15-alpine psql "$REMOTE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
   echo -e "${GREEN}Conexión exitosa.${NC}"
else
   # Intentamos sin extraer password (si viene en URL)
   if docker run --rm postgres:15-alpine psql "$REMOTE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
      echo -e "${GREEN}Conexión exitosa.${NC}"
   else
      echo -e "${RED}Error: No se pudo conectar a la base de datos remota.${NC}"
      echo "Verifica tus credenciales."
      exit 1
   fi
fi

echo ""
echo -e "${BLUE}2. Iniciando clonación (Pipe Stream)...${NC}"
echo "Esto puede tomar unos minutos dependiendo del tamaño de tu BD."

# Comando Mágico: pg_dump remoto | psql local
# Usamos docker para ambos extremos para garantizar compatibilidad de versiones y no depender del host.
# 1. Dump remoto (Alpine) -> Pipe
# 2. Restore local (ejecutado DENTRO del contenedor la-caja-db o vía docker exec)

# Opción A: Usar pg_dump desde un contenedor efímero y pipear a docker exec
# Eliminamos esquema public local primero para asegurar limpieza
echo "Limpiando esquema local 'public'..."
docker exec -i la-caja-db psql -U postgres -d la_caja -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "Descargando e importando..."
# Nota: Usamos --no-owner --no-acl para evitar problemas de permisos entre usuarios cloud vs local
docker run --rm -i postgres:15-alpine pg_dump "$REMOTE_URL" --no-owner --no-acl --format=custom | \
docker exec -i la-caja-db pg_restore -U postgres -d la_caja --no-owner --no-acl --clean --if-exists

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ ¡Migración Completada Exitosamente!${NC}"
  echo "Tu base de datos local ahora contiene los datos de producción."
  echo "Puedes conectar tu API localmente."
else
  echo ""
  echo -e "${RED}❌ Hubo un error durante la migración.${NC}"
  exit 1
fi
