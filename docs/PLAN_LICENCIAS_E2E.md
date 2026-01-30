# Plan de Licencias End-to-End (Freemium/Emprendedor/Basico/Empresarial)

Fecha: 2026-01-30

## 1) Resumen ejecutivo
- Objetivo: implementar licencias end-to-end con cuotas y feature gating sin comprometer el ADN offline-first ni el uptime 99.9%.
- Enfoque: servidor autoritativo + cache agresivo + token de licencia offline con firma.
- Resultado: control de planes robusto, upsell claro, y cero friccion en ventas criticas.

## 2) Estado actual del proyecto (hallazgos)
- `stores` ya tiene `license_status`, `license_expires_at`, `license_grace_days`, `license_plan`, `license_notes`.
- `LicenseGuard` es global y valida estado/expiracion, pero no valida plan ni cuotas.
- Existe flujo de pagos de licencias con verificacion manual/automatica y aprobacion admin.
- UI PWA tiene pagina `/license` para solicitar pago y panel admin para aprobar.
- `use-license-status` consulta `/auth/stores` (endpoint publico) y no devuelve `license_plan`.
- Inconsistencias de planes: backend usa `freemium/basico/profesional/empresarial` pero el landing usa `Free/Pro/Enterprise` con cuotas.
- No hay modelo de entitlements/quotas, ni gating por feature.

## 3) Principios de diseno (uptime 99.9% + offline-first)
- Licencia nunca debe bloquear una venta critica por fallo del backend.
- Validacion en servidor siempre que haya conectividad; si no, usar cache local con expiracion.
- Separar "status" (active/suspended/expired) de "entitlements" (features/quotas).
- Evitar hits a DB por request: cache + JWT/License Token.

## 4) Definicion de planes (propuesta inicial)
Nota: valores iniciales para calibrar con negocio.

### 4.1 Planes y limites
| Feature/Limit                     | Freemium | Emprendedor | Basico | Empresarial |
|----------------------------------|----------|-------------|--------|-------------|
| Usuarios                         | 1        | 3           | 5      | Ilimitado   |
| Dispositivos POS                 | 1        | 2           | 4      | Ilimitado   |
| Productos                        | 100      | 2,000       | Ilimitado | Ilimitado |
| Ventas por mes                   | 50       | 1,000       | Ilimitado | Ilimitado |
| Sucursales (multi-store)         | 1        | 1           | 3      | Ilimitado   |
| Bodegas                          | 1        | 1           | 3      | Ilimitado   |
| Reportes avanzados               | No       | Parcial     | Si     | Si          |
| Contabilidad integrada           | No       | No          | Si     | Si          |
| Facturacion fiscal SENIAT        | No       | Si (basico) | Si     | Si          |
| ML/IA (recomendaciones)          | No       | No          | Si (limitado) | Si |
| WhatsApp/Notificaciones avanzadas| No       | No          | Si     | Si          |
| KDS/Reservas/Menu QR             | No       | No          | Si     | Si          |
| API access / Integraciones       | No       | No          | Parcial| Completo    |
| SLA 99.9% + soporte dedicado     | No       | No          | No     | Si          |

### 4.2 Nomenclatura y migracion
Opciones:
- Opcion A: Renombrar `profesional` -> `emprendedor` (mismo precio). Mantener `basico` y `empresarial`.
- Opcion B: Agregar `emprendedor` como nuevo plan entre `freemium` y `basico`.

Recomendacion: Opcion A para menor costo de migracion y consistencia con marketing. Ajustar precios/marketing si hace falta.

## 5) Arquitectura de licencias end-to-end

### 5.1 Componentes clave
- LicenseService (API): calcula entitlements, valida cuotas, emite tokens offline.
- LicensePolicy (config): define features y limites por plan.
- UsageTracker (API): incrementos atomicos por uso (ventas, productos, usuarios).
- LicenseCache (Redis + memoria): reduce lecturas de DB.
- LicenseToken (JWT firmado): cache local para offline (PWA/Desktop/Android).

### 5.2 Flujo recomendado
1. Login/refresh token -> API devuelve LicenseToken firmado (expira corto).
2. Cliente guarda token local; aplica gating offline.
3. API valida en guard/interceptor:
   - Si token valido -> no DB hit.
   - Si token expiro -> cache Redis -> DB fallback.
4. Uso de cuotas -> incrementos atomicos + limites (soft/hard).
5. Cambios de plan -> evento websocket `license:status_change` + refresh token.

## 6) Modelo de datos (propuesto)

### 6.1 Tablas nuevas
- `license_plans`
  - `code`, `name`, `features_json`, `limits_json`, `price_monthly`, `price_yearly`, `is_active`
- `store_licenses`
  - `store_id`, `plan_code`, `status`, `starts_at`, `expires_at`, `grace_days`, `billing_period`
- `license_overrides`
  - `store_id`, `feature_code`, `limit_override`, `enabled_override`
- `license_usage`
  - `store_id`, `metric`, `period_start`, `period_end`, `used`
- `license_tokens`
  - `store_id`, `token_id`, `issued_at`, `expires_at`, `revoked_at`
- `license_events`
  - `store_id`, `event_type`, `payload`, `created_at`

### 6.2 Campos a mantener en `stores`
- Mantener `license_status`, `license_expires_at`, `license_plan` solo como resumen.
- Fuente de verdad: `store_licenses`.

## 7) Gating por feature y cuotas

### 7.1 Backend (autoritativo)
- Decoradores:
  - `@RequiresFeature('accounting')`
  - `@RequiresQuota('sales_per_month', 1)`
- Guard/Interceptor:
  - Evalua feature -> allow/deny
  - Evalua cuota -> allow/deny + incrementos
- Uso de Redis para `usage` hot-path.
- Politica de "soft limit":
  - 80% -> warning + upsell
  - 100% -> bloquear features no criticas
  - Ventas criticas: permitir pero marcar "overage" (requiere upgrade para seguir sincronizando)

### 7.2 Offline (cliente)
- LicenseToken firmado con:
  - `plan`, `features`, `limits`, `issued_at`, `expires_at`
- Token corto (24-72h). Cache local con expiracion.
- Modo offline:
  - Permitir operaciones dentro de limites.
  - Si excede limite offline -> bloquear feature y mostrar upgrade.

### 7.3 Sync (event ingestion)
- En `/sync/push`:
  - Validar cuota de eventos/ventas al aceptar lote.
  - Si excede: aceptar eventos criticos, marcar resto como `rejected_over_quota`.

## 8) UX de upsell y limitaciones

### 8.1 UI components
- `FeatureGate`: wrapper que muestra `LockedFeatureCard`.
- `UsageMeter`: progreso de cuotas (80% warning, 100% block).
- `UpgradeModal`: comparativa entre plan actual y siguiente.

### 8.2 Mensajes que convierten
- Mostrar beneficio inmediato del siguiente plan (ej. "Desbloquea multi-bodega y reportes avanzados").
- CTA contextual en la accion bloqueada (no en settings).

## 9) Confiabilidad y 99.9% uptime
- Cache multi-nivel (JWT + Redis + DB).
- Circuit breaker: si Redis/DB falla -> usar token valido o cache local.
- Jobs asinc:
  - Recalculo de usage diario
  - Notificaciones de expiracion y dunning
- Observabilidad:
  - `license_check_ms`, `license_cache_hit`, `quota_denied_total`
  - Alertas si `license_check_ms` > p95.

## 10) Migracion y compatibilidad
- Mapear planes actuales:
  - `freemium` -> Freemium
  - `profesional` -> Emprendedor (si Opcion A)
  - `basico` -> Basico
  - `empresarial` -> Empresarial
- Actualizar front y marketing para nombres consistentes.
- Backfill `store_licenses` desde `stores`.

## 11) Fases de implementacion (propuesta)

### Fase 0 - Alineacion de planes (rapida)
- [ ] Definir nomenclatura final (Emprendedor vs Profesional)
- [ ] Ajustar landing pricing y `/license` UI
- [ ] Actualizar enums `LicensePlan` en API y PWA

### Fase 1 - Core licensing service
- [ ] Crear tablas `license_plans`, `store_licenses`, `license_usage`
- [ ] Implementar `LicenseService` y `LicensePolicy`
- [ ] Emision de `LicenseToken` al login/refresh
- [ ] Endpoint `/licenses/status` (auth) para consumo PWA

### Fase 2 - Feature gating
- [ ] Decoradores `@RequiresFeature`
- [ ] Gating en modulos premium (accounting, ML, reports, whatsapp)
- [ ] UI `FeatureGate` + mensajes de upgrade

### Fase 3 - Quotas y usage
- [ ] Incrementos atomicos por ventas/productos/usuarios
- [ ] Avisos 80% y bloqueos 100%
- [ ] Manejo de overage en sync

### Fase 4 - Offline robustness
- [ ] Tokens offline con expiracion y refresh
- [ ] Politica de grace offline (ej. 7 dias)
- [ ] Simulaciones de desconexion

### Fase 5 - Enterprise/SLA
- [ ] Telemetria SLA
- [ ] Soporte dedicado + feature flags empresariales

## 12) Checklist tecnico detallado

### Backend
- [ ] Migraciones DB + seed de `license_plans`
- [ ] Cache Redis para licencias y usage
- [ ] Guard/Interceptor de licencias
- [ ] Integrar `license:status_change` con plan y entitlements
- [ ] Logs/auditoria de bloqueos de licencia

### PWA
- [ ] `useEntitlements` hook
- [ ] `FeatureGate` y `UsageMeter`
- [ ] CTA upgrade en features bloqueadas
- [ ] Sustituir `/auth/stores` por `/licenses/status`

### Desktop/Android
- [ ] Consumir `LicenseToken`
- [ ] Gating local con fallback offline

### DevOps/Observabilidad
- [ ] Metricas y alertas de licencia
- [ ] Panel interno de licencias y usage

## 13) Competencia en Venezuela (insights accionables)

### 13.1 Resumen competitivo (evidencia publica)
- A2 POS destaca en operaciones POS, control de caja, inventario y reportes basicos, con integracion a su suite administrativa y contable. Sus paginas oficiales enfatizan flujos de venta, arqueo y control operativo.  
- Valery POS enfatiza multimoneda, compatibilidad con dispositivos fiscales y perifericos, y fortaleza en inventario y reportes.  
- Saint (Caracas/SimplitPOS) comunica multiplataforma, multimoneda y, en algunas lineas, funcionamiento offline.  
- Galac y Profit Plus comunican homologacion SENIAT y cumplimiento fiscal como pilar de valor.  

### 13.2 Oportunidades para ganar
- Diferenciador tecnico: offline-first real + sincronizacion resiliente.
- Diferenciador de negocio: freemium funcional y upgrade por valor (no por obligacion).
- Diferenciador operativo: multi-plataforma real (PWA/Desktop/Android).
- Diferenciador estrategico: IA/ML aplicable a inventario y ventas, no solo dashboards.

### 13.3 Estrategia comercial recomendada
- Freemium agresivo para capturar mercado, con limites claros y CTA de upgrade.
- Emprendedor: plan puente para micro-negocios con necesidades fiscales basicas.
- Basico: desbloquea contabilidad + multi-bodega + analytics (alto valor percibido).
- Empresarial: SLA 99.9%, multi-sucursal ilimitado y soporte dedicado.

## 14) KPIs sugeridos
- Conversion freemium -> pago (meta 4-8% mensual).
- Churn mensual por plan.
- % cuentas en over-quota.
- % de ventas bloqueadas (debe ser casi 0).
- SLA de licencias (p99 latencia).

## 15) Fuentes (para analisis competitivo)
- https://a2.com.ve/producto/3-punto-de-venta/
- https://a2.com.ve/producto/2-administrativo-basico-punto-de-venta/
- https://valery.com/valery-pos.html
- https://saintcaracas.com/
- https://saintnet.net/simplitpos-2/
- https://galac.com/productos/administrativo/
- https://galac.com/galac-blog/administrativo-homologado/
- https://www.iseweb.com/profit-plus
