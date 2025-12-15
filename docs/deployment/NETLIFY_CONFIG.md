# ⚙️ Configuración Manual de Netlify

Si Netlify sigue detectando el proyecto incorrecto, configura manualmente:

## En el Dashboard de Netlify:

1. Ve a **Site settings** → **Build & deploy** → **Build settings**

2. Configura manualmente:

   **Base directory:** `apps/pwa`
   
   **Build command:** `cd apps/pwa && npm install && npm run build`
   
   **Publish directory:** `apps/pwa/dist`

3. Guarda los cambios

## O desde la UI inicial:

Cuando Netlify te muestre "We've detected multiple projects":

1. **NO selecciones** "vite" o "apps/desktop"
2. En su lugar, haz click en **"Set up build"** o **"Configure build"**
3. Configura manualmente:
   - **Base directory:** `apps/pwa`
   - **Build command:** `cd apps/pwa && npm install && npm run build`
   - **Publish directory:** `apps/pwa/dist`

## Verificación:

Después de configurar, el build debería:
- ✅ Instalar dependencias en `apps/pwa`
- ✅ Ejecutar `npm run build` en `apps/pwa`
- ✅ Publicar desde `apps/pwa/dist`

