#!/bin/bash

# Script de deploy para producción local
# Uso: ./scripts/deploy-production.sh

set -e

echo "🚀 Iniciando deploy de LA-CAJA a producción..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ ERROR: Ejecutar desde la raíz del proyecto${NC}"
  exit 1
fi

# Verificar que PM2 está disponible vía npx
if ! npx pm2 --version &> /dev/null; then
  echo -e "${YELLOW}⚠️  PM2 no está disponible. Asegúrate de que esté instalado en las dependencias.${NC}"
  exit 1
fi

# Verificar que existe .env.production
if [ ! -f "apps/api/.env.production" ]; then
  echo -e "${YELLOW}⚠️  ADVERTENCIA: apps/api/.env.production no existe${NC}"
  echo -e "${YELLOW}   Usando apps/api/.env en su lugar${NC}"
fi

# 1. Pull de cambios (si hay git)
if [ -d ".git" ]; then
  echo -e "${GREEN}📥 Obteniendo últimos cambios de Git...${NC}"
  git pull origin main || echo -e "${YELLOW}⚠️  No se pudo hacer pull (continuando...)${NC}"
fi

# 2. Instalar dependencias
echo -e "${GREEN}📦 Instalando dependencias...${NC}"
npm install

# 3. Build de packages
echo -e "${GREEN}🔨 Compilando packages...${NC}"
npm run build:packages || echo -e "${YELLOW}⚠️  Algunos packages no se compilaron${NC}"

# 4. Build de API
echo -e "${GREEN}🔨 Compilando API...${NC}"
cd apps/api
npm run build
cd ../..

# 5. Verificar que el build fue exitoso
if [ ! -f "apps/api/dist/main.js" ]; then
  echo -e "${RED}❌ ERROR: Build falló - dist/main.js no existe${NC}"
  exit 1
fi

# 6. Crear directorio de logs si no existe
mkdir -p apps/api/logs

# 7. Reiniciar PM2
echo -e "${GREEN}🔄 Reiniciando aplicación con PM2...${NC}"
if npx pm2 list | grep -q "la-caja-api"; then
  # Si ya está corriendo, reiniciar
  npx pm2 restart la-caja-api --update-env
else
  # Si no está corriendo, iniciar
  cd apps/api
  npx pm2 start ecosystem.config.js --env production
  cd ../..
fi

# 8. Esperar a que la app esté lista
echo -e "${GREEN}⏳ Esperando a que la aplicación esté lista...${NC}"
sleep 5

# 9. Verificar health check
HEALTH_URL="http://localhost:3000/health"
if command -v curl &> /dev/null; then
  if curl -f -s "$HEALTH_URL" > /dev/null; then
    echo -e "${GREEN}✅ Health check exitoso${NC}"
  else
    echo -e "${YELLOW}⚠️  Health check falló (la app puede estar iniciando)${NC}"
  fi
fi

# 10. Mostrar estado
echo ""
echo -e "${GREEN}📊 Estado de PM2:${NC}"
npx pm2 status

echo ""
echo -e "${GREEN}✅ Deploy completado exitosamente!${NC}"
echo ""
echo "Comandos útiles:"
echo "  npx pm2 logs la-caja-api          # Ver logs"
echo "  npx pm2 monit                     # Monitor en tiempo real"
echo "  npx pm2 restart la-caja-api       # Reiniciar"
echo "  npx pm2 stop la-caja-api          # Detener"
