# Variables de Entorno para Netlify - Frontend LA-CAJA

## Variables Necesarias

El frontend solo necesita **una variable de entorno**:

### VITE_API_URL

**Valor**: La URL de tu backend en Render

**Tu URL**: 
```
https://la-caja-8i4h.onrender.com
```

**⚠️ IMPORTANTE**: 
- Debe ser la URL completa con `https://`
- No debe terminar con `/`
- Esta es la URL que Render te asignó cuando desplegaste el backend

---

## Cómo Configurar en Netlify

### Opción 1: Desde el Dashboard de Netlify (Recomendado)

1. Ve a tu sitio en [Netlify Dashboard](https://app.netlify.com)
2. Selecciona tu sitio: `la-caja`
3. Ve a **Site settings** → **Build & deploy** → **Environment variables**
4. Haz clic en **Add variable**
5. Agrega:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://la-caja-8i4h.onrender.com`
6. Haz clic en **Save**
7. **Redeploy** el sitio para que tome efecto:
   - Ve a **Deploys**
   - Haz clic en los tres puntos (⋯) del último deploy
   - Selecciona **Trigger deploy** → **Deploy site**

### Opción 2: Desde Netlify CLI

```bash
netlify env:set VITE_API_URL "https://la-caja-8i4h.onrender.com"
```

---

## Actualizar CORS en Render

**⚠️ CRÍTICO**: También debes actualizar la variable `ALLOWED_ORIGINS` en Render para permitir que tu frontend de Netlify se conecte al backend.

### Pasos:

1. Ve a tu servicio en [Render Dashboard](https://dashboard.render.com)
2. Selecciona tu servicio: `LA-CAJA`
3. Ve a **Environment**
4. Busca la variable `ALLOWED_ORIGINS`
5. Actualiza el valor para incluir tu dominio de Netlify:

**Valor actualizado:**
```
https://la-caja.netlify.app,http://localhost:5173,http://localhost:3000
```

**Formato**: URLs separadas por comas, sin espacios después de las comas.

6. Guarda los cambios
7. Render reiniciará automáticamente el servicio

---

## Verificación

Después de configurar las variables:

1. **Verifica que el frontend puede conectarse al backend:**
   - Abre la consola del navegador (F12)
   - Ve a la pestaña **Network**
   - Intenta hacer login
   - Deberías ver peticiones a tu backend de Render

2. **Si ves errores de CORS:**
   - Verifica que `ALLOWED_ORIGINS` en Render incluya `https://la-caja.netlify.app`
   - Asegúrate de que no haya espacios extra en la variable
   - Verifica que la URL del backend en `VITE_API_URL` sea correcta

---

## Resumen Rápido

### En Netlify:
```
VITE_API_URL = https://la-caja-8i4h.onrender.com
```

### En Render (actualizar ALLOWED_ORIGINS):
```
https://la-caja.netlify.app,http://localhost:5173,http://localhost:3000
```

---

## Notas Importantes

- ✅ Las variables de entorno en Netlify se inyectan en tiempo de build
- ✅ Después de agregar/modificar variables, necesitas hacer un **redeploy**
- ✅ El frontend detecta automáticamente si está en localhost y usa `http://localhost:3000` si no hay `VITE_API_URL`
- ✅ En producción (Netlify), siempre usa la variable `VITE_API_URL`

