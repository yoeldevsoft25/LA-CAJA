# 🚀 Guía de Despliegue - PWA La Caja

## Opciones Gratuitas de Hosting

### 1. **Vercel** (⭐ Recomendado - Más Fácil)

**Ventajas:**
- ✅ Despliegue automático desde GitHub
- ✅ HTTPS automático (necesario para PWA)
- ✅ CDN global rápido
- ✅ Configuración mínima
- ✅ Dominio personalizado gratis

**Pasos:**

1. **Instala Vercel CLI** (opcional, también puedes usar la web):
```bash
npm i -g vercel
```

2. **Desde el directorio del proyecto:**
```bash
cd apps/pwa
vercel
```

3. **O conecta tu repositorio en [vercel.com](https://vercel.com)**:
   - Ve a vercel.com y conéctate con GitHub
   - Importa tu repositorio
   - Configura:
     - **Framework Preset**: Vite
     - **Root Directory**: `apps/pwa`
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`
   - Click "Deploy"

4. **Configura variables de entorno** (si las necesitas):
   - En el dashboard de Vercel → Settings → Environment Variables
   - Agrega `VITE_API_URL` con la URL de tu backend

---

### 2. **Netlify** (⭐ Excelente para PWA)

**Ventajas:**
- ✅ Soporte excelente para Service Workers
- ✅ Despliegue automático desde GitHub
- ✅ HTTPS automático
- ✅ Formularios y funciones serverless gratis

**Pasos:**

1. **Instala Netlify CLI** (opcional):
```bash
npm i -g netlify-cli
```

2. **Desde el directorio del proyecto:**
```bash
cd apps/pwa
netlify deploy --prod
```

3. **O conecta tu repositorio en [netlify.com](https://netlify.com)**:
   - Ve a netlify.com y conéctate con GitHub
   - "Add new site" → "Import an existing project"
   - Selecciona tu repositorio
   - Configura:
     - **Base directory**: `apps/pwa`
     - **Build command**: `npm run build`
     - **Publish directory**: `apps/pwa/dist`
   - Click "Deploy site"

4. **El archivo `netlify.toml` ya está configurado** ✅

---

### 3. **Cloudflare Pages** (⭐ Más Rápido)

**Ventajas:**
- ✅ CDN más rápido del mundo
- ✅ Despliegue automático desde GitHub
- ✅ HTTPS automático
- ✅ Ancho de banda ilimitado

**Pasos:**

1. Ve a [dash.cloudflare.com](https://dash.cloudflare.com)
2. Pages → Create a project
3. Conecta tu repositorio de GitHub
4. Configura:
   - **Framework preset**: Vite
   - **Build command**: `cd apps/pwa && npm run build`
   - **Build output directory**: `apps/pwa/dist`
5. Click "Save and Deploy"

---

### 4. **GitHub Pages** (Gratis pero más limitado)

**Ventajas:**
- ✅ Gratis con tu cuenta de GitHub
- ✅ Integración directa con repositorios

**Desventajas:**
- ⚠️ No soporta HTTPS en dominios personalizados (solo en `*.github.io`)
- ⚠️ Service Workers pueden tener problemas

**Pasos:**

1. **Instala `gh-pages`**:
```bash
cd apps/pwa
npm install --save-dev gh-pages
```

2. **Agrega script al `package.json`**:
```json
"scripts": {
  "deploy": "npm run build && gh-pages -d dist"
}
```

3. **Configura `vite.config.ts`** para base path:
```typescript
export default defineConfig({
  base: '/LA-CAJA/', // nombre de tu repositorio
  // ... resto de la config
})
```

4. **Despliega**:
```bash
npm run deploy
```

---

## ⚙️ Configuración Importante

### Variables de Entorno

Asegúrate de configurar la URL de tu backend en las variables de entorno del hosting:

- **Vercel**: Settings → Environment Variables
- **Netlify**: Site settings → Build & deploy → Environment variables
- **Cloudflare Pages**: Settings → Environment variables

Ejemplo:
```
VITE_API_URL=https://tu-backend.com
```

### CORS en el Backend

Recuerda agregar tu dominio de producción a los orígenes permitidos en CORS:

```typescript
// apps/api/src/main.ts
const origins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://tu-app.vercel.app',  // Agregar tu dominio
  'https://tu-app.netlify.app', // Si usas Netlify
  // etc.
]
```

---

## 🎯 Recomendación Final

**Para empezar rápido**: **Vercel** - Es el más fácil y funciona perfecto con Vite.

**Para mejor rendimiento**: **Cloudflare Pages** - CDN más rápido.

**Para PWA avanzadas**: **Netlify** - Mejor soporte para Service Workers.

---

## 📝 Notas

- Todas las opciones ofrecen HTTPS automático (necesario para PWA)
- El Service Worker funcionará correctamente en todas
- Los archivos de configuración (`vercel.json`, `netlify.toml`) ya están listos
- Recuerda actualizar `VITE_API_URL` con la URL de tu backend en producción

