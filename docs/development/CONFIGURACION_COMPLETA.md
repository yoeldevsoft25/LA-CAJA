# Configuración Completa - LA-CAJA Frontend y Backend

## URLs de Producción

- **Frontend (Netlify)**: https://la-caja.netlify.app
- **Backend (Render)**: https://la-caja-8i4h.onrender.com

---

## Configuración en Netlify (Frontend)

### Variable de Entorno

**Key**: `VITE_API_URL`  
**Value**: `https://la-caja-8i4h.onrender.com`

### Pasos:

1. Ve a [Netlify Dashboard](https://app.netlify.com)
2. Selecciona tu sitio: `la-caja`
3. Ve a **Site settings** → **Build & deploy** → **Environment variables**
4. Haz clic en **Add variable**
5. Agrega:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://la-caja-8i4h.onrender.com`
6. Haz clic en **Save**
7. **Redeploy** el sitio:
   - Ve a **Deploys**
   - Haz clic en los tres puntos (⋯) del último deploy
   - Selecciona **Trigger deploy** → **Deploy site**

---

## Configuración en Render (Backend)

### Actualizar ALLOWED_ORIGINS

**Variable**: `ALLOWED_ORIGINS`  
**Valor actualizado**:
```
https://la-caja.netlify.app,http://localhost:5173,http://localhost:3000
```

### Pasos:

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Selecciona tu servicio: `LA-CAJA`
3. Ve a **Environment**
4. Busca la variable `ALLOWED_ORIGINS`
5. Actualiza el valor a:
   ```
   https://la-caja.netlify.app,http://localhost:5173,http://localhost:3000
   ```
6. Guarda los cambios
7. Render reiniciará automáticamente el servicio

---

## Verificación

### 1. Verificar que el backend está funcionando

Abre en tu navegador:
```
https://la-caja-8i4h.onrender.com
```

Deberías ver una respuesta del API (puede ser un error 404 o un mensaje, pero significa que está funcionando).

### 2. Verificar que el frontend puede conectarse

1. Abre https://la-caja.netlify.app
2. Abre la consola del navegador (F12)
3. Ve a la pestaña **Network**
4. Intenta hacer login
5. Deberías ver peticiones a `https://la-caja-8i4h.onrender.com`

### 3. Si ves errores de CORS

- Verifica que `ALLOWED_ORIGINS` en Render incluya `https://la-caja.netlify.app`
- Asegúrate de que no haya espacios extra en la variable
- Verifica que la URL del backend en `VITE_API_URL` sea correcta
- Espera unos minutos después de actualizar las variables (Render necesita reiniciar)

---

## Resumen de Variables

### Netlify (Frontend)
```
VITE_API_URL=https://la-caja-8i4h.onrender.com
```

### Render (Backend)
```
ALLOWED_ORIGINS=https://la-caja.netlify.app,http://localhost:5173,http://localhost:3000
```

---

## Archivos de Referencia

- `NETLIFY_ENV_VARIABLES.md` - Guía detallada para Netlify
- `RENDER_CONFIG.md` - Guía detallada para Render
- `netlify.env` - Archivo con la variable para Netlify
- `render.env` - Archivo con todas las variables para Render

---

## Troubleshooting

### Error: "Network Error" o "CORS Error"

1. Verifica que `ALLOWED_ORIGINS` en Render incluya tu dominio de Netlify
2. Verifica que `VITE_API_URL` en Netlify sea correcta
3. Espera 1-2 minutos después de actualizar variables (Render necesita reiniciar)
4. Haz un redeploy del frontend en Netlify

### Error: "Cannot connect to API"

1. Verifica que el backend esté funcionando: https://la-caja-8i4h.onrender.com
2. Verifica que `VITE_API_URL` esté configurada correctamente en Netlify
3. Verifica que hayas hecho redeploy después de agregar la variable

### El frontend no se actualiza

1. Haz un redeploy completo en Netlify
2. Limpia la caché del navegador (Ctrl+Shift+R o Cmd+Shift+R)
3. Verifica que la variable `VITE_API_URL` esté en el ambiente correcto (Production)

