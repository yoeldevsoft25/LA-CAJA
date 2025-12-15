# Solución: Página se rompe al refrescar sin internet

## Problema

Cuando el usuario refresca la página (F5) sin conexión a internet, la aplicación se rompe.

## Causa

El Service Worker está usando `NetworkFirst` para la navegación, pero cuando está offline, puede que no esté sirviendo correctamente el `index.html` desde el caché.

## Solución Implementada

Se mejoró la configuración del Service Worker en `vite.config.ts`:

### Cambios Realizados

1. **Timeout más corto**: Reducido a 300ms para detectar offline más rápido
2. **Cachear errores de red**: El plugin ahora cachea respuestas con status 0 (offline)
3. **Mejor navigateFallback**: Configurado para servir `index.html` para todas las rutas SPA
4. **Precache mejorado**: Asegura que todos los assets estén en el precache

### Configuración Actualizada

- ✅ `networkTimeoutSeconds: 0.3` - Detecta offline en 300ms
- ✅ Plugin que cachea respuestas con status 0 (offline)
- ✅ `navigateFallback` mejorado para rutas SPA
- ✅ `globPatterns` expandido para incluir más tipos de archivos

## Pasos para Aplicar

1. **Hacer build y deploy**:
   ```bash
   cd apps/pwa
   npm run build
   ```

2. **Hacer deploy a Netlify** (o tu plataforma):
   - El build generará un nuevo Service Worker
   - Netlify desplegará automáticamente si está conectado a GitHub

3. **Limpiar caché del navegador** (importante):
   - Abre DevTools (F12)
   - Ve a **Application** → **Storage**
   - Haz clic en **Clear site data**
   - O simplemente haz **Hard Refresh** (Ctrl+Shift+R o Cmd+Shift+R)

4. **Probar offline**:
   - Abre la app con conexión
   - Espera a que cargue completamente
   - DevTools → Network → Offline
   - Presiona F5 → Debería funcionar

## Verificación

### En Producción (Netlify)

1. Abre https://la-caja.netlify.app
2. Espera a que cargue completamente (verifica que el Service Worker esté activo)
3. DevTools → Application → Service Workers → Verifica que esté "activated and running"
4. DevTools → Network → Offline
5. Presiona F5
6. ✅ La página debería cargar desde el caché

### Si aún no funciona

1. **Verifica el Service Worker**:
   - DevTools → Application → Service Workers
   - Debe estar "activated and running"
   - Si hay un Service Worker antiguo, haz clic en "Unregister" y recarga

2. **Verifica el caché**:
   - DevTools → Application → Cache Storage
   - Debe haber caches: `workbox-precache`, `html-cache`, `static-resources`
   - Verifica que `index.html` esté en `workbox-precache`

3. **Forzar actualización del Service Worker**:
   - DevTools → Application → Service Workers
   - Marca "Update on reload"
   - Recarga la página
   - Espera a que se actualice

## Notas Importantes

- ⚠️ **Primera carga**: La primera vez que abres la app, necesita conexión para descargar y cachear todo
- ✅ **Después de la primera carga**: Todo funciona offline, incluyendo F5
- 🔄 **Actualizaciones**: Cuando hay una nueva versión, el Service Worker se actualiza automáticamente
- 🧹 **Limpieza**: Si hay problemas, limpia el caché del navegador

## Troubleshooting

### Error: "Service Worker registration failed"

- Verifica que estés usando HTTPS (Netlify lo proporciona automáticamente)
- Verifica que no haya errores en la consola

### Error: "Failed to fetch" al refrescar

- El Service Worker puede no estar activo
- Desregistra y vuelve a registrar el Service Worker
- Limpia el caché del navegador

### La página carga pero sin estilos/scripts

- Verifica que los archivos JS/CSS estén en el precache
- DevTools → Application → Cache Storage → `workbox-precache`
- Debe haber archivos `.js` y `.css`

