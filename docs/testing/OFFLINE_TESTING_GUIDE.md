# Guía de Testing Offline-First

Esta guía describe cómo probar la funcionalidad offline-first de LA CAJA de manera sistemática y reproducible.

## Requisitos Previos

1. **Build de producción**: El testing offline completo requiere un build de producción
   ```bash
   cd apps/pwa
   npm run build
   npm run preview
   ```

2. **Navegador moderno**: Chrome/Edge (recomendado) o Firefox con soporte para:
   - Service Workers
   - IndexedDB
   - Background Sync API (Chrome/Edge)

3. **DevTools abiertos**: Necesarios para verificar estado y simular offline

## Configuración Inicial

### 1. Cargar la App con Conexión

```bash
# Opción 1: Usar el script de testing
cd scripts
./test-offline.sh

# Opción 2: Manual
cd apps/pwa
npm run build
npm run preview
```

1. Abre `http://localhost:4173` en el navegador
2. Espera a que la app cargue completamente
3. Verifica que el Service Worker esté registrado:
   - DevTools → Application → Service Workers
   - Debe mostrar "activated and is running"

## Testing Escenarios

### Escenario 1: Funcionamiento Offline Básico

**Objetivo**: Verificar que la app carga y funciona sin conexión

**Pasos**:
1. Con la app cargada y funcionando:
   - Abre DevTools → Network
   - Activa el checkbox "Offline"
2. Presiona F5 para recargar la página
3. Verifica:
   - ✅ La app carga correctamente
   - ✅ No aparece la página de error de Chrome
   - ✅ Los datos guardados previamente están disponibles

**Criterios de Éxito**:
- La app funciona completamente offline
- No se pierden datos al refrescar
- El Service Worker sirve los assets desde cache

### Escenario 2: Sincronización de Eventos Offline

**Objetivo**: Verificar que los eventos creados offline se sincronizan al volver la conexión

**Pasos**:
1. Con la app funcionando:
   - DevTools → Network → Activa "Offline"
2. Crea eventos offline (ejemplos):
   - Crear una venta (POS Page)
   - Modificar un producto
   - Crear un cliente
3. Verifica en IndexedDB:
   - DevTools → Application → IndexedDB → LaCajaDB → localEvents
   - Los eventos deben tener `sync_status: 'pending'`
4. Activa conexión:
   - DevTools → Network → Desactiva "Offline"
5. Verifica sincronización:
   - Los eventos deben desaparecer de "pending" o cambiar a "synced"
   - En DevTools Console debe aparecer: `[SyncService] ✅ Sincronización completada`

**Criterios de Éxito**:
- Los eventos se guardan localmente cuando hay offline
- Se sincronizan automáticamente al volver la conexión
- No se pierden eventos durante el periodo offline

### Escenario 3: Cache de Datos Críticos

**Objetivo**: Verificar que productos y clientes están disponibles offline

**Pasos**:
1. Con conexión:
   - Navega a la lista de productos
   - Navega a la lista de clientes
   - Espera a que carguen completamente
2. Activa offline:
   - DevTools → Network → Activa "Offline"
3. Verifica acceso offline:
   - Navega nuevamente a productos/clientes
   - Deben mostrarse desde cache
   - Buscar debe funcionar con datos en cache
4. Verifica en IndexedDB:
   - DevTools → Application → IndexedDB → LaCajaDB
   - Debe haber entradas en `products` y `customers`

**Criterios de Éxito**:
- Los datos críticos están disponibles offline
- La búsqueda funciona con datos en cache
- Los datos se actualizan cuando vuelve la conexión

### Escenario 4: Background Sync (Opcional)

**Objetivo**: Verificar que los eventos se sincronizan cuando la app está cerrada

**Prerequisitos**: Chrome/Edge (Firefox no soporta Background Sync)

**Pasos**:
1. Con la app funcionando:
   - DevTools → Network → Activa "Offline"
2. Crea algunos eventos (ventas, modificaciones)
3. Verifica Background Sync registrado:
   - DevTools → Application → Background Sync
   - Debe aparecer un tag `sync-events`
4. Cierra la pestaña completamente
5. Activa conexión:
   - DevTools → Network → Desactiva "Offline"
6. Espera unos segundos
7. Abre la app nuevamente
8. Verifica:
   - Los eventos se sincronizaron mientras la app estaba cerrada
   - En IndexedDB, los eventos deben estar marcados como "synced"

**Criterios de Éxito**:
- Los eventos se sincronizan incluso cuando la app está cerrada
- Background Sync API funciona correctamente

### Escenario 5: Resolución de Conflictos

**Objetivo**: Verificar el manejo de conflictos de sincronización

**Pasos**:
1. Abre la app en dos dispositivos/dispositivos diferentes
2. En ambos dispositivos, modifica el mismo producto offline
3. Activa conexión en ambos
4. Verifica:
   - Si hay conflictos, deben aparecer en `/conflicts`
   - Debes poder resolver conflictos manualmente
5. Resuelve un conflicto:
   - Selecciona "Mantener mi versión" o "Usar versión del servidor"
   - El conflicto debe marcarse como resuelto

**Criterios de Éxito**:
- Los conflictos se detectan correctamente
- La UI de conflictos muestra los conflictos pendientes
- La resolución de conflictos funciona end-to-end

## Verificaciones en DevTools

### Application → Service Workers

- **Status**: Debe estar "activated and is running"
- **Update on reload**: Útil para desarrollo
- **Bypass for network**: Desactivado para testing offline

### Application → IndexedDB → LaCajaDB

**Tablas importantes**:
- `localEvents`: Eventos pendientes de sincronización
  - Verificar `sync_status`: 'pending', 'synced', 'failed'
- `products`: Productos cacheados
- `customers`: Clientes cacheados
- `conflicts`: Conflictos pendientes

### Application → Cache Storage

- `workbox-precache-*`: Assets precacheados
- `html-cache`: HTML cacheado
- `api-cache`: Respuestas de API cacheadas

### Application → Background Sync (Chrome/Edge)

- Debe mostrar tags `sync-events` cuando hay eventos pendientes offline

### Console

**Logs importantes**:
- `[SyncService]`: Estado de sincronización
- `[Cache]`: Hits/misses de cache
- `[SW]`: Service Worker logs

## Comandos Útiles en Console

```javascript
// Verificar estado de sincronización
import { syncService } from '@/services/sync.service';
console.log(syncService.getStatus());

// Forzar sincronización
await syncService.syncNow();

// Ver eventos pendientes en IndexedDB
import { db } from '@/db/database';
const pending = await db.localEvents
  .where('sync_status')
  .equals('pending')
  .toArray();
console.log('Pendientes:', pending);

// Verificar Service Worker
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('SW registrado:', reg);
  console.log('SW activo:', reg?.active);
});

// Verificar cache
caches.keys().then(names => {
  console.log('Caches:', names);
});
```

## Troubleshooting

### La app no carga offline

**Causas posibles**:
- El Service Worker no está registrado
- El build no se hizo correctamente
- Los assets no están precacheados

**Solución**:
1. Verifica Service Worker en DevTools → Application → Service Workers
2. Si no está registrado, recarga la página
3. Verifica que el build incluye todos los assets

### Los eventos no se sincronizan

**Causas posibles**:
- No hay conexión cuando se intenta sincronizar
- Errores de validación en el backend
- Problemas con autenticación

**Solución**:
1. Verifica conexión: `navigator.onLine`
2. Revisa errores en Console
3. Verifica que el token de autenticación esté guardado
4. Revisa Network tab para ver las peticiones fallidas

### Los datos no aparecen en cache

**Causas posibles**:
- La app no ha cargado los datos aún
- El cache se limpió
- Problemas con IndexedDB

**Solución**:
1. Con conexión, navega a las páginas que cargan datos
2. Verifica en IndexedDB que los datos estén guardados
3. Si no están, verifica errores en Console

### Background Sync no funciona

**Causas posibles**:
- El navegador no soporta Background Sync (solo Chrome/Edge)
- Los permisos no están concedidos
- El Service Worker no está activo

**Solución**:
1. Usa Chrome o Edge
2. Verifica permisos de notificaciones (a veces requerido)
3. Verifica que el Service Worker esté activo

## Notas Importantes

1. **Desarrollo vs Producción**:
   - En desarrollo (`npm run dev`), el offline es limitado
   - Vite necesita el servidor para transformar módulos
   - Siempre prueba offline con build de producción

2. **Limpiar Cache**:
   - Si necesitas empezar desde cero:
     - DevTools → Application → Clear Storage → Clear site data

3. **Service Worker Updates**:
   - Los cambios en el Service Worker requieren recarga completa
   - Usa "Update on reload" en DevTools para desarrollo

4. **IndexedDB Quotas**:
   - IndexedDB tiene límites de almacenamiento
   - Verifica cuota: `navigator.storage.estimate().then(console.log)`

## Recursos Adicionales

- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
