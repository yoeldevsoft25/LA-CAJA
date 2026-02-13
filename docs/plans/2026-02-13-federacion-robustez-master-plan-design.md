# Plan Maestro: Robustez de Federaciones y Cierre de 50 Gaps

Fecha: 2026-02-13  
Autor: Análisis técnico backend/federación  
Estado: Propuesto para ejecución

## 1. Objetivo

Eliminar el incidente actual de `projectionGapCount = 50` y dejar la federación en estado robusto, con:

- `projectionGapCount = 0` sostenido.
- `outboxDead = 0`.
- relay federado observable de extremo a extremo.
- autoreparación efectiva sin falsos positivos dominantes.

## 2. Alcance

Incluye:

- Flujo `sync/push -> outbox -> projection -> federation relay -> auto-reconcile`.
- Métrica de health federado (`/sync/federation/health`).
- Mecanismos de healing (`OrphanHealerService`, `heal-projections`, `auto-reconcile`).
- Seguridad operativa y observabilidad del relay.

No incluye:

- Rediseño completo del modelo CRDT.
- Cambios de producto frontend.

## 3. Arquitectura actual (resumen validado)

1. Ingesta de eventos en `SyncService.push`:
- Valida, deduplica y persiste en `events`.
- Escribe outbox atómico (`projection` y `federation-relay`) en la misma transacción.

2. Outbox processor (`OutboxService`):
- Cron cada 3s.
- `target=projection`: ejecuta `projectEvent`, actualiza `projection_status`.
- `target=federation-relay`: encola relay en BullMQ (`federation-sync`).

3. Relay federado (`FederationSyncService` + `FederationSyncProcessor`):
- Cola priorizada por tipo de evento.
- Backoff/retry BullMQ.
- Auto-reconcile periódico y smart auto-heal.

4. Health federado (`SplitBrainMonitorService`):
- Calcula `projectionGapCount` por faltantes `SaleCreated`/`DebtCreated`.
- Calcula umbral `healthy/degraded/critical`.

## 4. Hallazgos críticos (causas probables de gaps persistentes)

## H1. La métrica de gaps mezcla fallas reales con casos semánticamente válidos

La query de health cuenta eventos `processed` o `failed` sin fila en `sales/debts`.  
Esto puede incluir eventos que fueron deduplicados o absorbidos por reglas de negocio y no necesariamente representan pérdida real.

Impacto:
- Alertas con ruido.
- Difícil priorizar reparación real.

## H2. Debt dedupe puede generar falso gap estructural

En proyección de `DebtCreated`, si existe deuda por `sale_id` con otro `debt_id`, retorna idempotente sin crear la deuda del evento.

Resultado:
- `events.payload.debt_id` queda sin contraparte en `debts`.
- Health lo cuenta como gap, aunque funcionalmente se haya evitado duplicado.

## H3. Auto-healing no cubre todos los tipos de gap que health sí mide

`OrphanHealerService`:
- solo revisa `projection_status='failed'`.
- solo últimos 7 días.
- límite por tipo.

`healFailedProjections`:
- procesa `failed` o `NULL`, no `processed` huérfanos.

Resultado:
- Gaps `processed but missing` pueden quedar permanentes.

## H4. Replay sintético de ventas tiene alto riesgo de no converger

La construcción sintética de `SaleCreated` usa:
- `event_id` no UUID estándar y fallback a UUID fijo.
- `delta_payload` vacío.
- `full_payload_hash` literal `'synthetic'`.

Esto puede provocar rechazo por integridad/hash en `sync.push` remoto y bloquear autocuración de faltantes de venta.

## H5. Observabilidad incompleta de entrega real de relay

Outbox marca `federation-relay` como `processed` al encolar, no al confirmar entrega remota.

Consecuencia:
- No hay tracking persistente de "enviado y aceptado remoto".
- `outboxDead` no refleja todo el fallo de relay real.

## H6. Señal de conectividad remota permisiva

`probeRemote` considera `ok` cualquier status `< 500` (incluye 401/404).  
Puede reportar remoto "alcanzable" cuando realmente no hay capacidad de sincronizar.

## H7. Ruta destructiva en reconcile requiere hardening operativo

Si `store-status` remoto responde `exists=false`, se ejecuta borrado local masivo del store.  
Aunque hay intención defensiva, es una operación de alto riesgo para incidentes de red/configuración.

## 5. Plan maestro de ejecución

## Fase 0 (0-24h): Contención y evidencia

Objetivo:
- Congelar riesgo y clasificar con precisión los 50 gaps.

Acciones:

1. Activar modo seguro para reconciliación:
- Deshabilitar temporalmente cualquier borrado automático por `remote exists=false` mediante feature flag.

2. Tomar snapshot de gaps por store:
- Capturar lista exacta de `event_id`, `type`, `projection_status`, `projection_error`, antigüedad.

3. Clasificar por causa:
- Bucket A: `failed` por dependencia transitoria.
- Bucket B: `processed` pero entidad faltante.
- Bucket C: deuda duplicada por `sale_id` (falso positivo semántico).
- Bucket D: corrupto/permanente (debe descartarse con auditoría).

4. Baseline operativa:
- `/sync/federation/health`
- `outbox_entries` (`pending`, `failed`, `retry_count`)
- BullMQ `federation-sync` (`waiting`, `failed`)

Entregable:
- Informe de clasificación de los 50 gaps con conteo por bucket.

Criterio de salida:
- 100% de gaps clasificados por causa con owner técnico.

## Fase 1 (24-72h): Remediación del incidente actual (cerrar los 50)

Objetivo:
- Reducir `projectionGapCount` a 0 en la(s) tienda(s) afectada(s).

Acciones:

1. Reparar gaps reparables:
- Ejecutar `heal-projections` en lotes (100-200) hasta estabilizar.
- Reproyectar por `event_id` los `processed but missing` mediante job/endpoint dedicado.

2. Tratar explícitamente deuda duplicada por `sale_id`:
- Definir política única:
  - excluir de health como "dedupe-resuelto", o
  - normalizar registros para que evento y tabla converjan.
- Aplicar una sola política, no mezcla.

3. Corregir replay sintético de ventas:
- `event_id` determinístico UUID real.
- `delta_payload = payload`.
- `full_payload_hash = hash(payload)` estable.

4. Ampliar auto-healer para cobertura real:
- incluir eventos `processed` huérfanos bajo reglas seguras.
- ampliar ventana temporal configurable (> 7 días si hay deuda histórica).

5. Verificación post-fix:
- Health cada 5 min por 1h.
- Confirmar no crecimiento de `failedJobs` y no backlog creciente.

Entregables:
- Incidente cerrado (`projectionGapCount=0`).
- Cambios de remediación desplegados.

Criterio de salida:
- 0 gaps durante 60 minutos continuos.

## Fase 2 (Semana 1): Endurecimiento estructural de federación

Objetivo:
- Evitar recurrencia y mejorar verdad de métricas.

Acciones:

1. Redefinir métrica de gaps en dos señales:
- `projection_gap_actionable_count` (solo reparable real).
- `projection_gap_semantic_count` (dedupe/legacy/no-op conocido).

2. Persistir estado de relay E2E:
- `queued`, `attempted`, `accepted_remote`, `failed_remote`.
- Correlación por `event_id` y store.

3. Endurecer probe remoto:
- considerar healthy solo respuestas útiles (2xx esperado).
- separar `reachable` de `sync_ready`.

4. Índices de performance para health/reconcile:
- índices parciales por `store_id + type + projection_status + created_at`.
- índices por `payload->>'sale_id'` y `payload->>'debt_id'` según patrón real.

5. Governance de operaciones destructivas:
- proteger borrado automático con `flag + dry-run + confirmación`.
- auditoría obligatoria por store.

Entregables:
- Health más fiel.
- Relay trazable de extremo a extremo.
- runbook actualizado.

Criterio de salida:
- Sin alertas falsas dominantes.
- MTTR de gaps < 15 min.

## Fase 3 (Semana 2): Calidad, pruebas y SLOs

Objetivo:
- Convertir robustez en estándar verificable.

Acciones:

1. Test suite obligatoria de federación:
- gap `failed` recuperable.
- gap `processed but missing`.
- dedupe por deuda/sale.
- replay sintético de ventas/deudas.
- partición remota prolongada + recuperación.

2. SLO/SLI:
- SLI1: `projectionGapCount` p95 por store.
- SLI2: `relay_accept_rate`.
- SLI3: `outbox_dead_rate`.
- SLI4: `reconcile_success_rate`.

3. Alertas accionables:
- alertar por tendencia (crecimiento sostenido), no solo umbral instantáneo.
- cooldown y severidad por impacto real.

Entregables:
- Dashboard operativo de federación.
- Checklist de release para cambios de sync/federación.

Criterio de salida:
- Cumplimiento SLO por 2 semanas.

## 6. Plan operativo inmediato para resolver los 50 gaps

Secuencia recomendada:

1. Snapshot y clasificación de los 50.
2. Curar `failed` primero (batch + reintento).
3. Curar `processed but missing` por reproyección dirigida.
4. Resolver bucket dedupe deuda/sale con política explícita.
5. Ejecutar `auto-reconcile` al cierre.
6. Validar health y estabilidad de cola por 60 min.

## 7. SQL de diagnóstico base (incidente)

```sql
-- Clasificación inicial de gaps de venta/deuda por store
WITH sale_gaps AS (
  SELECT
    e.event_id,
    e.store_id,
    e.type,
    e.created_at,
    e.projection_status,
    e.projection_error,
    e.payload->>'sale_id' AS entity_id,
    'sale' AS domain
  FROM events e
  LEFT JOIN sales s
    ON s.id = CASE
      WHEN (e.payload->>'sale_id') ~* '^[0-9a-f-]{36}$'
      THEN (e.payload->>'sale_id')::uuid
      ELSE NULL
    END
  WHERE e.store_id = $1
    AND e.type = 'SaleCreated'
    AND e.created_at < NOW() - INTERVAL '1 minute'
    AND e.projection_status IN ('processed', 'failed')
    AND s.id IS NULL
),
debt_gaps AS (
  SELECT
    e.event_id,
    e.store_id,
    e.type,
    e.created_at,
    e.projection_status,
    e.projection_error,
    e.payload->>'debt_id' AS entity_id,
    'debt' AS domain,
    EXISTS (
      SELECT 1
      FROM debts d2
      WHERE d2.store_id = e.store_id
        AND (e.payload->>'sale_id') ~* '^[0-9a-f-]{36}$'
        AND d2.sale_id = (e.payload->>'sale_id')::uuid
    ) AS has_debt_by_sale
  FROM events e
  LEFT JOIN debts d
    ON d.id = CASE
      WHEN (e.payload->>'debt_id') ~* '^[0-9a-f-]{36}$'
      THEN (e.payload->>'debt_id')::uuid
      ELSE NULL
    END
  WHERE e.store_id = $1
    AND e.type = 'DebtCreated'
    AND e.created_at < NOW() - INTERVAL '1 minute'
    AND e.projection_status IN ('processed', 'failed')
    AND d.id IS NULL
)
SELECT
  domain,
  projection_status,
  COUNT(*) AS total
FROM (
  SELECT domain, projection_status FROM sale_gaps
  UNION ALL
  SELECT domain, projection_status FROM debt_gaps
) x
GROUP BY domain, projection_status
ORDER BY domain, projection_status;
```

## 8. Riesgos y mitigaciones

Riesgo:
- Cerrar gaps "maquillando" métrica sin reparar datos.
Mitigación:
- separar métricas accionables vs semánticas y conservar auditoría.

Riesgo:
- operaciones de reparación que alteren trazabilidad fiscal.
Mitigación:
- no mutar eventos originales sin bitácora; usar estados explícitos y audit trail.

Riesgo:
- autoreconcile destruyendo datos por falso negativo remoto.
Mitigación:
- feature flag, dry-run, confirmación y alerta humana.

## 9. KPI de éxito

- `projectionGapCount`: 50 -> 0.
- `federation-sync failed jobs`: tendencia decreciente y estable.
- `outbox dead`: 0 sostenido.
- `overallHealth`: `healthy` en ventana operativa normal.
- MTTR de incidentes de gap: < 15 minutos.

## 10. Nota de implementación

Este plan está basado en análisis de código del repositorio (servicios de sync, proyección, health y migraciones).  
Para ejecución final, debe correrse la Fase 0 con datos reales de producción/staging para clasificar con precisión el origen exacto de los 50 gaps actuales.
