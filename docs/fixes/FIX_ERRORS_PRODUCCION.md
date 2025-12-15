# Solución a Errores en Producción

## Errores Encontrados

1. ❌ **Error crítico de Workbox**: Conflicto en el precache de `index.html`
2. ❌ **Icono PWA faltante**: `pwa-192x192.png` no existe
3. ⚠️ **Advertencias de accesibilidad**: Algunos diálogos pueden tener problemas

## Soluciones Implementadas

### 1. Error de Workbox - Conflicto en Precache

**Error:**
```
add-to-cache-list-conflicting-entries: [{"firstEntry":"index.html?__WB_REVISION__=...","secondEntry":"index.html"}]
```

**Causa:** Se estaba agregando `index.html` manualmente al precache, pero Workbox ya lo detecta automáticamente.

**Solución:** Eliminada la entrada manual de `index.html` en `additionalManifestEntries`.

**Cambio en `vite.config.ts`:**
```typescript
// ANTES (causaba conflicto):
additionalManifestEntries: [
  { url: '/index.html', revision: null },
],

// DESPUÉS (corregido):
// NO agregar index.html manualmente - Workbox lo detecta automáticamente
```

### 2. Icono PWA Faltante

**Error:**
```
Error while trying to use the following icon from the Manifest: 
https://la-caja.netlify.app/pwa-192x192.png (Download error or resource isn't a valid image)
```

**Causa:** Los archivos `pwa-192x192.png` y `pwa-512x512.png` no existen en el proyecto.

**Solución:** Cambiado el manifest para usar `favicon.svg` que sí existe.

**Cambio en `vite.config.ts`:**
```typescript
// ANTES:
icons: [
  { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
  { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
],

// DESPUÉS:
icons: [
  {
    src: '/favicon.svg',
    sizes: 'any',
    type: 'image/svg+xml',
    purpose: 'any maskable',
  },
],
```

### 3. Advertencias de Accesibilidad

**Advertencia:**
```
`DialogContent` requires a `DialogTitle` for the component to be accessible
```

**Estado:** Todos los diálogos revisados tienen `DialogTitle`. Si persiste el error, puede ser de algún componente que se renderiza condicionalmente. El error es una advertencia, no crítico.

## Pasos para Aplicar

1. **Hacer build:**
   ```bash
   cd apps/pwa
   npm run build
   ```

2. **Commit y push:**
   ```bash
   git add .
   git commit -m "fix: corregir errores de Workbox y manifest PWA"
   git push
   ```

3. **Netlify desplegará automáticamente**

4. **Limpiar caché del navegador:**
   - DevTools (F12) → Application → Storage → Clear site data
   - O Hard Refresh (Ctrl+Shift+R / Cmd+Shift+R)

5. **Verificar:**
   - Abre https://la-caja.netlify.app
   - DevTools → Console
   - No debería haber errores de Workbox
   - No debería haber errores de iconos PWA

## Verificación

### ✅ Error de Workbox
- DevTools → Console
- No debe aparecer: `add-to-cache-list-conflicting-entries`
- Service Worker debe estar activo sin errores

### ✅ Iconos PWA
- DevTools → Application → Manifest
- Debe mostrar el icono `favicon.svg`
- No debe haber errores de descarga

### ✅ Service Worker
- DevTools → Application → Service Workers
- Debe estar "activated and running"
- No debe haber errores en la consola

## Notas

- ⚠️ **Primera carga**: Después del deploy, la primera carga puede tardar un poco mientras se actualiza el Service Worker
- 🔄 **Actualización automática**: El Service Worker se actualiza automáticamente cuando hay cambios
- 🧹 **Limpieza**: Si hay problemas, limpia el caché del navegador

## Si Persisten Errores

1. **Desregistrar Service Worker:**
   - DevTools → Application → Service Workers
   - Haz clic en "Unregister"
   - Recarga la página

2. **Limpiar caché:**
   - DevTools → Application → Cache Storage
   - Elimina todos los caches
   - Recarga la página

3. **Verificar build:**
   - Verifica que el build se completó correctamente
   - Revisa los logs de Netlify

