# 🔄 Mantener el Servicio Despierto en Render

Render tiene un plan gratuito que pone los servicios a **dormir después de 15 minutos de inactividad**. Para mantener tu servicio siempre activo, puedes usar servicios externos que hacen ping periódico.

## ✅ Endpoints Disponibles

He creado dos endpoints ligeros que puedes usar:

1. **`GET /ping`** - Endpoint ligero y rápido
2. **`GET /keepalive`** - Alias del anterior
3. **`GET /health`** - Endpoint más completo (ya existía)

Todos estos endpoints:
- ✅ No requieren autenticación
- ✅ Son muy rápidos (respuesta < 50ms)
- ✅ No consumen recursos significativos
- ✅ Funcionan perfectamente para servicios de ping

## 🚀 Opciones para Mantener el Servicio Despierto

### Opción 1: UptimeRobot (⭐ Recomendado - Gratis)

**Ventajas:**
- ✅ Completamente gratis
- ✅ Hasta 50 monitores
- ✅ Ping cada 5 minutos (más que suficiente)
- ✅ Alertas por email si el servicio cae
- ✅ Dashboard simple

**Pasos:**

1. Ve a [uptimerobot.com](https://uptimerobot.com) y crea una cuenta gratis
2. Click en **"Add New Monitor"**
3. Configura:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: La Caja API
   - **URL**: `https://tu-api.onrender.com/ping`
   - **Monitoring Interval**: 5 minutes
4. Click **"Create Monitor"**

**Listo!** UptimeRobot hará ping cada 5 minutos y tu servicio nunca se dormirá.

---

### Opción 2: cron-job.org (Gratis)

**Ventajas:**
- ✅ Gratis
- ✅ Configuración flexible
- ✅ Puedes hacer ping cada minuto si quieres

**Pasos:**

1. Ve a [cron-job.org](https://cron-job.org) y crea una cuenta
2. Click en **"Create cronjob"**
3. Configura:
   - **Title**: Keep API Alive
   - **Address**: `https://tu-api.onrender.com/ping`
   - **Schedule**: Cada 10 minutos (`*/10 * * * *`)
4. Click **"Create"**

---

### Opción 3: EasyCron (Gratis)

**Ventajas:**
- ✅ Gratis con límites generosos
- ✅ Interfaz simple

**Pasos:**

1. Ve a [easycron.com](https://www.easycron.com) y crea cuenta
2. Click en **"Add Cron Job"**
3. Configura:
   - **URL**: `https://tu-api.onrender.com/ping`
   - **Schedule**: Cada 10 minutos
4. Guarda

---

### Opción 4: GitHub Actions (Gratis - Si tienes el código en GitHub)

Puedes crear un workflow de GitHub Actions que haga ping periódicamente:

**Crea `.github/workflows/keepalive.yml`:**

```yaml
name: Keep API Alive

on:
  schedule:
    # Ejecutar cada 10 minutos
    - cron: '*/10 * * * *'
  workflow_dispatch: # Permite ejecución manual

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping API
        run: |
          curl -f https://tu-api.onrender.com/ping || exit 1
```

---

### Opción 5: Usar el Frontend (Automático)

Si tu frontend está desplegado (Netlify, Vercel, etc.), puedes hacer que el frontend haga ping periódicamente:

**En tu frontend, agrega esto:**

```typescript
// En tu App.tsx o main.tsx
useEffect(() => {
  // Hacer ping cada 10 minutos para mantener el backend despierto
  const interval = setInterval(() => {
    fetch('https://tu-api.onrender.com/ping')
      .catch(() => {
        // Silenciar errores, solo es para mantener despierto
      });
  }, 10 * 60 * 1000); // 10 minutos

  return () => clearInterval(interval);
}, []);
```

---

## 📊 Comparación de Opciones

| Servicio | Gratis | Intervalo Mínimo | Facilidad | Recomendado |
|----------|--------|------------------|-----------|-------------|
| **UptimeRobot** | ✅ Sí | 5 min | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **cron-job.org** | ✅ Sí | 1 min | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **EasyCron** | ✅ Sí | 1 min | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **GitHub Actions** | ✅ Sí | 1 min | ⭐⭐⭐ | ⭐⭐⭐ |
| **Frontend Auto** | ✅ Sí | Cualquiera | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## 🎯 Recomendación

**Usa UptimeRobot** - Es la opción más simple y confiable:
- Configuración en 2 minutos
- No requiere código adicional
- Te avisa si el servicio cae
- Funciona perfectamente con el endpoint `/ping`

---

## ⚙️ Configuración en Render

Asegúrate de que tu servicio en Render tenga:

1. **Auto-Deploy**: Activado
2. **Health Check Path**: `/ping` (opcional, pero útil)
3. **Environment Variables**: Configuradas correctamente

---

## 🔍 Verificar que Funciona

Puedes probar manualmente:

```bash
curl https://tu-api.onrender.com/ping
```

Deberías recibir:
```json
{
  "status": "ok",
  "timestamp": "2025-12-14T20:40:00.000Z",
  "message": "Service is alive"
}
```

---

## ⚠️ Nota Importante

**Render Free Tier:**
- El servicio se duerme después de 15 minutos de inactividad
- El primer request después de dormir puede tardar 30-60 segundos (cold start)
- Con ping cada 5-10 minutos, el servicio **nunca se dormirá**

**Si necesitas 0 cold starts:**
- Considera el plan pago de Render ($7/mes)
- O usa otros servicios como Railway, Fly.io, etc.

---

## 🚨 Troubleshooting

**Si el servicio sigue durmiéndose:**
1. Verifica que el servicio de ping esté funcionando (revisa los logs)
2. Asegúrate de que la URL sea correcta (con `https://`)
3. Verifica que el intervalo sea menor a 15 minutos
4. Revisa los logs de Render para ver si hay errores

