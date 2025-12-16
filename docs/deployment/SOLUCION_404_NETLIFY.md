# 🔧 Solución para Error 404 en Netlify

## Problema
Netlify muestra "Page not found" para todas las rutas excepto la raíz.

## Causa
Las aplicaciones React Router (SPA) necesitan redirecciones para que todas las rutas apunten a `index.html`.

## Solución Implementada

He creado **3 archivos de configuración** para asegurar que funcione:

### 1. `netlify.toml` en la raíz del proyecto ✅
### 2. `apps/pwa/netlify.toml` ✅
### 3. `apps/pwa/public/_redirects` ✅ (Método más confiable)

## Pasos para Solucionar

### Opción 1: Verificar Configuración en Netlify Dashboard (Recomendado)

1. **Ve a tu sitio en [Netlify Dashboard](https://app.netlify.com)**

2. **Ve a Site settings → Build & deploy → Build settings**

3. **Verifica que esté configurado así:**
   - **Base directory:** `apps/pwa`
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `apps/pwa/dist`

4. **Si está diferente, actualízalo y guarda**

5. **Ve a Deploys → Trigger deploy → Deploy site**

### Opción 2: Verificar que el archivo `_redirects` se copie

El archivo `apps/pwa/public/_redirects` debe copiarse automáticamente al `dist/` durante el build.

**Para verificar:**
1. Haz un build local:
   ```bash
   cd apps/pwa
   npm run build
   ```

2. Verifica que existe `dist/_redirects`:
   ```bash
   ls dist/_redirects
   ```

3. Si no existe, el contenido debe ser:
   ```
   /*    /index.html   200
   ```

### Opción 3: Configuración Manual en Netlify

Si los archivos de configuración no funcionan, configura manualmente:

1. **En Netlify Dashboard → Site settings → Build & deploy → Build settings**

2. **Configura:**
   ```
   Base directory: apps/pwa
   Build command: npm install && npm run build
   Publish directory: apps/pwa/dist
   ```

3. **Ve a Site settings → Build & deploy → Post processing → Asset optimization**

4. **Desactiva "Minify JavaScript" y "Minify CSS"** (pueden causar problemas con Service Workers)

5. **Guarda y redeploy**

## Verificación

Después de redeploy:

1. **Visita tu sitio:** `https://tu-sitio.netlify.app`
2. **Navega a una ruta:** `https://tu-sitio.netlify.app/login`
3. **Debería cargar correctamente** (no mostrar 404)

## Si Sigue Fallando

### Verificar Logs de Build

1. Ve a **Deploys** en Netlify
2. Haz clic en el último deploy
3. Revisa los logs para ver si:
   - El build se completó correctamente
   - El directorio `dist` se creó
   - El archivo `_redirects` está presente

### Verificar Estructura del Build

El `dist/` debe contener:
```
dist/
  ├── index.html
  ├── _redirects          ← CRÍTICO
  ├── assets/
  │   ├── index-*.js
  │   └── index-*.css
  └── ...
```

### Forzar Redeploy Limpio

1. En Netlify Dashboard → **Deploys**
2. Haz clic en los tres puntos (⋯) del último deploy
3. Selecciona **"Clear cache and retry deploy"**

## Notas Importantes

- ✅ El archivo `_redirects` es el método **más confiable** para redirecciones SPA en Netlify
- ✅ Vite automáticamente copia todo de `public/` a `dist/`
- ✅ El archivo `netlify.toml` en la raíz es un respaldo
- ⚠️ Si cambias la configuración, siempre haz un **redeploy** para que tome efecto

## Contacto

Si después de seguir estos pasos sigue fallando, verifica:
1. Los logs de build en Netlify
2. La consola del navegador (F12)
3. Que el backend esté configurado correctamente en CORS

