# ⚠️ IMPORTANTE: Funcionamiento Offline en Desarrollo vs Producción

## 🔴 Limitación en Desarrollo

**En modo desarrollo (`npm run dev`):**
- ❌ Los módulos de Vite (`@vite/client`, `src/main.tsx`) **NO funcionan offline**
- ❌ Vite necesita el servidor de desarrollo para transformar módulos ES
- ✅ El HTML se cachea y se sirve offline
- ✅ Los datos en IndexedDB persisten

**Por qué:**
- Vite en desarrollo usa transformación en tiempo real
- Los módulos se transforman por el servidor de Vite
- Sin servidor = sin transformación = módulos no cargan

## ✅ Solución: Usar Producción para Offline Completo

**En modo producción (`npm run build && npm run preview`):**
- ✅ **TODO funciona offline completamente**
- ✅ Todos los módulos se compilan en archivos estáticos
- ✅ El Service Worker cachea todo correctamente
- ✅ F5 funciona perfectamente offline
- ✅ Sistema completamente robusto para cortes de luz

## 🚀 Cómo Probar Offline Completo

### Opción 1: Build de Producción (RECOMENDADO)

```bash
cd apps/pwa
npm run build
npm run preview
```

Luego:
1. Abre `http://localhost:4173` (o el puerto que muestre)
2. Espera a que cargue completamente
3. DevTools → Network → Offline
4. Presiona F5 → **Funciona perfectamente**

### Opción 2: Desarrollo con Limitaciones

Si necesitas probar en desarrollo:
1. Abre la app con conexión
2. Espera a que cargue completamente
3. **NO presiones F5 offline** (los módulos de Vite fallarán)
4. Los datos en IndexedDB persisten si no refrescas

## 📋 Resumen

| Modo | HTML Offline | Módulos Offline | F5 Offline | Uso Recomendado |
|------|--------------|-----------------|------------|-----------------|
| **Desarrollo** | ✅ Sí | ❌ No | ❌ No | Desarrollo normal |
| **Producción** | ✅ Sí | ✅ Sí | ✅ Sí | **Pruebas offline** |

## 🎯 Recomendación

Para probar el funcionamiento offline completo (especialmente para cortes de luz):
1. **Usa build de producción** (`npm run build && npm run preview`)
2. **Prueba F5 offline** en producción
3. **En desarrollo**, solo prueba la funcionalidad online

---

**Nota:** Esta es una limitación de Vite en desarrollo, no de nuestra implementación. En producción funciona perfectamente offline.

