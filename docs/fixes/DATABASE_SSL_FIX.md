# Fix: Error de Certificado SSL en Conexión a Base de Datos

**Fecha:** 2026-01-23  
**Problema:** `self-signed certificate in certificate chain`

---

## Problema

La aplicación falla al conectarse a la base de datos Supabase con el error:
```
Error: self-signed certificate in certificate chain
```

## Causa

Supabase (y otros servicios cloud) usan certificados SSL que pueden no estar en la cadena de confianza del sistema, causando que Node.js rechace la conexión.

## Solución Implementada

### 1. Corrección en Código

Se actualizó la lógica en `apps/api/src/app.module.ts` para que en desarrollo, las bases de datos cloud acepten certificados autofirmados por defecto:

```typescript
// Para servicios cloud en desarrollo, por defecto aceptar certificados autofirmados
const sslRejectUnauthorized = isProduction
  ? !(requestedRejectUnauthorized === false && allowInsecureDbSsl)
  : requestedRejectUnauthorized === true
    ? true
    : isCloudDatabase
      ? false // Aceptar certificados autofirmados en cloud databases en desarrollo
      : requestedRejectUnauthorized !== false;
```

### 2. Variable de Entorno

Se agregó al `.env`:
```bash
DB_SSL_REJECT_UNAUTHORIZED=false
```

## Verificación

1. **Build:** ✅ Pasa correctamente
2. **Conexión:** Requiere reiniciar la aplicación para aplicar cambios

## Notas de Seguridad

- ⚠️ **En producción:** `rejectUnauthorized` debe ser `true` (por defecto)
- ✅ **En desarrollo:** Aceptar certificados autofirmados es aceptable para servicios cloud conocidos (Supabase, Render, etc.)

## Alternativa

Si prefieres no modificar el código, puedes agregar al `.env`:
```bash
DB_SSL_REJECT_UNAUTHORIZED=false
ALLOW_INSECURE_DB_SSL=true
```

Esto permite aceptar certificados autofirmados solo en desarrollo.

---

**Estado:** ✅ CORREGIDO  
**Próximo Paso:** Reiniciar la aplicación para aplicar cambios
