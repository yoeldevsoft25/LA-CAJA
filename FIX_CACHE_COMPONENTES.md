# Solución: Datos no cargan automáticamente del cache

## Problema

El prefetch se ejecuta y muestra "Cacheo completo", pero cuando el usuario navega a cada página, los datos están vacíos (excepto POS y Productos).

## Causa

Las **queryKeys** del prefetch no coincidían exactamente con las que usan los componentes, por lo que React Query no podía encontrar el cache.

## Solución Implementada

### 1. Ajuste de QueryKeys del Prefetch

Se ajustaron las queryKeys del prefetch para que coincidan con las que usan los componentes:

**Clientes:**
- Prefetch: `['customers', '']` y `['customers']`
- Componente: `['customers', searchQuery]` → Usa `['customers', '']` cuando searchQuery es ''

**Deudas:**
- Prefetch: `['debts', undefined]` (para statusFilter 'all')
- Componente: `['debts', statusFilter === 'all' ? undefined : statusFilter]` → Coincide

**Ventas:**
- Prefetch: `['sales', 'list', storeId, { limit: 50 }]`
- Componente: Usa placeholderData cuando es primera página sin filtros

**Caja:**
- Prefetch: `['cash', 'current-session']` y `['cash', 'sessions', storeId]`
- Componente: Coincide exactamente

### 2. Uso de placeholderData

Todos los componentes ahora usan `placeholderData` para obtener datos del cache del prefetch:

```typescript
// Obtener datos del prefetch
const prefetchedData = queryClient.getQueryData(['queryKey', 'del', 'prefetch'])

// Usar en la query
const { data } = useQuery({
  queryKey: ['queryKey', 'del', 'componente'],
  queryFn: () => service.getData(),
  placeholderData: prefetchedData, // ✅ Usa cache del prefetch
  staleTime: 1000 * 60 * 30,
  gcTime: Infinity,
  refetchOnMount: false, // ✅ No refetch si hay cache
})
```

### 3. Configuración Mejorada

Todos los componentes ahora tienen:
- ✅ `placeholderData` del prefetch
- ✅ `staleTime` configurado (30 min - 2 horas)
- ✅ `gcTime: Infinity` (nunca eliminar)
- ✅ `refetchOnMount: false` (usar cache si existe)

## Componentes Actualizados

### CustomersPage
- ✅ Usa `placeholderData` de `['customers', '']`
- ✅ Funciona cuando searchQuery es ''

### DebtsPage
- ✅ Usa `placeholderData` de `['debts', undefined]`
- ✅ Funciona cuando statusFilter es 'all'

### SalesPage
- ✅ Usa `placeholderData` de prefetch cuando es primera página sin filtros
- ✅ Muestra últimas 50 ventas del prefetch

### CashPage
- ✅ Usa `placeholderData` de `['cash', 'current-session']`
- ✅ CashSessionsList usa cache de primera página

### InventoryPage
- ✅ Usa `placeholderData` de `['inventory', 'status', storeId]`

## Verificación

Después del login:

1. **Prefetch se ejecuta** → Log: `[Prefetch] ✅ Cacheo completo`
2. **Navegar a Customers** → Debe mostrar clientes inmediatamente (del cache)
3. **Navegar a Deudas** → Debe mostrar deudas inmediatamente (del cache)
4. **Navegar a Ventas** → Debe mostrar últimas 50 ventas (del cache)
5. **Navegar a Caja** → Debe mostrar sesión actual (del cache)

## Si Aún No Funciona

1. **Verificar cache en React Query:**
   ```javascript
   // En la consola del navegador
   const cache = window.__REACT_QUERY_CLIENT__.getQueryCache()
   cache.getAll().forEach(q => console.log(q.queryKey, q.state.data))
   ```

2. **Verificar que el prefetch se ejecutó:**
   - Debe aparecer: `[Prefetch] ✅ Cacheo completo`
   - Si no aparece, el prefetch no se ejecutó

3. **Verificar queryKeys:**
   - Las queryKeys del prefetch deben coincidir exactamente con las del componente
   - O usar `placeholderData` para mapear entre diferentes keys

## Notas

- ⚠️ **Primera carga**: Necesita internet para hacer el prefetch
- ✅ **Después del login**: Todo se cachea automáticamente
- ✅ **Navegación**: Los datos aparecen instantáneamente del cache
- ✅ **Actualización**: Los datos se actualizan en background cuando hay internet

