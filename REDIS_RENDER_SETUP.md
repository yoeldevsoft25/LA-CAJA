# 🚀 Configurar Redis en Render para ML Notifications

## Guía Rápida de 5 Minutos

### Paso 1: Crear Redis Instance en Render

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Click en **"New +"** (botón azul arriba a la derecha)
3. Selecciona **"Redis"**
4. Configura:
   - **Name**: `la-caja-redis` (o el nombre que prefieras)
   - **Region**: Elige la más cercana a tu API (ej: Oregon USA)
   - **Plan**:
     - **Free** - Para desarrollo/pruebas (25 MB)
     - **Starter** - $7/mes (256 MB) - Recomendado para producción
5. Click en **"Create Redis"**

### Paso 2: Obtener la URL de Conexión

Render te mostrará algo como:

```
Internal Redis URL:
redis://red-xxxxxxxxx:6379

External Redis URL:
redis://red-xxxxxxxxx.oregon-postgres.render.com:6379
```

**¿Cuál usar?**
- ✅ **Internal URL** - Si tu API está en Render (más rápido, sin cargos de tráfico)
- ⚠️ **External URL** - Si necesitas conectar desde fuera de Render

### Paso 3: Configurar en tu API de Render

1. Ve a tu servicio **API** en Render
2. Click en **"Environment"** en el menú lateral
3. Click en **"Add Environment Variable"**
4. Agrega:

```env
Key: REDIS_URL
Value: redis://red-xxxxxxxxx:6379
```

5. Render **automáticamente reiniciará** tu servicio

### Paso 4: Verificar que Funciona

Después del redeploy, revisa los logs de tu API:

```bash
# En Render Dashboard → Tu API → Logs
```

**Deberías ver**:
✅ `BullMQ connected successfully` (o similar)
✅ Sin errores de `ECONNREFUSED`

**Si ves errores**, verifica:
- Que la `REDIS_URL` esté correcta (sin espacios extra)
- Que Redis y la API estén en la misma región de Render
- Usa la **Internal URL** si ambos están en Render

---

## 🔧 Configuración Avanzada

### Variables de Entorno Completas en Render

Para producción, asegúrate de tener todas estas variables:

```env
# Database
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=tu-secret-super-seguro-cambiar-en-produccion
JWT_EXPIRES_IN=7d

# Redis (para ML Notifications)
REDIS_URL=redis://red-xxxxxxxxx:6379

# Email (Resend)
RESEND_API_KEY=re_tu_api_key_aqui
EMAIL_FROM=noreply@tu-dominio.com
EMAIL_FROM_NAME=LA-CAJA

# VAPID (Push Notifications)
VAPID_PUBLIC_KEY=tu_public_key
VAPID_PRIVATE_KEY=tu_private_key
VAPID_SUBJECT=mailto:admin@tu-dominio.com

# Otros
NODE_ENV=production
```

---

## 💰 Planes de Redis en Render

| Plan | Precio | Memoria | Ideal Para |
|------|--------|---------|------------|
| **Free** | $0 | 25 MB | Desarrollo/Pruebas |
| **Starter** | $7/mes | 256 MB | Pequeñas empresas |
| **Standard** | $20/mes | 1 GB | Crecimiento |
| **Pro** | $75/mes | 4 GB | Alto tráfico |

**¿Cuánto necesitas?**
- **1-10 tiendas**: Free está bien para empezar
- **10-100 tiendas**: Starter ($7/mes)
- **100+ tiendas**: Standard o superior

---

## 🧪 Probar Localmente Primero

Antes de configurar en Render, prueba localmente:

```bash
# 1. Instalar Redis
brew install redis
brew services start redis

# 2. En tu .env local
REDIS_HOST=localhost
REDIS_PORT=6379

# 3. Iniciar API
npm run dev

# 4. Verificar logs - no debería haber errores de conexión
```

---

## 📊 Monitorear Redis en Render

1. Ve a tu Redis instance en Render
2. Click en **"Metrics"**
3. Revisa:
   - **Memory Usage** - No debería llegar a 100%
   - **Connections** - Debería ser estable
   - **Commands/sec** - Muestra actividad

---

## ❓ Troubleshooting

### Error: `ECONNREFUSED`
- ✅ Verifica que `REDIS_URL` esté configurada
- ✅ Verifica que Redis instance esté activa (no pausada)
- ✅ Reinicia tu API en Render

### Error: `Connection timeout`
- ✅ Usa **Internal URL** si ambos están en Render
- ✅ Verifica que ambos estén en la misma región

### Redis se queda sin memoria
- ✅ Upgrade a un plan superior
- ✅ Revisa que los jobs se estén procesando (no acumulando)
- ✅ Configura TTL en los jobs (auto-limpieza)

---

## ✅ Siguiente Paso

Una vez configurado Redis, el sistema de ML Notifications estará **100% funcional**:

- ✅ Generación de insights automática cada hora
- ✅ Procesamiento de emails en cola
- ✅ Digests diarios a las 8 AM
- ✅ Limpieza automática de trabajos antiguos

Para probar los endpoints, consulta: **[ML_NOTIFICATIONS_SETUP.md](./ML_NOTIFICATIONS_SETUP.md)**

---

**¿Necesitas ayuda?** Revisa los logs en Render o contacta soporte.
