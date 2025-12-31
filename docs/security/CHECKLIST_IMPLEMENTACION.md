# ✅ Checklist de Implementación de Seguridad

## Fase 1: Protecciones Críticas (P1)

### 1. Security Headers (Helmet)
- [ ] Instalar: `npm install @fastify/helmet`
- [ ] Agregar configuración en `apps/api/src/main.ts`
- [ ] Probar headers con: `curl -I http://localhost:3000/auth/stores`
- [ ] Verificar: `X-Content-Type-Options`, `X-Frame-Options`, `HSTS`

### 2. Corregir AdminApiGuard
- [ ] Remover `req.query?.admin_key` de `apps/api/src/admin/admin-api.guard.ts`
- [ ] Mantener solo `req.headers['x-admin-key']`
- [ ] Agregar logging de intentos no autorizados
- [ ] Probar: `curl -H "x-admin-key: test" http://localhost:3000/admin/stores`

### 3. Habilitar SSL Verification
- [ ] Cambiar `rejectUnauthorized: false` → `true` en `apps/api/src/app.module.ts`
- [ ] Si Supabase requiere certificado, configurar CA
- [ ] Probar conexión a base de datos
- [ ] Documentar si se mantiene `false` (con justificación)

### 4. Auditoría de Seguridad
- [ ] Crear migración: `30_security_audit.sql`
- [ ] Crear entity: `SecurityAuditLog`
- [ ] Crear service: `SecurityAuditService`
- [ ] Crear module: `SecurityModule`
- [ ] Integrar en `AuthController` (login success/failure)
- [ ] Integrar en `AdminApiGuard` (intentos no autorizados)
- [ ] Probar: Intentar login fallido y verificar en DB
- [ ] Query de prueba: `SELECT * FROM security_audit_log ORDER BY created_at DESC LIMIT 10;`

### 5. Validación de Secrets
- [ ] Crear `SecretValidator` en `apps/api/src/common/utils/secret-validator.ts`
- [ ] Validar `JWT_SECRET` (mínimo 32 caracteres)
- [ ] Validar `ADMIN_SECRET` (mínimo 16 caracteres)
- [ ] Llamar validación en `main.ts` al iniciar
- [ ] Probar con secret débil (debe fallar al iniciar)

---

## Fase 2: Mejoras de Seguridad (P2)

### 6. Rate Limiting Mejorado
- [ ] Crear `LoginRateLimitGuard` con bloqueo progresivo
- [ ] Integrar con `SecurityAuditService`
- [ ] Bloquear IP después de 10 intentos fallidos
- [ ] Probar: 11 intentos fallidos → debe bloquear

### 7. Encriptación de Datos Sensibles
- [ ] Identificar campos sensibles (documentos, teléfonos, etc.)
- [ ] Implementar utilidad de encriptación (AES-256)
- [ ] Crear migración para agregar columnas encriptadas
- [ ] Actualizar servicios para encriptar/desencriptar
- [ ] Probar: Crear cliente con documento → verificar encriptado en DB

### 8. Refresh Tokens
- [ ] Crear tabla `refresh_tokens`
- [ ] Modificar `AuthService.login()` para generar refresh token
- [ ] Crear endpoint `POST /auth/refresh`
- [ ] Actualizar frontend para usar refresh tokens
- [ ] Probar: Login → usar refresh token → obtener nuevo access token

### 9. Logging Estructurado
- [ ] Configurar formato JSON para logs en producción
- [ ] Reemplazar `console.log` con `Logger` de NestJS
- [ ] Agregar contexto a logs (store_id, user_id, request_id)
- [ ] Configurar niveles de log apropiados
- [ ] Integrar con sistema de monitoreo (opcional: Sentry, DataDog)

---

## Fase 3: Hardening (P3)

### 10. Content Security Policy Avanzado
- [ ] Revisar CSP headers actuales
- [ ] Ajustar según necesidades del frontend
- [ ] Agregar nonce para scripts inline si es necesario
- [ ] Probar: Verificar que frontend funciona con CSP

### 11. Validación de Fortaleza de Secrets
- [ ] Implementar generación automática de secrets si son débiles
- [ ] Agregar validación de complejidad (no solo longitud)
- [ ] Documentar requisitos de secrets en README

### 12. Sanitización de Outputs
- [ ] Revisar todos los endpoints que retornan datos
- [ ] Implementar sanitización con `class-transformer`
- [ ] Escapar caracteres especiales en respuestas JSON
- [ ] Probar: Inyectar script en input → verificar que se escapa

### 13. CSRF Protection
- [ ] Evaluar necesidad (depende de uso de cookies)
- [ ] Si es necesario, implementar CSRF tokens
- [ ] Validar tokens en requests críticos (POST, PUT, DELETE)

### 14. MFA Opcional
- [ ] Evaluar necesidad según contexto
- [ ] Si se implementa: TOTP (Google Authenticator) o SMS
- [ ] Agregar configuración por usuario
- [ ] Actualizar flujo de login

---

## Testing de Seguridad

### Tests Automatizados
- [ ] Test: Security headers presentes
- [ ] Test: AdminApiGuard rechaza query params
- [ ] Test: SSL verification habilitado
- [ ] Test: Auditoría registra eventos
- [ ] Test: Rate limiting funciona
- [ ] Test: Secrets validados al iniciar

### Tests Manuales
- [ ] Intentar XSS en inputs → debe ser bloqueado
- [ ] Intentar SQL injection → debe ser bloqueado
- [ ] Intentar acceso no autorizado → debe ser bloqueado
- [ ] Verificar logs de auditoría
- [ ] Verificar headers de seguridad

---

## Documentación

- [ ] Actualizar README con requisitos de seguridad
- [ ] Documentar variables de entorno requeridas
- [ ] Documentar proceso de rotación de secrets
- [ ] Crear guía de respuesta a incidentes
- [ ] Documentar políticas de retención de logs

---

## Monitoreo y Alertas

- [ ] Configurar alertas para múltiples fallos de login
- [ ] Configurar alertas para accesos no autorizados
- [ ] Configurar alertas para rate limiting excedido
- [ ] Dashboard de eventos de seguridad (opcional)

---

## Revisión Final

- [ ] Revisar código con equipo
- [ ] Ejecutar `npm audit` y corregir vulnerabilidades
- [ ] Revisar logs de producción
- [ ] Documentar cambios en CHANGELOG
- [ ] Actualizar documentación de seguridad

---

## Notas

- **Prioridad P1:** Implementar esta semana
- **Prioridad P2:** Implementar en próximas 2-4 semanas
- **Prioridad P3:** Planificar para próximos 1-2 meses

---

**Última actualización:** 2024  
**Responsable:** Security Engineer Agent










