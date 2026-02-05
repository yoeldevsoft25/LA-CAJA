# Landing Page - Quick Start Guide

## ⚡ Setup en 5 Minutos

### 1. Instalar Dependencias
```bash
cd apps/pwa
npm install
```

### 2. Configurar Variables de Entorno

Copia el archivo de ejemplo:
```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:
```env
# Obligatorias
VITE_API_URL=https://tu-api.com
VITE_WS_URL=wss://tu-api.com

# Opcionales (para analytics)
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_MIXPANEL_TOKEN=abc123...
VITE_WEB3FORMS_ACCESS_KEY=xyz789...
```

### 3. Iniciar Servidor de Desarrollo
```bash
npm run dev
```

Visita: `http://localhost:5173/`

---

## 🎯 Obtener Credenciales

### Google Analytics 4 (Gratis)
1. Ir a https://analytics.google.com/
2. Crear propiedad → Tipo: Web
3. Obtener **Measurement ID** (formato: `G-XXXXXXXXXX`)
4. Copiar a `VITE_GA4_MEASUREMENT_ID`

### Mixpanel (Gratis hasta 100K eventos/mes)
1. Ir a https://mixpanel.com/
2. Crear proyecto
3. Settings → Project Settings → **Project Token**
4. Copiar a `VITE_MIXPANEL_TOKEN`

### Web3Forms (Gratis ilimitado)
1. Ir a https://web3forms.com/
2. Registrarse con email
3. Create New Form → Obtener **Access Key**
4. Copiar a `VITE_WEB3FORMS_ACCESS_KEY`

---

## 🚀 Deployment

### Vercel (Recomendado)
```bash
npm install -g vercel
vercel --prod
```

Configurar variables de entorno en Dashboard de Vercel.

### Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod
```

### Build Manual
```bash
npm run build
# Los archivos estarán en dist/
```

---

## ✅ Verificación Post-Deploy

### 1. SEO
- [ ] Abrir `https://tu-dominio.com/`
- [ ] Ver código fuente → Buscar `<meta property="og:title"`
- [ ] Probar en https://www.opengraph.xyz/

### 2. Analytics
- [ ] Abrir DevTools → Console
- [ ] Buscar `[Analytics] Google Analytics 4 inicializado`
- [ ] Buscar `[Analytics] Mixpanel inicializado`
- [ ] Navegar por la landing → Ver eventos en GA4 Realtime

### 3. Formulario de Contacto
- [ ] Ir a sección FAQ
- [ ] Click en "Contactar Soporte"
- [ ] Enviar mensaje de prueba
- [ ] Verificar email recibido

### 4. A/B Testing
- [ ] Abrir DevTools → Application → Local Storage
- [ ] Buscar key `ab_test_variants`
- [ ] Refrescar página múltiples veces
- [ ] Ver diferentes variantes de CTAs

---

## 🔍 Testing Local

### Simular producción:
```bash
npm run build
npm run preview
```

### Lighthouse audit:
```bash
npm install -g @lhci/cli
lhci autorun --collect.url=http://localhost:5173
```

Target scores:
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 95
- SEO: > 95

---

## 🐛 Problemas Comunes

### "Analytics no se inicializa"
```typescript
// Verificar en App.tsx que esté:
import { analyticsService } from '@/services/analytics.service'

useEffect(() => {
  analyticsService.init()
}, [])
```

### "Formulario no envía"
1. Verificar `VITE_WEB3FORMS_ACCESS_KEY` en `.env`
2. Verificar en https://web3forms.com/dashboard que el form esté activo
3. Revisar Console para errores de CORS

### "Landing page no aparece en /"
1. Verificar que `App.tsx` tenga:
```typescript
<Route path="/" element={<LandingPageEnhanced />} />
```
2. Limpiar cache del navegador
3. Reiniciar dev server

---

## 📞 Soporte

- **Documentación completa:** `docs/LANDING_PAGE_IMPLEMENTATION.md`
- **Issues:** GitHub Issues
- **Email:** support@lacaja.app

---

**Happy Deploying! 🚀**
