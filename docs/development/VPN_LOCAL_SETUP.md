# 🔧 Configuración para Desarrollo Local con VPN

## Problema

Cuando usas VPN, tu dirección IP cambia constantemente, lo que causa problemas con:
- **CORS**: El backend bloquea conexiones desde orígenes no permitidos
- **Base de datos**: Puede haber restricciones de IP en Render/Supabase (opcional)

## Solución

### 1. Permitir Todos los Orígenes en Desarrollo Local

Agrega esta variable a tu archivo `.env` local (en `apps/api/.env`):

```env
# Permitir todos los orígenes cuando estás en desarrollo local con VPN
# Útil cuando tu IP cambia constantemente debido a VPN
ALLOW_ALL_ORIGINS_LOCAL=true
```

**⚠️ IMPORTANTE:**
- **SOLO** para desarrollo local
- **NO** configurar esto en producción (Render)
- Cuando `ALLOW_ALL_ORIGINS_LOCAL=true` y `NODE_ENV !== 'production'`, CORS permite **todas** las conexiones

### 2. Variables de Entorno Recomendadas

Archivo: `apps/api/.env`

```env
# Entorno
NODE_ENV=development

# Permitir todos los orígenes en desarrollo local (útil con VPN)
ALLOW_ALL_ORIGINS_LOCAL=true

# Orígenes permitidos (ignorado si ALLOW_ALL_ORIGINS_LOCAL=true)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173,http://localhost:3000

# Base de datos (Render/Supabase)
DATABASE_URL=postgresql://user:password@host:port/database

# JWT
JWT_SECRET=tu-secret-key-super-seguro-minimo-32-caracteres
JWT_EXPIRES_IN=7d

# Puerto
PORT=3000

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
```

### 3. Verificación

Al iniciar el backend, deberías ver en los logs:

```
⚠️  CORS: PERMITIENDO TODOS LOS ORÍGENES (modo desarrollo + VPN)
```

Esto confirma que todos los orígenes están permitidos.

### 4. Restricciones de IP en Base de Datos (Opcional)

Si Render/Supabase está bloqueando conexiones desde tu VPN:

#### Para Render (PostgreSQL):
1. Ve a tu dashboard de Render
2. Selecciona tu base de datos PostgreSQL
3. Ve a **Network** → **IP Whitelist**
4. Agrega tu IP actual **O** desactiva el whitelist temporalmente

#### Para Supabase:
1. Ve a tu proyecto en Supabase
2. **Settings** → **Database** → **Connection Pooling**
3. Verifica que esté usando el pooler (no la conexión directa)
4. El pooler generalmente acepta conexiones desde cualquier IP

**Nota**: La configuración de `DATABASE_URL` en el código ya maneja el pooler automáticamente si detecta que es un servicio cloud.

### 5. Configuración en Render (Producción)

**NO** agregues `ALLOW_ALL_ORIGINS_LOCAL=true` en Render. En producción, usa:

```env
NODE_ENV=production
ALLOWED_ORIGINS=https://la-caja.netlify.app,https://tu-dominio.com
# NO incluir ALLOW_ALL_ORIGINS_LOCAL en producción
```

## Seguridad

- ✅ `ALLOW_ALL_ORIGINS_LOCAL` **solo funciona** cuando `NODE_ENV !== 'production'`
- ✅ En producción, siempre usa `ALLOWED_ORIGINS` con orígenes específicos
- ✅ El log muestra una advertencia cuando todos los orígenes están permitidos

## Troubleshooting

### CORS sigue bloqueando
1. Verifica que `ALLOW_ALL_ORIGINS_LOCAL=true` en tu `.env`
2. Verifica que `NODE_ENV=development` (o cualquier cosa excepto `production`)
3. Reinicia el servidor después de cambiar las variables
4. Revisa los logs del servidor para confirmar el modo

### Error de conexión a base de datos
1. Verifica que `DATABASE_URL` sea correcta
2. Verifica que estés usando el pooler de Render/Supabase
3. Verifica que no haya restricciones de IP en el servicio de base de datos
