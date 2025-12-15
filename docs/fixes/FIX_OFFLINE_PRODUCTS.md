# ✅ Fix: Productos Disponibles Offline

## 🐛 Problema Identificado

Los productos desaparecían cuando la aplicación estaba offline porque:
- Los productos se cargaban **solo desde el API**
- No se guardaban en IndexedDB
- Cuando estaba offline, React Query no podía hacer la petición
- No había datos locales disponibles

## ✅ Solución Implementada

### 1. **Tabla de Productos en IndexedDB**

**Archivo modificado:** `apps/pwa/src/db/database.ts`

- Agregada tabla `products` en IndexedDB
- Agregadas tablas `customers` y `sales` para futuro uso
- Migración automática de Dexie (versión 3)

**Schema:**
```typescript
products: 'id, store_id, name, category, barcode, sku, is_active, [store_id+is_active], [store_id+category]'
```

### 2. **Servicio de Cache Local**

**Archivo creado:** `apps/pwa/src/services/products-cache.service.ts`

**Funcionalidades:**
- `cacheProducts()` - Guarda múltiples productos
- `cacheProduct()` - Guarda un producto individual
- `getProductsFromCache()` - Obtiene productos del cache con filtros
- `getProductByIdFromCache()` - Obtiene un producto por ID
- `cleanupOldCache()` - Limpia productos antiguos

### 3. **Servicio de Productos Mejorado**

**Archivo modificado:** `apps/pwa/src/services/products.service.ts`

**Lógica implementada:**

#### Cuando está **OFFLINE**:
```typescript
if (!isOnline && storeId) {
  // Usar cache local directamente
  return cachedProducts;
}
```

#### Cuando está **ONLINE**:
```typescript
// 1. Obtener del API
const response = await api.get('/products');

// 2. Guardar en cache para uso futuro offline
await productsCacheService.cacheProducts(response.data, storeId);

// 3. Retornar datos del API
return response.data;
```

#### Fallback si falla la petición:
```typescript
catch (error) {
  // Si es error de red y hay cache, usar cache
  if (error.code === 'ERR_NETWORK' && storeId) {
    return cachedProducts;
  }
  throw error;
}
```

### 4. **Actualización de Componentes**

**Archivos modificados:**
- `apps/pwa/src/pages/ProductsPage.tsx` - Pasa `storeId` a `search()`
- `apps/pwa/src/pages/POSPage.tsx` - Pasa `storeId` a `search()`
- `apps/pwa/src/pages/InventoryPage.tsx` - Pasa `storeId` a `search()`
- `apps/pwa/src/components/products/ProductFormModal.tsx` - Pasa `storeId` a mutaciones
- `apps/pwa/src/components/products/ChangePriceModal.tsx` - Pasa `storeId` a `changePrice()`
- `apps/pwa/src/components/inventory/StockReceivedModal.tsx` - Pasa `storeId` a `search()`

**Todas las mutaciones ahora actualizan el cache:**
- `create()` - Guarda producto nuevo en cache
- `update()` - Actualiza producto en cache
- `deactivate()` - Actualiza estado en cache
- `activate()` - Actualiza estado en cache
- `changePrice()` - Actualiza precios en cache

---

## 🚀 Cómo Funciona Ahora

### Flujo Online:
1. Usuario busca productos → Petición al API
2. API retorna productos → Se guardan en IndexedDB
3. UI muestra productos del API
4. Si se pierde conexión → Productos siguen disponibles desde cache

### Flujo Offline:
1. Usuario busca productos → Se consulta IndexedDB
2. Se retornan productos del cache local
3. UI muestra productos (sin indicar que son del cache)
4. Usuario puede seguir trabajando normalmente

### Sincronización:
- Cuando vuelve la conexión, se obtienen productos actualizados del API
- El cache se actualiza automáticamente
- Los productos nuevos/actualizados se guardan en cache

---

## 📋 Próximos Pasos (Opcional)

### 1. Cache para Otros Datos
- [ ] Clientes (customers)
- [ ] Ventas (sales) - para historial rápido
- [ ] Sesiones de caja
- [ ] Inventario/Stock

### 2. Invalidación Inteligente de Cache
- Invalidar cache cuando se crean/actualizan productos
- TTL (Time To Live) para productos antiguos
- Sincronización incremental (solo cambios)

### 3. Indicador Visual
- Mostrar badge "Offline" cuando se usan datos del cache
- Indicar última actualización del cache

---

## 🧪 Cómo Probar

### 1. Probar Cache Offline
```bash
# 1. Abre la app y navega a Productos (debe cargar del API)
# 2. En Chrome DevTools → Network → Selecciona "Offline"
# 3. Recarga la página o busca productos
# 4. Los productos deberían seguir apareciendo (desde cache)
```

### 2. Verificar Cache en IndexedDB
```javascript
// En la consola del navegador:
import { db } from '@/db/database';
const products = await db.products.toArray();
console.log('Productos en cache:', products.length);
```

### 3. Probar Actualización de Cache
```bash
# 1. Crea un producto nuevo (online)
# 2. Ve offline
# 3. El producto nuevo debería aparecer en la lista
```

---

## ⚠️ Notas Importantes

1. **Primera carga:** La primera vez que se usa la app, no habrá productos en cache. Debe haber conexión inicial.

2. **Sincronización:** Los productos se actualizan cuando:
   - Se hace una búsqueda online
   - Se crea/actualiza un producto
   - Se cambia el precio

3. **Límites:** El cache no tiene límite de tamaño por ahora. Se puede agregar cleanup automático de productos antiguos.

4. **Compatibilidad:** La migración de Dexie es automática. Los usuarios existentes no perderán datos.

---

**Fecha de implementación:** $(date)
**Estado:** ✅ Completado



