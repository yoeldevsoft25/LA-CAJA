#!/bin/bash

# Script para probar el sistema offline
# Este script construye la app en producción y la sirve para pruebas offline

echo "🔨 Construyendo aplicación en modo producción..."
cd apps/pwa
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
echo "📋 Pasos para probar offline completo:"
echo ""
echo "1. Cargar la app con conexión:"
echo "   - Abre http://localhost:4173"
echo "   - Espera a que cargue completamente"
echo "   - Verifica que el Service Worker esté registrado (DevTools → Application → Service Workers)"
echo ""
echo "2. Probar funcionamiento offline:"
echo "   - Abre Chrome DevTools → Network → Activa 'Offline'"
echo "   - Presiona F5 varias veces"
echo "   - La app debe cargar correctamente cada vez"
echo "   - Los datos en IndexedDB deben persistir"
echo ""
echo "3. Probar sincronización de eventos:"
echo "   - Con la app offline, crea una venta o modifica un producto"
echo "   - Verifica en DevTools → Application → IndexedDB → LaCajaDB → localEvents"
echo "   - Debe haber eventos con sync_status: 'pending'"
echo "   - Desactiva 'Offline' en Network"
echo "   - Los eventos deben sincronizarse automáticamente"
echo ""
echo "4. Probar cache de datos:"
echo "   - Con conexión, navega a la lista de productos/clientes"
echo "   - Activa 'Offline'"
echo "   - Refresca la página o navega a productos/clientes"
echo "   - Deben mostrarse desde cache"
echo ""
echo "5. Probar Background Sync (si está disponible):"
echo "   - Crea eventos offline"
echo "   - Cierra la pestaña"
echo "   - Activa conexión"
echo "   - Abre DevTools → Application → Background Sync"
echo "   - Debe haber un tag 'sync-events' registrado"
echo ""
echo "⚠️  NOTA: En desarrollo (npm run dev) el offline es limitado"
echo "   porque Vite necesita el servidor para transformar módulos."
echo "   En producción (este script) funciona perfectamente offline."
echo ""
echo "📚 Para más detalles, ver: docs/testing/OFFLINE_TESTING_GUIDE.md"
echo ""

npm run preview -- --host 0.0.0.0

