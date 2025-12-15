# Cacheo de Tasa BCV - Prioridad Máxima

## 🎯 Importancia

La tasa del Banco Central de Venezuela (BCV) es **uno de los valores más críticos** del sistema porque:

- ✅ Se usa en **todos los cálculos** de precios y ventas
- ✅ Se necesita en **múltiples componentes** (POS, Productos, Inventario, Deudas)
- ✅ Debe estar disponible **incluso offline**
- ✅ Es crítica para el funcionamiento del sistema

## 🚀 Estrategia de Cacheo Multi-Capa

### 1. React Query (Prioridad Máxima)

**QueryKey estandarizada:** `['exchange', 'bcv']`

**Configuración:**
- `staleTime`: 2 horas (la tasa cambia poco pero es crítica)
- `gcTime`: Infinity (NUNCA eliminar del cache)
- `refetchOnMount`: false (usar cache si existe)
- `refetchOnWindowFocus`: false (no refetch automático)

**Prefetch:**
- ✅ Se cachea **PRIMERO** después del login (prioridad máxima)
- ✅ Se cachea en todas las páginas que la necesitan
- ✅ Disponible instantáneamente en todos los componentes

### 2. IndexedDB (Persistencia Offline)

**Claves:**
- `bcv_exchange_rate` - Valor de la tasa
- `bcv_exchange_rate_timestamp` - Timestamp de cuando se obtuvo

**Características:**
- ✅ Persiste entre sesiones del navegador
- ✅ Disponible incluso si React Query se limpia
- ✅ Fallback automático cuando está offline
- ✅ Se actualiza automáticamente cuando se obtiene del API

### 3. Service Worker (Cache de API)

**Estrategia:** NetworkFirst con fallback a cache

**Configuración:**
- Cachea respuestas de API por 1 día
- Disponible incluso si IndexedDB falla
- Timeout de 2 segundos para detectar offline rápido

## 📋 Flujo de Cacheo

### Después del Login

1. **Paso 0 (Prioridad Máxima)**: Prefetch tasa BCV
   ```typescript
   await queryClient.prefetchQuery({
     queryKey: ['exchange', 'bcv'],
     queryFn: () => exchangeService.getBCVRate(),
     staleTime: 1000 * 60 * 60 * 2, // 2 horas
     gcTime: Infinity, // Nunca eliminar
   })
   ```

2. **Guardado en IndexedDB**: Automático cuando se obtiene del API
   ```typescript
   await db.kv.put({ key: 'bcv_exchange_rate', value: rate })
   await db.kv.put({ key: 'bcv_exchange_rate_timestamp', value: timestamp })
   ```

3. **Cache en Service Worker**: Automático para respuestas de API

### Cuando se Usa en Componentes

Todos los componentes usan la misma queryKey para aprovechar el cache:

```typescript
const { data: bcvRateData } = useQuery({
  queryKey: ['exchange', 'bcv'], // Misma key = mismo cache
  queryFn: () => exchangeService.getBCVRate(),
  staleTime: 1000 * 60 * 60 * 2,
  gcTime: Infinity,
})
```

**Componentes que usan la tasa:**
- ✅ `CheckoutModal` - Cálculo de totales y cambio
- ✅ `ProductFormModal` - Cálculo de precios en Bs
- ✅ `ChangePriceModal` - Cambio de precios
- ✅ `StockReceivedModal` - Cálculo de costos en Bs
- ✅ `AddPaymentModal` - Cálculo de abonos en Bs

## 🔄 Flujo Offline

### Cuando está Offline

1. **React Query**: Intenta usar cache (si existe)
2. **exchangeService.getBCVRate()**: Detecta offline automáticamente
3. **IndexedDB**: Obtiene tasa guardada
4. **Retorna**: Tasa del cache con mensaje "modo offline"

### Cuando Vuelve Internet

1. **React Query**: Refetch automático (si está stale)
2. **exchangeService**: Obtiene nueva tasa del API
3. **IndexedDB**: Actualiza tasa guardada
4. **React Query**: Actualiza cache

## ⚙️ Configuración Actual

### Prefetch (prefetch.service.ts)

```typescript
// PRIORIDAD MÁXIMA: Primera cosa que se cachea
await queryClient.prefetchQuery({
  queryKey: ['exchange', 'bcv'],
  queryFn: () => exchangeService.getBCVRate(),
  staleTime: 1000 * 60 * 60 * 2, // 2 horas
  gcTime: Infinity, // NUNCA eliminar
})
```

### Exchange Service (exchange.service.ts)

```typescript
// Guardado automático en IndexedDB
if (response.data.available && response.data.rate) {
  await db.kv.put({ key: 'bcv_exchange_rate', value: rate })
  await db.kv.put({ key: 'bcv_exchange_rate_timestamp', value: timestamp })
}
```

### Componentes

Todos usan la misma queryKey para compartir cache:
```typescript
queryKey: ['exchange', 'bcv'] // ✅ Estandarizada
```

## 🧪 Verificación

### Verificar Cache en React Query

```javascript
// En la consola del navegador
const cache = window.__REACT_QUERY_CLIENT__.getQueryCache()
const bcvQuery = cache.find({ queryKey: ['exchange', 'bcv'] })
console.log('Tasa BCV cacheada:', bcvQuery?.state?.data)
```

### Verificar Cache en IndexedDB

1. DevTools → Application → IndexedDB
2. `la-caja-db` → `kv` table
3. Buscar: `bcv_exchange_rate`

### Verificar Cache en Service Worker

1. DevTools → Application → Cache Storage
2. `api-cache`
3. Buscar respuesta de `/exchange/bcv`

## 📊 Rendimiento

### Tiempos de Cache

| Capa | Duración | Prioridad |
|------|----------|-----------|
| React Query | 2 horas (stale) / Infinity (gc) | ⭐⭐⭐ Máxima |
| IndexedDB | Permanente | ⭐⭐⭐ Máxima |
| Service Worker | 1 día | ⭐⭐ Alta |

### Beneficios

- ✅ **Carga instantánea** - Ya está cacheada después del login
- ✅ **Funciona offline** - Disponible desde IndexedDB
- ✅ **Sin duplicación** - Todos usan la misma queryKey
- ✅ **Actualización automática** - Se actualiza cuando vuelve internet
- ✅ **Robusto** - Múltiples capas de fallback

## ⚠️ Notas Importantes

- ⚠️ **Primera carga**: Necesita internet para obtener la tasa inicial
- ✅ **Después del login**: Se cachea automáticamente con prioridad máxima
- ✅ **Offline**: Funciona perfectamente usando IndexedDB
- ✅ **Actualización**: Se actualiza automáticamente cuando vuelve internet
- 🔄 **Estandarización**: Todos los componentes usan `['exchange', 'bcv']`

## 🚀 Mejoras Implementadas

1. ✅ **QueryKey estandarizada** - Todos usan `['exchange', 'bcv']`
2. ✅ **Prefetch con prioridad máxima** - Primera cosa que se cachea
3. ✅ **staleTime aumentado** - 2 horas (antes 1 hora)
4. ✅ **gcTime: Infinity** - Nunca se elimina del cache
5. ✅ **Logging mejorado** - Se loguea cuando se guarda en IndexedDB
6. ✅ **Múltiples capas** - React Query + IndexedDB + Service Worker

