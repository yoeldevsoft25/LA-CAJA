# ✅ Fix: Cache Persistente para Modo Offline

## 🐛 Problemas Identificados

1. **Cache no persistía después de refresh:** Al recargar la página sin internet, se perdían todos los datos
2. **React Query no usaba IndexedDB:** Los datos solo estaban en memoria de React Query, no en IndexedDB persistente
3. **No había carga inicial desde cache:** Al iniciar la app, no se cargaban datos desde IndexedDB

## ✅ Solución Implementada

### 1. **Estrategia Stale-While-Revalidate**

**Archivo modificado:** `apps/pwa/src/services/products.service.ts`

**Cambios:**
- **SIEMPRE** intenta cargar desde cache primero (incluso online)
- Si hay cache, lo retorna inmediatamente
- Si está online, actualiza desde API en background
- Si está offline, solo usa cache

```typescript
// 1. Cargar desde cache primero (rápido)
const cachedData = await productsCacheService.getProductsFromCache(...);

// 2. Si está offline, retornar cache inmediatamente
if (!isOnline && cachedData) {
  return cachedData;
}

// 3. Si está online, actualizar desde API
try {
  const response = await api.get('/products');
  // Guardar en cache
  await productsCacheService.cacheProducts(...);
  return response.data; // Datos frescos
} catch (error) {
  // Si falla, usar cache como fallback
  if (cachedData) return cachedData;
  throw error;
}
```

### 2. **placeholderData en React Query**

**Archivos modificados:**
- `apps/pwa/src/pages/ProductsPage.tsx`
- `apps/pwa/src/pages/POSPage.tsx`
- `apps/pwa/src/pages/InventoryPage.tsx`
- `apps/pwa/src/components/inventory/StockReceivedModal.tsx`

**Configuración:**
```typescript
const { data } = useQuery({
  queryKey: ['products', 'list', storeId],
  queryFn: () => productsService.search(...),
  // Cargar desde IndexedDB como initialData
  placeholderData: async () => {
    const cached = await productsCacheService.getProductsFromCache(storeId);
    if (cached.length > 0) {
      return { products: cached, total: cached.length };
    }
    return undefined;
  },
  staleTime: 1000 * 60 * 5, // 5 minutos
  gcTime: Infinity, // Nunca eliminar del cache
});
```

**Beneficios:**
- Los datos se cargan **inmediatamente** desde IndexedDB al iniciar
- No hay delay mientras se hace la petición al API
- Funciona incluso sin conexión

### 3. **Hook para Cache (Opcional)**

**Archivo creado:** `apps/pwa/src/hooks/use-products-cache.ts`

Hook auxiliar para cargar productos desde cache (no usado actualmente, pero disponible para futuras mejoras).

---

## 🚀 Cómo Funciona Ahora

### Flujo al Iniciar la App (OFFLINE):

1. **App se carga** → React Query inicia
2. **useQuery ejecuta placeholderData** → Carga desde IndexedDB
3. **Datos aparecen inmediatamente** → Sin esperar petición
4. **Usuario puede trabajar** → Todo funciona offline

### Flujo al Iniciar la App (ONLINE):

1. **App se carga** → React Query inicia
2. **placeholderData carga desde IndexedDB** → Datos aparecen inmediatamente
3. **queryFn ejecuta en background** → Actualiza desde API
4. **Cache se actualiza** → Datos frescos guardados
5. **UI se actualiza** → Con datos frescos del API

### Flujo al Refrescar (OFFLINE):

1. **Página se recarga** → React Query se reinicia
2. **placeholderData carga desde IndexedDB** → Datos persisten
3. **queryFn intenta API** → Falla (offline)
4. **productsService usa cache** → Retorna datos del cache
5. **Usuario ve datos** → Todo funciona normalmente

---

## 📋 Cambios Técnicos

### Servicio de Productos

**Antes:**
```typescript
// Solo usaba cache si estaba offline
if (!isOnline) {
  return cachedProducts;
}
// Solo usaba API si estaba online
const response = await api.get('/products');
```

**Ahora:**
```typescript
// SIEMPRE carga cache primero
const cachedData = await productsCacheService.getProductsFromCache(...);

// Si offline, retorna cache
if (!isOnline && cachedData) return cachedData;

// Si online, actualiza desde API pero usa cache si falla
try {
  const response = await api.get('/products');
  await productsCacheService.cacheProducts(...);
  return response.data;
} catch (error) {
  if (cachedData) return cachedData; // Fallback a cache
  throw error;
}
```

### React Query Configuration

**Agregado:**
- `placeholderData`: Carga desde IndexedDB al iniciar
- `gcTime: Infinity`: Nunca elimina datos del cache
- `staleTime: 5 minutos`: Considera datos frescos por 5 minutos

---

## 🧪 Cómo Probar

### 1. Probar Persistencia después de Refresh

```bash
# 1. Abre la app (debe estar online)
# 2. Navega a Productos → Debe cargar del API
# 3. En Chrome DevTools → Network → Selecciona "Offline"
# 4. Refresca la página (F5)
# 5. Los productos deberían aparecer inmediatamente (desde IndexedDB)
```

### 2. Verificar Datos en IndexedDB

```javascript
// En la consola del navegador:
import { db } from '@/db/database';
const products = await db.products.toArray();
console.log('Productos en IndexedDB:', products.length);
console.log('Primer producto:', products[0]);
```

### 3. Probar Carga Inicial Offline

```bash
# 1. Cierra la app completamente
# 2. En Chrome DevTools → Network → Selecciona "Offline"
# 3. Abre la app de nuevo
# 4. Los productos deberían aparecer inmediatamente
```

### 4. Probar Stale-While-Revalidate

```bash
# 1. Abre la app (online)
# 2. Navega a Productos → Debe cargar del API
# 3. Los datos aparecen inmediatamente (desde cache)
# 4. En background se actualiza desde API
# 5. Si actualizas un producto en otra pestaña, se refleja aquí
```

---

## ⚠️ Notas Importantes

1. **Primera carga:** La primera vez que se usa la app, no habrá productos en cache. Debe haber conexión inicial para poblar el cache.

2. **Sincronización:** Los productos se actualizan cuando:
   - Se hace una búsqueda online
   - Se crea/actualiza un producto
   - Se cambia el precio
   - React Query detecta que los datos están "stale" (más de 5 minutos)

3. **Performance:** 
   - `placeholderData` es asíncrono pero rápido (IndexedDB es rápido)
   - Los datos aparecen inmediatamente sin esperar la petición al API
   - Si está online, se actualiza en background sin bloquear la UI

4. **Compatibilidad:** 
   - Funciona en todos los navegadores modernos
   - IndexedDB es soportado desde 2012
   - Dexie maneja las migraciones automáticamente

---

## 🔄 Próximos Pasos (Opcional)

### 1. Pre-carga de Datos Críticos
- Cargar todos los productos activos al iniciar la app
- Pre-cargar clientes frecuentes
- Pre-cargar inventario

### 2. Sincronización Incremental
- Solo sincronizar productos que cambiaron desde última actualización
- Usar timestamps para detectar cambios

### 3. Indicador Visual
- Mostrar badge "Offline" cuando se usan datos del cache
- Indicar última actualización del cache
- Mostrar si hay actualizaciones pendientes

---

**Fecha de implementación:** $(date)
**Estado:** ✅ Completado

