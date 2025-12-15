# Sistema de Caché Inteligente - LA CAJA

## 🚀 Características

Sistema de caché super agresivo y robusto que cachea **TODO** después del login para máximo rendimiento offline.

### ✅ Lo que se cachea automáticamente:

1. **Productos** (500 productos activos)
   - Cacheado en React Query
   - Cacheado en IndexedDB para persistencia offline
   - Se usa en POS y Productos

2. **Clientes**
   - Cacheado en React Query
   - Se usa en Ventas, Deudas y Clientes

3. **Sesión de Caja Actual**
   - Cacheado en React Query
   - Se usa en POS y Caja

4. **Tasa de Cambio BCV**
   - Cacheado en React Query (1 hora de staleTime)
   - Se usa en múltiples lugares (ventas, productos, etc.)

5. **Ventas Recientes** (últimas 50)
   - Cacheado en React Query
   - Se usa en Ventas

6. **Deudas Activas**
   - Cacheado en React Query
   - Se usa en Deudas

7. **Estado de Inventario**
   - Cacheado en React Query
   - Se usa en Inventario

8. **Sesiones de Caja** (últimas 20)
   - Cacheado en React Query
   - Se usa en Caja

## 🎯 Estrategias de Caché

### 1. Service Worker (Workbox)

- **Assets estáticos**: CacheFirst (1 año)
- **HTML/Navegación**: NetworkFirst con fallback rápido (300ms timeout)
- **API Responses**: NetworkFirst con caché de 1 día
- **Módulos JS/CSS**: CacheFirst (1 año)

### 2. React Query

- **staleTime**: 30 minutos (datos frescos por más tiempo)
- **gcTime**: 24 horas (mantener en caché mucho tiempo)
- **refetchOnWindowFocus**: false (no refetch automático)
- **refetchOnMount**: false (usar caché si existe)
- **refetchOnReconnect**: true (refetch cuando vuelve internet)

### 3. IndexedDB

- **Productos**: Cacheados persistentemente
- **Datos offline**: Persisten entre sesiones
- **Sincronización**: Se sincroniza cuando vuelve internet

## 📋 Cuándo se Ejecuta el Prefetch

### Después del Login

Cuando el usuario hace login exitosamente, se ejecuta `prefetchAllData()` en background:

```typescript
// Se ejecuta automáticamente después del login
prefetchAllData({
  storeId: data.store_id,
  queryClient,
  onProgress: (progress, message) => {
    // Log silencioso - no molesta al usuario
  },
})
```

**Características:**
- ✅ No bloquea la navegación
- ✅ Se ejecuta en background
- ✅ Silencioso (no molesta al usuario)
- ✅ Cachea todos los datos críticos

### Durante la Navegación

Cuando el usuario navega entre páginas, se ejecuta `prefetchPageData()`:

```typescript
// Se ejecuta automáticamente al cambiar de página
useEffect(() => {
  const page = pathToPage[location.pathname]
  if (page) {
    prefetchPageData(page, user.store_id, queryClient)
  }
}, [location.pathname])
```

**Características:**
- ✅ Prefetch específico por página
- ✅ No bloquea la UI
- ✅ Cachea datos que se usarán en esa página

## 🔧 Configuración

### QueryClient (main.tsx)

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 30, // 30 minutos
      gcTime: 1000 * 60 * 60 * 24, // 24 horas
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false,
    },
  },
})
```

### Service Worker (vite.config.ts)

```typescript
// Cache de API
{
  urlPattern: ({ url }) => url.origin.includes('onrender.com'),
  handler: 'NetworkFirst',
  options: {
    cacheName: 'api-cache',
    expiration: {
      maxEntries: 500,
      maxAgeSeconds: 60 * 60 * 24, // 1 día
    },
  },
}
```

## 📊 Rendimiento

### Tiempos de Caché

| Recurso | Estrategia | Duración |
|---------|-----------|----------|
| Assets estáticos | CacheFirst | 1 año |
| HTML | NetworkFirst | 1 año |
| API Responses | NetworkFirst | 1 día |
| React Query | Configurable | 30 min - 24 horas |
| IndexedDB | Persistente | Permanente |

### Beneficios

- ✅ **Carga instantánea** después del primer uso
- ✅ **Funciona completamente offline** después del login
- ✅ **Máximo rendimiento** - todo está cacheado
- ✅ **Robusto** - múltiples capas de caché
- ✅ **Inteligente** - prefetch automático

## 🧪 Pruebas

### Probar el Prefetch

1. Abre la consola del navegador
2. Haz login
3. Verás: `[Prefetch] ✅ Cacheo completo`
4. Navega entre páginas - todo carga instantáneamente

### Probar Offline

1. Haz login (con internet)
2. Espera a que se complete el prefetch
3. DevTools → Network → Offline
4. Navega entre páginas - todo funciona
5. Presiona F5 - la página carga desde caché

## 🔍 Debugging

### Ver qué está cacheado

**React Query:**
```typescript
// En la consola del navegador
window.__REACT_QUERY_CLIENT__.getQueryCache().getAll()
```

**Service Worker:**
- DevTools → Application → Cache Storage
- Ver: `workbox-precache`, `api-cache`, `html-cache`, `static-resources`

**IndexedDB:**
- DevTools → Application → IndexedDB
- Ver: `la-caja-db`

## ⚠️ Notas Importantes

- ⚠️ **Primera carga**: Necesita internet para descargar y cachear todo
- ✅ **Después del login**: Todo se cachea automáticamente en background
- ✅ **Navegación**: Prefetch automático de datos por página
- ✅ **Offline**: Funciona completamente después del primer uso
- 🔄 **Actualización**: Los datos se actualizan cuando vuelve internet

## 🚀 Mejoras Futuras

- [ ] Prefetch de imágenes y assets pesados
- [ ] Cachear respuestas de reportes
- [ ] Prefetch de datos de modales antes de abrirlos
- [ ] Compresión de datos en IndexedDB
- [ ] Limpieza automática de caché antiguo

