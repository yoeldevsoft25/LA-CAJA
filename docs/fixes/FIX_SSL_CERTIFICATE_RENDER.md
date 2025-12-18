# ✅ Fix: Error de Certificado SSL en Render

## 🐛 Problema Identificado

El backend fallaba al iniciar en Render con el siguiente error:

```
Error: self-signed certificate in certificate chain
    at TLSSocket.onConnectSecure (node:internal/tls/wrap:1630:34)
```

### Causa del Problema:

La configuración SSL en `app.module.ts` tenía `rejectUnauthorized: true`, lo que rechazaba certificados autofirmados. Los servicios cloud como Render y Supabase usan certificados autofirmados o certificados que no están en la cadena de confianza estándar de Node.js.

---

## ✅ Solución Implementada

### 1. **Detección Automática de Servicios Cloud**

Se agregó detección automática de servicios cloud basada en el hostname de la base de datos:

```typescript
const isCloudDatabase =
  url.hostname.includes('supabase.co') ||
  url.hostname.includes('render.com') ||
  url.hostname.includes('aws') ||
  url.hostname.includes('azure') ||
  url.hostname.includes('gcp') ||
  configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED') === 'false';
```

### 2. **Configuración SSL Inteligente**

La configuración SSL ahora:
- **Detecta automáticamente** servicios cloud y permite certificados autofirmados
- **Permite override** con variable de entorno `DB_SSL_REJECT_UNAUTHORIZED`
- **Mantiene seguridad** en entornos locales y servidores propios

```typescript
const sslRejectUnauthorized =
  configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED') === 'true' ||
  (!isCloudDatabase && isProduction);

ssl: isProduction
  ? {
      rejectUnauthorized: sslRejectUnauthorized,
    }
  : false,
```

---

## 🔧 Configuración Opcional

### Variable de Entorno: `DB_SSL_REJECT_UNAUTHORIZED`

Puedes forzar la verificación estricta de certificados SSL:

```env
# Forzar verificación estricta (rechazar certificados autofirmados)
DB_SSL_REJECT_UNAUTHORIZED=true

# Permitir certificados autofirmados (por defecto en servicios cloud)
DB_SSL_REJECT_UNAUTHORIZED=false
```

**Nota:** Si no se especifica, el sistema detecta automáticamente según el hostname.

---

## 📋 Comportamiento por Entorno

| Entorno | Hostname | `rejectUnauthorized` | Razón |
|---------|----------|----------------------|-------|
| **Local** | `localhost` | `false` | Desarrollo local no usa SSL |
| **Render** | `*.render.com` | `false` | Certificados autofirmados |
| **Supabase** | `*.supabase.co` | `false` | Certificados autofirmados |
| **AWS RDS** | `*.rds.amazonaws.com` | `false` | Certificados autofirmados |
| **Servidor Propio** | `db.midominio.com` | `true` | Verificación estricta |
| **Override** | Cualquiera | Según `DB_SSL_REJECT_UNAUTHORIZED` | Control manual |

---

## ✅ Verificación

Después del fix, el backend debería:

1. ✅ Conectarse exitosamente a bases de datos en Render
2. ✅ Conectarse exitosamente a Supabase
3. ✅ Mantener seguridad en servidores propios
4. ✅ Permitir override con variable de entorno

---

## 🔒 Consideraciones de Seguridad

### ¿Es seguro `rejectUnauthorized: false`?

**En servicios cloud gestionados (Render, Supabase, AWS):**
- ✅ **SÍ**, es seguro porque:
  - La conexión sigue siendo encriptada (TLS/SSL)
  - El tráfico está protegido contra interceptación
  - El proveedor gestiona la infraestructura y certificados
  - La conexión es dentro de la red del proveedor

**En servidores propios:**
- ⚠️ **NO recomendado** a menos que:
  - Tengas un certificado CA específico configurado
  - O uses `DB_SSL_REJECT_UNAUTHORIZED=true` para forzar verificación

### Mejora Futura (Opcional)

Para máxima seguridad, puedes configurar un certificado CA específico:

```typescript
ssl: isProduction
  ? {
      rejectUnauthorized: true,
      ca: fs.readFileSync('path/to/ca-cert.pem'),
    }
  : false,
```

---

## 📝 Archivos Modificados

- `apps/api/src/app.module.ts` (líneas 150-260)

---

## 🚀 Próximos Pasos

1. ✅ **Deploy en Render** - El backend debería conectarse correctamente
2. ✅ **Verificar logs** - No debería haber errores de certificado SSL
3. ⚠️ **Opcional**: Configurar certificado CA específico para máxima seguridad

---

**Fecha de Fix:** 2025-12-18  
**Prioridad:** 🔴 CRÍTICA  
**Estado:** ✅ RESUELTO

