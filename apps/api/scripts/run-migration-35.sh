#!/bin/bash

# =====================================================
# Script para ejecutar migración 35: Offline-First World-Class
# =====================================================

set -e

echo "🚀 Ejecutando migración 35: Offline-First World-Class"
echo ""

# Cargar DATABASE_URL desde .env
if [ -f .env ]; then
  export $(cat .env | grep DATABASE_URL | xargs)
else
  echo "❌ Error: Archivo .env no encontrado"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL no está configurado en .env"
  exit 1
fi

echo "✅ DATABASE_URL cargado"
echo ""

# Ejecutar migración
echo "📦 Ejecutando SQL migration..."
psql "$DATABASE_URL" -f src/database/migrations/35_offline_first_world_class.sql

echo ""
echo "✅ Migración completada exitosamente!"
echo ""
echo "📊 Verificando tablas creadas..."
psql "$DATABASE_URL" -c "\dt device_sync_state"
psql "$DATABASE_URL" -c "\dt sync_conflicts"
psql "$DATABASE_URL" -c "\dt sync_metrics"
psql "$DATABASE_URL" -c "\dt conflict_resolution_rules"

echo ""
echo "✅ Todas las tablas fueron creadas correctamente!"
echo ""
echo "🎉 ¡Migración 35 completada!"
