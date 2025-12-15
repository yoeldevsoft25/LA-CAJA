# Configuración para Render - Backend LA-CAJA

## 🚨 SOLUCIÓN AL ERROR: nest: not found

**Error**: `sh: 1: nest: not found` - El CLI de NestJS no se encuentra.

**Causa**: `@nestjs/cli` está en `devDependencies` y no se instala por defecto en producción.

**Solución Rápida**:

1. **Root Directory**: Dejar VACÍO (no usar `apps/api`)
2. **Build Command**: `npm install --include=dev && cd apps/api && npm run build`
3. **Start Command**: `cd apps/api && npm run start:prod`

**Importante**: Agrega `--include=dev` al comando `npm install` para instalar las devDependencies necesarias para compilar.

Ver detalles completos más abajo en la sección "SOLUCIÓN AL ERROR: Build Failed".

---

## 🚨 SOLUCIÓN RÁPIDA AL ERROR: Variables Duplicadas

Si ves el error **"There's an error above. Please fix it to continue"**, el problema es que tienes **variables de entorno duplicadas**.

### Pasos para solucionarlo:

1. **Elimina TODAS las variables de entorno duplicadas** en la sección "Environment Variables"
2. **Agrega solo estas 8 variables** (una sola vez cada una):
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NODE_ENV`
   - `PORT`
   - `ALLOWED_ORIGINS`
   - `JWT_EXPIRES_IN`
   - `THROTTLE_TTL`
   - `THROTTLE_LIMIT`

3. **Verifica que no haya duplicados** antes de hacer clic en "Deploy web service"

---

## Información del Formulario

### Campos Básicos

- **Name**: `LA-CAJA`
- **Project** (Opcional): Dejar vacío o crear proyecto
- **Environment**: `Production`
- **Language**: `Node`
- **Branch**: `main`
- **Region**: `Virginia (US East)`
- **Root Directory**: `apps/api`

### Comandos

**IMPORTANTE**: Este es un monorepo con workspaces. Los comandos deben ejecutarse desde la raíz.

**Root Directory**: Dejar VACÍO (no usar `apps/api`)

**Build Command:**
```
npm install --include=dev && cd apps/api && npm run build
```

**Start Command:**
```
cd apps/api && npm run start:prod
```

**Nota**: `--include=dev` es necesario porque `@nestjs/cli` está en `devDependencies` y se necesita para compilar.

**Alternativa (si Root Directory está en `apps/api`):**
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start:prod`

### Instance Type

- **Recomendado para producción**: `Standard` ($25/mes) - 2 GB RAM, 1 CPU
- **Mínimo**: `Starter` ($7/mes) - 512 MB RAM, 0.5 CPU
- **Pruebas**: `Free` ($0/mes) - 512 MB RAM, 0.1 CPU (con limitaciones)

---

## Variables de Entorno

### Variables Obligatorias

#### 1. DATABASE_URL
```
postgresql://postgres.unycbbictuwzruxshacq:%40bC154356@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```

#### 2. JWT_SECRET
```
tu-secret-key-super-seguro-minimo-32-caracteres-cambiar-en-produccion
```
⚠️ **IMPORTANTE**: Cambia este valor por uno seguro en producción. Genera uno nuevo con:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Variables Opcionales (Recomendadas)

#### 3. NODE_ENV
```
production
```

#### 4. PORT
```
3000
```
*Nota: Render puede asignar automáticamente el puerto, pero puedes dejarlo en 3000*

#### 5. ALLOWED_ORIGINS
```
http://localhost:5173,http://localhost:3000
```
*Configurado para desarrollo local. Actualiza cuando despliegues el frontend.*

#### 6. JWT_EXPIRES_IN
```
7d
```

#### 7. THROTTLE_TTL
```
60000
```
*Tiempo en milisegundos (1 minuto)*

#### 8. THROTTLE_LIMIT
```
100
```
*Número máximo de requests por ventana de tiempo*

---

## Resumen para Copiar y Pegar

### Campos del Formulario
```
Name: LA-CAJA
Environment: Production
Language: Node
Branch: main
Region: Virginia (US East)
Root Directory: apps/api
Build Command: npm install && npm run build
Start Command: npm run start:prod
Instance Type: Standard ($25/mes)
```

### Variables de Entorno (Agregar UNA SOLA VEZ cada una - SIN DUPLICADOS)

**⚠️ IMPORTANTE**: Elimina todas las variables duplicadas antes de agregar estas.

Agrega estas 8 variables (una sola vez cada una):

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | `postgresql://postgres.unycbbictuwzruxshacq:%40bC154356@aws-1-us-east-1.pooler.supabase.com:5432/postgres` |
| `JWT_SECRET` | `tu-secret-key-super-seguro-minimo-32-caracteres-cambiar-en-produccion` |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` |
| `JWT_EXPIRES_IN` | `7d` |
| `THROTTLE_TTL` | `60000` |
| `THROTTLE_LIMIT` | `100` |

**Lista para copiar (agregar una por una):**

1. `DATABASE_URL` = `postgresql://postgres.unycbbictuwzruxshacq:%40bC154356@aws-1-us-east-1.pooler.supabase.com:5432/postgres`
2. `JWT_SECRET` = `tu-secret-key-super-seguro-minimo-32-caracteres-cambiar-en-produccion`
3. `NODE_ENV` = `production`
4. `PORT` = `3000`
5. `ALLOWED_ORIGINS` = `http://localhost:5173,http://localhost:3000`
6. `JWT_EXPIRES_IN` = `7d`
7. `THROTTLE_TTL` = `60000`
8. `THROTTLE_LIMIT` = `100`

---

## 🚨 SOLUCIÓN AL ERROR: Build Failed

### Error 1: nest: not found

**Problema**: `sh: 1: nest: not found` - El CLI de NestJS no se encuentra.

**Causa**: `@nestjs/cli` está en `devDependencies` y no se instala por defecto.

**Solución**: Agrega `--include=dev` al comando de instalación.

### Error 2: dist/main.js not found

**Problema**: Error `npm error command sh -c node dist/main` - El archivo `dist/main.js` no existe.

**Causa**: Es un monorepo con workspaces. El build necesita instalarse desde la raíz.

**Solución**:

### Opción 1: Sin Root Directory (Recomendado)

1. **Root Directory**: Dejar VACÍO
2. **Build Command**: 
   ```
   npm install --include=dev && cd apps/api && npm run build
   ```
3. **Start Command**: 
   ```
   cd apps/api && npm run start:prod
   ```

### Opción 2: Con Root Directory = `apps/api`

1. **Root Directory**: `apps/api`
2. **Build Command**: 
   ```
   cd ../.. && npm install --include=dev && cd apps/api && npm run build
   ```
3. **Start Command**: 
   ```
   npm run start:prod
   ```

---

## ⚠️ SOLUCIÓN AL ERROR: Variables Duplicadas

**Problema**: Si ves un error "There's an error above", es porque tienes variables de entorno duplicadas.

**Solución**:
1. En la sección "Environment Variables", elimina TODAS las variables duplicadas
2. Deja solo UNA de cada variable (ver lista completa abajo)
3. Las variables deben ser exactamente estas 8 (sin duplicados):

```
DATABASE_URL
JWT_SECRET
NODE_ENV
PORT
ALLOWED_ORIGINS
JWT_EXPIRES_IN
THROTTLE_TTL
THROTTLE_LIMIT
```

---

## Pasos de Configuración

1. **Crear el servicio en Render**
   - Conecta el repositorio `YoelDevSoft1/LA-CAJA`
   - Completa los campos del formulario según arriba

2. **Configurar Variables de Entorno (SIN DUPLICADOS)**
   - Ve a la sección "Environment Variables"
   - **ELIMINA todas las variables duplicadas primero**
   - Agrega cada variable UNA SOLA VEZ (ver lista completa abajo)
   - ⚠️ **IMPORTANTE**: Cambia `JWT_SECRET` por uno seguro antes de hacer deploy

3. **Deploy**
   - Render iniciará el build automáticamente
   - Revisa los logs para verificar que todo esté correcto

4. **Verificar**
   - Una vez desplegado, Render te dará una URL (ej: `https://la-caja.onrender.com`)
   - Verifica que el servicio esté funcionando
   - Actualiza `ALLOWED_ORIGINS` cuando despliegues el frontend

---

## Notas Importantes

- ✅ El `Root Directory` está configurado como `apps/api`, por lo que los comandos no necesitan `cd apps/api &&`
- ✅ `ALLOWED_ORIGINS` está configurado para desarrollo local (`localhost:5173` y `localhost:3000`)
- ⚠️ **Cambia el `JWT_SECRET`** antes de hacer deploy a producción
- ⚠️ Cuando despliegues el frontend, actualiza `ALLOWED_ORIGINS` con la URL de producción
- ✅ La base de datos ya está configurada (Supabase)
- ✅ Render asignará automáticamente una URL pública para tu API

---

## Generar JWT_SECRET Seguro

Ejecuta este comando para generar un JWT_SECRET seguro:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia el resultado y úsalo como valor de `JWT_SECRET` en Render.

---

## Actualizar ALLOWED_ORIGINS cuando despliegues el Frontend

Cuando tengas el frontend desplegado, actualiza la variable `ALLOWED_ORIGINS` en Render con:

```
https://tu-dominio-frontend.com,http://localhost:5173
```

Esto permitirá que tanto el frontend en producción como el local puedan acceder a la API.

---

## 🔄 Mantener el Servicio Despierto (Keep-Alive)

Render Free Tier pone los servicios a **dormir después de 15 minutos de inactividad**. Para mantener tu servicio siempre activo, usa un servicio de ping externo.

### Endpoints Disponibles

He creado endpoints ligeros que puedes usar:

- **`GET /ping`** - Endpoint ligero y rápido (recomendado)
- **`GET /keepalive`** - Alias del anterior
- **`GET /health`** - Endpoint más completo

Todos estos endpoints:
- ✅ No requieren autenticación
- ✅ Son muy rápidos (< 50ms)
- ✅ No consumen recursos significativos

### Solución Recomendada: UptimeRobot (Gratis)

1. Ve a [uptimerobot.com](https://uptimerobot.com) y crea cuenta gratis
2. Click en **"Add New Monitor"**
3. Configura:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: La Caja API
   - **URL**: `https://tu-api.onrender.com/ping`
   - **Monitoring Interval**: 5 minutes
4. Click **"Create Monitor"**

**Listo!** UptimeRobot hará ping cada 5 minutos y tu servicio nunca se dormirá.

### Otras Opciones

- **cron-job.org**: [cron-job.org](https://cron-job.org) - Ping cada 10 minutos
- **EasyCron**: [easycron.com](https://www.easycron.com) - Ping cada 10 minutos
- **GitHub Actions**: Crea un workflow que haga ping periódicamente

Ver `apps/api/KEEP_ALIVE.md` para más detalles y opciones.

---

## ⚠️ Nota sobre Render Free Tier

- El servicio se duerme después de 15 minutos de inactividad
- El primer request después de dormir puede tardar 30-60 segundos (cold start)
- Con ping cada 5-10 minutos, el servicio **nunca se dormirá**

Si necesitas 0 cold starts, considera el plan pago de Render ($7/mes).

