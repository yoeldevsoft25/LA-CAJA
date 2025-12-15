# Importar Variables de Entorno a Render

## Método 1: Importar desde archivo .env (Recomendado)

1. En Render, ve a la sección **"Environment Variables"**
2. Haz clic en el botón **"Add from .env"**
3. Selecciona o pega el contenido del archivo `render.env` (en la raíz del proyecto)
4. Render importará todas las variables automáticamente

**Archivo a usar**: `render.env` (en la raíz del proyecto)

## Método 2: Copiar y Pegar Manualmente

1. Abre el archivo `RENDER_ENV_VARIABLES.txt` o `render.env`
2. Copia todas las variables (sin los comentarios)
3. En Render, ve a **"Environment Variables"**
4. Haz clic en **"Add from .env"** y pega el contenido completo
5. O agrega cada variable manualmente una por una

## Variables Incluidas

- `PORT=3000`
- `NODE_ENV=production`
- `DATABASE_URL=postgresql://...`
- `JWT_SECRET=tu-secret-key-super-seguro-minimo-32-caracteres-cambiar-en-produccion`
- `JWT_EXPIRES_IN=7d`
- `ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000`
- `THROTTLE_TTL=60000`
- `THROTTLE_LIMIT=100`

## ⚠️ Importante

- **JWT_SECRET**: Cambia este valor por uno seguro antes de hacer deploy a producción
- **ALLOWED_ORIGINS**: Actualiza cuando despliegues el frontend con la URL de producción
- **NODE_ENV**: Ya está configurado como `production` (cambió de `development`)

## Generar JWT_SECRET Seguro

Ejecuta este comando para generar un JWT_SECRET seguro:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia el resultado y actualiza `JWT_SECRET` en Render.

