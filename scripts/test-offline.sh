#!/bin/bash

# Script para probar el sistema offline
# Este script construye la app en producción y la sirve para pruebas offline

echo "🔨 Construyendo aplicación en modo producción..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Error al construir la aplicación"
  exit 1
fi

echo ""
echo "✅ Build completado exitosamente"
echo ""
echo "🚀 Iniciando servidor de preview..."
echo "📱 Abre http://localhost:4173 en tu navegador"
echo ""
echo "📋 Pasos para probar offline:"
echo "   1. Espera a que la app cargue completamente"
echo "   2. Abre Chrome DevTools → Network → Offline"
echo "   3. Presiona F5 varias veces"
echo "   4. La app debe cargar correctamente cada vez"
echo ""
echo "⚠️  NOTA: En desarrollo (npm run dev) el offline es limitado"
echo "   porque Vite necesita el servidor para transformar módulos."
echo "   En producción (este script) funciona perfectamente offline."
echo ""

npm run preview -- --host 0.0.0.0

