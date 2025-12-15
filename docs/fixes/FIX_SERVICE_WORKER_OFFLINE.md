# ✅ Fix: Service Worker para Funcionamiento Offline Completo

## 🐛 Problema Identificado

Cuando presionas F5 sin internet, aparece la página de error de Chrome "ERR_INTERNET_DISCONNECTED" en lugar de la aplicación. Esto ocurre porque:

1. **Service Worker solo en producción:** El Service Worker estaba deshabilitado en desarrollo
2. **HTML no cacheado:** El navegador intenta cargar el HTML desde el servidor
3. **Sin fallback:** No hay Service Worker que intercepte la petición y sirva desde cache

## ✅ Solución Implementada

### 1. **Habilitar Service Worker en Desarrollo**

**Archivo modificado:** `apps/pwa/vite.config.ts`

**Cambios:**
- Habilitado `devOptions.enabled: true` para que el Service Worker funcione en desarrollo
- Configurado `devOptions.type: 'module'` para desarrollo moderno
- Agregado `navigateFallback` en devOptions

### 2. **Configuración de Cache para HTML**

**Estrategia implementada:**
- **NetworkFirst** para documentos HTML
- Cachea incluso errores de red (status 0) para soporte offline
- **CacheFirst** para recursos estáticos (JS, CSS, imágenes)

**Configuración:**
```typescript
runtimeCaching: [
  {
    urlPattern: ({ request }) => request.destination === 'document',
    handler: 'NetworkFirst',
    options: {
      cacheName: 'html-cache',
      cacheableResponse: {
        statuses: [0, 200], // Cachear incluso errores de red
      },
    },
  },
]
```

### 3. **navigateFallback Configurado**

- `navigateFallback: '/index.html'` - Sirve index.html cuando falla la navegación
- `navigateFallbackDenylist` - Excluye archivos estáticos y rutas de API

### 4. **Ajuste en main.tsx**

**Archivo modificado:** `apps/pwa/src/main.tsx`

**Cambios:**
- Eliminado código que desregistraba Service Workers en desarrollo
- Ahora solo limpia Service Workers de scopes diferentes (para evitar conflictos)

---

## 🚀 Cómo Funciona Ahora

### Flujo al Recargar OFFLINE:

1. **Usuario presiona F5** → Navegador intenta cargar HTML
2. **Service Worker intercepta** → Detecta que está offline
3. **Sirve desde cache** → Retorna index.html cacheado
4. **App se carga** → React se monta y carga datos desde IndexedDB
5. **Usuario puede trabajar** → Todo funciona normalmente

### Flujo al Recargar ONLINE:

1. **Usuario presiona F5** → Navegador intenta cargar HTML
2. **Service Worker intercepta** → Intenta cargar desde red
3. **Actualiza cache** → Guarda nueva versión en cache
4. **App se carga** → Con datos frescos del API

---

## 📋 Pasos para Probar

### 1. Reconstruir la Aplicación

```bash
cd apps/pwa
npm run build
# O si estás en desarrollo:
npm run dev
```

### 2. Verificar Service Worker

1. Abre Chrome DevTools → Application → Service Workers
2. Deberías ver el Service Worker registrado
3. Verifica que esté "activated and running"

### 3. Probar Offline

1. **Con conexión:** Abre la app (debe cargar normalmente)
2. **En DevTools:** Network → Offline
3. **Presiona F5:** La app debería cargar desde cache
4. **Resultado:** No debería aparecer la página de error de Chrome

### 4. Verificar Cache

En Chrome DevTools → Application → Cache Storage:
- Deberías ver `html-cache` con index.html
- Deberías ver `static-resources` con JS/CSS

---

## ⚠️ Notas Importantes

1. **Primera carga:** La primera vez que abres la app, debe haber conexión para que el Service Worker cachee el HTML.

2. **Actualización:** El Service Worker se actualiza automáticamente cuando hay cambios.

3. **Limpieza de cache:** Si necesitas limpiar el cache:
   - DevTools → Application → Clear Storage
   - O usa el archivo `public/clear-cache.html`

4. **Desarrollo vs Producción:**
   - En desarrollo: Service Worker funciona pero puede ser más lento
   - En producción: Service Worker está completamente optimizado

---

## 🔧 Configuración Técnica

### Workbox Runtime Caching

- **HTML (documentos):** NetworkFirst → Intenta red primero, fallback a cache
- **Estáticos (JS/CSS/imágenes):** CacheFirst → Usa cache primero, actualiza en background

### Cache Names

- `html-cache`: HTML y documentos
- `static-resources`: JS, CSS, imágenes, fuentes

### Expiración

- HTML: 24 horas, máximo 10 entradas
- Estáticos: 7 días, máximo 100 entradas

---

**Fecha de implementación:** $(date)
**Estado:** ✅ Completado

