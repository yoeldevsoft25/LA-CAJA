
# Runbook de Incidentes de Federación (Velox POS)

Este documento describe los procedimientos operativos para diagnosticar y resolver incidentes relacionados con la sincronización federada, la integridad de datos y la salud del sistema distribuido.

## 1. Verificación de Salud

El estado actual del sistema se puede consultar en el endpoint de salud:

**Request:**
```http
GET /sync/federation/health?store_id={STORE_ID}
Authorization: Bearer {ADMIN_TOKEN}
```

**Response:**
```json
{
  "overallHealth": "healthy", // "degraded" | "critical"
  "metrics": {
    "eventLagCount": 0,
    "projectionGapCount": 0,
    "stockDivergenceCount": 0,
    "negativeStockCount": 0,
    "remoteReachable": true,
    "circuitBreakerState": "CLOSED" 
  }
}
```

## 2. Alertas y Acciones

### 🚨 FEDERATION_CRITICAL (Overall Health = CRITICAL)
**Síntoma:** El sistema está en estado crítico. Múltiples métricas fuera de rango o problemas severos de conectividad.
**Acciones:**
1. Revisar `metrics` en el reporte de salud para identificar la causa raíz.
2. Si `remoteReachable` es `false`, verificar conectividad a internet y estado del servidor central.
3. Si hay `outboxDead > 5`, existen eventos que no se pueden sincronizar. Revisar tabla `outbox_entries` donde `status = 'failed'`.

### ⚠️ PROJECTION_GAP_DETECTED
**Síntoma:** Hay eventos (ej. `SaleCreated`) que no tienen su contraparte en las tablas de lectura (`sales`).
**Acciones:**
1. El sistema tiene un `OrphanHealerService` que corre cada minuto. Esperar 5 minutos.
2. Si persiste, ejecutar el endpoint de curación manual (si implementado) o reiniciar el servicio para liberar posibles bloqueos.
3. Query de diagnóstico:
   ```sql
   SELECT * FROM events e 
   LEFT JOIN sales s ON s.id = (e.payload->>'sale_id')::uuid
   WHERE e.type = 'SaleCreated' AND s.id IS NULL;
   ```

### 📉 OVERSELLING_DETECTED / NEGATIVE STOCK
**Síntoma:** Productos con stock menor a 0.
**Acciones:**
1. Identificar productos afectados en el reporte de salud.
2. Realizar un ajuste de inventario (`StockAdjusted`) para corregir el saldo físico real.
3. Investigar si el origen fue una venta offline concurrente (revisar `conflict_audit_log`).

### 🔥 FISCAL_DUPLICATE
**Síntoma:** Dos facturas tienen el mismo `fiscal_number` y `invoice_series_id`. **INCIDENTE GRAVE**.
**Acciones:**
1. Identificar las ventas duplicadas en la base de datos:
   ```sql
   SELECT fiscal_number, invoice_series_id, count(*) 
   FROM sales 
   GROUP BY 1, 2 HAVING count(*) > 1;
   ```
2. Contactar al equipo de soporte legal/contable. Una de las facturas debe ser anulada (`SaleVoided`) manualmente.
3. Verificar `fiscal_sequence_ranges` para asegurar que no hay rangos solapados.

### 📡 FEDERATION_OFFLINE / CIRCUIT BREAKER OPEN
**Síntoma:** El servidor central no responde o el Circuit Breaker está `OPEN`.
**Impacto:** Las ventas se guardan localmente pero no se sincronizan. Riesgo de conflicto si se prolonga mucho tiempo.
**Acciones:**
1. Verificar conexión a internet del local.
2. Verificar si el remote responde a `ping`.
3. Si la red volvió pero el Circuit Breaker sigue `OPEN`, debería pasar a `HALF_OPEN` automáticamente tras 1 minuto.
4. Reiniciar el servicio forzará el estado a `CLOSED` (reset).

## 3. Reconciliación Manual
Si la sincronización automática no parece estar funcionando, se puede forzar una reconciliación:

```http
POST /sync/federation/auto-reconcile
Body: { "store_id": "..." }
```
Esto dispara el proceso de comparación de Merkle Trees y fetch de diferencias. **Requiere Distributed Lock**, por lo que si falla por "LockHeld", esperar 1 minuto.

## 4. Diagnóstico Avanzado

**Revisar Outbox Pending:**
```sql
SELECT count(*) FROM outbox_entries WHERE status = 'pending';
```

**Revisar Outbox Dead (Fallidos):**
```sql
SELECT * FROM outbox_entries WHERE status = 'failed' OR retry_count >= 10;
```

**Revisar Conflictos Recientes:**
```sql
SELECT * FROM conflict_audit_log ORDER BY resolved_at DESC LIMIT 10;
```

**Revisar Rangos Fiscales Activos:**
```sql
SELECT * FROM fiscal_sequence_ranges WHERE status = 'active';
```

## 5. Escalación

Si el incidente persiste por más de 1 hora o involucra duplicidad fiscal:
*   **SRE On-Call:** sre@veloxpos.com
*   **Backend Lead:** dev-backend@veloxpos.com
