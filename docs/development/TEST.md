# Guía de Pruebas - LA CAJA

## Paso 1: Verificar Base de Datos

### 1.1 Verificar que las tablas existen

En pgAdmin, ejecuta este script en la base de datos `la_caja`:

```sql
-- Verificar tablas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

Deberías ver estas tablas:
- cash_sessions
- customers
- debt_payments
- debts
- events
- inventory_movements
- products
- profiles
- sale_items
- sales
- store_members
- stores

### 1.2 Ejecutar script de prueba

Ejecuta el archivo `apps/api/src/database/test-connection.sql` en pgAdmin para verificar que todo está bien.

## Paso 2: Probar Backend API

### 2.1 Iniciar el backend

```bash
npm run dev:api
```

Deberías ver:
```
🚀 API listening on http://localhost:3000
```

### 2.2 Probar endpoint /health

Abre tu navegador o usa curl:

```bash
# En PowerShell
Invoke-WebRequest -Uri http://localhost:3000/health | Select-Object -ExpandProperty Content

# O simplemente abre en el navegador:
# http://localhost:3000/health
```

Deberías recibir:
```json
{
  "status": "ok",
  "timestamp": "2025-12-12T...",
  "service": "la-caja-api",
  "version": "1.0.0"
}
```

### 2.3 Probar endpoint /sync/push (POST)

```bash
# En PowerShell
$body = @{
    store_id = "00000000-0000-0000-0000-000000000000"
    device_id = "11111111-1111-1111-1111-111111111111"
    client_version = "1.0.0"
    events = @()
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/sync/push -Method POST -Body $body -ContentType "application/json" | Select-Object -ExpandProperty Content
```

Deberías recibir una respuesta con `accepted` y `rejected` vacíos (porque no hay eventos).

## Paso 3: Probar PWA

### 3.1 Iniciar PWA

En otra terminal:

```bash
npm run dev:pwa
```

Deberías ver:
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

### 3.2 Abrir en navegador

Abre: http://localhost:5173

Deberías ver la pantalla de LA CAJA con:
- Device ID generado
- Estado: "Offline-First Ready"
- Mensaje de Sprint 0 completado

## Paso 4: Verificar que IndexedDB funciona

1. Abre las DevTools del navegador (F12)
2. Ve a la pestaña "Application" (o "Aplicación")
3. En el menú lateral, expande "IndexedDB"
4. Deberías ver "LaCajaDB" con las tablas `localEvents` y `kv`

## Paso 5: Prueba completa de flujo (opcional)

### 5.1 Crear un evento de prueba desde la consola del navegador

En la consola del navegador (F12 > Console), ejecuta:

```javascript
// Esto debería funcionar cuando implementemos el storage
// Por ahora solo verifica que no hay errores
console.log('PWA funcionando correctamente');
```

## Checklist de Verificación

- [ ] Base de datos tiene todas las tablas
- [ ] Backend inicia sin errores
- [ ] `/health` responde correctamente
- [ ] `/sync/push` acepta requests (aunque esté vacío)
- [ ] PWA se abre en el navegador
- [ ] IndexedDB se crea correctamente
- [ ] No hay errores en la consola del navegador

## Si algo no funciona

### Error de conexión a base de datos
- Verifica que PostgreSQL esté corriendo
- Verifica que `.env` tenga la `DATABASE_URL` correcta
- Verifica que la base de datos `la_caja` existe

### Error en el backend
- Verifica que todas las dependencias estén instaladas: `npm install`
- Revisa los logs en la terminal

### Error en la PWA
- Verifica que el puerto 5173 no esté ocupado
- Revisa la consola del navegador (F12)

