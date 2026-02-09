Prompts por Fase para Agentes AI
Estructura de archivos a crear
text

docs/
└── split-brain-remediation/
    ├── PHASE-0-TRIAGE.md
    ├── PHASE-1-FOUNDATION.md
    ├── PHASE-2-DEFENSIVE.md
    ├── PHASE-3-FISCAL.md
    ├── PHASE-4-ESCROW.md
    ├── PHASE-5-OBSERVABILITY.md
    ├── PHASE-6-HARDENING.md
    └── MASTER-CONTEXT.md
MASTER-CONTEXT.md — Contexto compartido entre todas las fases
Markdown

# MASTER CONTEXT — Velox POS Split Brain Remediation

## Instrucciones para el Agente

Eres un Senior Backend Engineer trabajando en Velox POS, un sistema de
punto de venta con arquitectura offline-first. Antes de ejecutar
cualquier fase, LEE ESTE CONTEXTO COMPLETO.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | NestJS (TypeScript) + TypeORM |
| Base de datos | PostgreSQL (Supabase + Nodo Local) |
| Queue | BullMQ (Redis) |
| Frontend/PWA | React + IndexedDB (Dexie) |
| Sync | Event Sourcing + Vector Clocks + CRDTs |
| Federation | Bidireccional via HTTP relay + auto-reconcile |

## Arquitectura de Sincronización
PWA (IndexedDB) → POST /sync/push → SyncService → events table
│
├── ProjectionsService → sales, debts, etc.
├── FederationSyncService → BullMQ → Remote
└── UsageService → license tracking

text


## Entidades Críticas

| Entidad | Event Types | CRDT | Tabla Proyección |
|---------|------------|------|-----------------|
| Ventas | SaleCreated, SaleVoided | AWSet | sales |
| Inventario | StockReceived, StockAdjusted, StockDeltaApplied | GCounter | warehouse_stock |
| Deudas (Fiaos) | DebtCreated, DebtPaymentRecorded, DebtPaymentAdded | AWSet | debts, debt_payments |
| Productos | ProductCreated, ProductUpdated | LWW/MVR | products |
| Sesiones Caja | CashSessionOpened, CashSessionClosed | LWW | cash_sessions |
| Clientes | CustomerCreated, CustomerUpdated | LWW | customers |

## Problemas Identificados (Resumen)

1. **Fiaos no replican** entre Supabase y Nodo 1 (proyección o relay falla)
2. **Overselling** posible cuando 2+ POS venden offline simultáneamente
3. **Secuencias fiscales** pueden colisionar entre dispositivos offline
4. **Projection gaps** — eventos guardados pero no proyectados a tablas
5. **Dual-write** — evento y proyección no son atómicos
6. **Sin circuit breaker** en llamadas al remote
7. **Sin distributed lock** en reconciliación (race condition multi-pod)

## Archivos Clave del Proyecto

| Archivo | Responsabilidad |
|---------|----------------|
| `apps/api/src/sync/sync.service.ts` | Recibe eventos, valida, persiste, proyecta |
| `apps/api/src/sync/federation-sync.service.ts` | Relay bidireccional + reconciliación |
| `apps/api/src/projections/projections.service.ts` | Materializa eventos → tablas de lectura |
| `apps/api/src/sync/vector-clock.service.ts` | Vector clocks para causalidad |
| `apps/api/src/sync/crdt.service.ts` | CRDTs: LWW, AWSet, MVR, GCounter |
| `apps/api/src/sync/conflict-resolution.service.ts` | Detección y resolución de conflictos |
| `apps/api/src/inventory/escrow/inventory-escrow.service.ts` | Reservación de stock (no conectado a ventas) |
| `packages/sync/src/sync-queue.ts` | Cola de eventos offline en PWA |
| `packages/sync/src/reconnect-orchestrator.ts` | Detección de reconexión en PWA |

## Convenciones de Código

- Inyección de dependencias via decoradores NestJS (@Injectable, @InjectRepository)
- Queries SQL raw para operaciones complejas (no QueryBuilder)
- Cron jobs via @nestjs/schedule (@Cron decorator)
- Logging via Logger de NestJS (this.logger.log/warn/error)
- Transacciones via this.dataSource.transaction() o manager.transaction()
- Tests con Jest + supertest
- Migraciones SQL planas (no TypeORM migrations)

## Reglas Generales para Todas las Fases

1. **Nunca romper backward compatibility** — el sistema está en producción
2. **Cada cambio debe ser desplegable independientemente**
3. **Idempotencia siempre** — operaciones deben poder ejecutarse N veces
4. **Log antes de actuar** — cada operación crítica debe loguearse
5. **Fail open para ventas** — nunca bloquear una venta por error técnico
6. **Tests para cada fix** — no se despliega sin test que lo cubra
7. **Usar FOR UPDATE SKIP LOCKED** en queries que procesan lotes
PHASE-0-TRIAGE.md
Markdown

# PHASE 0 — TRIAGE DE EMERGENCIA

## Contexto
Lee MASTER-CONTEXT.md antes de ejecutar esta fase.

## Rol
Actúa como Senior Backend Engineer con experiencia en Event Sourcing
y sistemas distribuidos. Tu objetivo es DIAGNOSTICAR por qué los
fiaos (debts) no se replican entre el nodo Supabase y el nodo
PostgreSQL local, y aplicar un HOTFIX inmediato.

## Problema Específico
Los registros de deudas (fiaos) creados en un nodo NO aparecen en el
otro nodo. Hay dos versiones divergentes de los datos de deudas.

## Instrucciones

### Paso 1: Ejecutar queries diagnósticas

Ejecuta las siguientes queries en AMBOS nodos (Supabase y Nodo 1)
y compara los resultados:

```sql
-- Q1: Eventos DebtCreated existentes
SELECT 
  COUNT(*) AS total_events,
  COUNT(DISTINCT payload->>'debt_id') AS unique_debts,
  MIN(created_at) AS oldest,
  MAX(created_at) AS newest
FROM events
WHERE type IN ('DebtCreated', 'DebtPaymentRecorded', 'DebtPaymentAdded')
  AND created_at > NOW() - INTERVAL '30 days';

-- Q2: Debts materializados
SELECT COUNT(*) AS total_debts
FROM debts
WHERE created_at > NOW() - INTERVAL '30 days';

-- Q3: Gap entre eventos y proyecciones
SELECT 
  e.payload->>'debt_id' AS debt_id,
  e.event_id,
  e.type,
  e.device_id,
  e.created_at,
  e.projection_status,
  e.projection_error,
  CASE WHEN d.id IS NOT NULL THEN 'PROJECTED' ELSE 'MISSING' END AS status
FROM events e
LEFT JOIN debts d ON d.id = (e.payload->>'debt_id')::uuid
WHERE e.type = 'DebtCreated'
  AND e.created_at > NOW() - INTERVAL '30 days'
ORDER BY e.created_at DESC
LIMIT 50;

-- Q4: Eventos que llegaron por federation
SELECT 
  type, device_id, COUNT(*) AS total
FROM events
WHERE type IN ('DebtCreated', 'DebtPaymentRecorded', 'DebtPaymentAdded')
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY type, device_id
ORDER BY total DESC;

-- Q5: Schema de la tabla debts
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'debts'
ORDER BY ordinal_position;

-- Q6: Schema de debt_payments
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'debt_payments'
ORDER BY ordinal_position;
Paso 2: Determinar causa raíz
Basándote en los resultados de Q1-Q6, determina cuál de estos
escenarios aplica:

Escenario A: Eventos nunca llegaron al nodo receptor

Q1 en Nodo 1 muestra 0 eventos DebtCreated
Causa: Federation relay no está enviando estos eventos
Verificar: ¿REMOTE_SYNC_URL está configurado?
Verificar: ¿Hay jobs failed en BullMQ para DebtCreated?
Escenario B: Eventos llegaron pero no se proyectaron

Q1 en Nodo 1 muestra eventos, Q3 muestra status = MISSING
Causa: ProjectionsService no maneja DebtCreated
Fix: Agregar case en projectEvent()
Escenario C: Schema mismatch entre nodos

Q5/Q6 muestran columnas diferentes entre nodos
Causa: Migración no ejecutada en algún nodo
Fix: Ejecutar migración faltante
Escenario D: Proyección falla por error de datos

Q3 muestra projection_status = 'failed' con projection_error
Causa: Payload incompatible con el schema
Fix: Adaptar la proyección al payload real
Paso 3: Aplicar hotfix según escenario
Si Escenario A:
Bash

# Forzar reconciliación manual
curl -X POST https://TU_API_URL/sync/federation/auto-reconcile \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"store_id": "TU_STORE_ID"}'
Verificar el campo debts en la respuesta:

JSON

{
  "debts": {
    "remoteMissingCount": "??",
    "localMissingCount": "??",
    "replayedToRemote": "??",
    "replayedToLocal": "??"
  }
}
Si localMissingCount > 0 y replayedToLocal > 0, los eventos
se están reenviando. Si después de 5 minutos la tabla debts
sigue vacía, es Escenario B.

Si Escenario B:
Revisar projections.service.ts y verificar que exista:

TypeScript

case 'DebtCreated':
  await this.projectDebt(event);
  break;
case 'DebtPaymentRecorded':
case 'DebtPaymentAdded':
  await this.projectDebtPayment(event);
  break;
Si NO existe, agregar la proyección:

TypeScript

private async projectDebt(event: Event) {
  const payload = event.payload as any;
  
  // Idempotencia
  const exists = await this.debtRepository.findOne({
    where: { id: payload.debt_id },
  });
  if (exists) return;

  await this.debtRepository.save({
    id: payload.debt_id,
    store_id: event.store_id,
    customer_id: payload.customer_id,
    sale_id: payload.sale_id || null,
    total_amount: Number(payload.total_amount || payload.amount || 0),
    remaining_amount: Number(
      payload.remaining_amount ?? payload.total_amount ?? payload.amount ?? 0
    ),
    status: payload.status ?? 'pending',
    notes: payload.notes || payload.note || null,
    created_at: event.created_at,
    created_by: event.actor_user_id,
  });
}

private async projectDebtPayment(event: Event) {
  const payload = event.payload as any;
  
  const exists = await this.debtPaymentRepository.findOne({
    where: { id: payload.payment_id },
  });
  if (exists) return;

  await this.debtPaymentRepository.save({
    id: payload.payment_id,
    debt_id: payload.debt_id,
    store_id: event.store_id,
    amount: Number(payload.amount || 0),
    payment_method: payload.payment_method || payload.method || 'cash',
    paid_at: payload.paid_at ? new Date(payload.paid_at) : event.created_at,
    paid_by: event.actor_user_id,
    notes: payload.notes || null,
  });

  // Actualizar remaining_amount en debt
  await this.dataSource.query(`
    UPDATE debts
    SET remaining_amount = GREATEST(0, 
      remaining_amount - $1
    ),
    status = CASE 
      WHEN remaining_amount - $1 <= 0 THEN 'paid'
      ELSE status
    END,
    updated_at = NOW()
    WHERE id = $2
  `, [Number(payload.amount || 0), payload.debt_id]);
}
Si Escenario C:
Comparar los resultados de Q5/Q6 entre ambos nodos.
Generar el ALTER TABLE necesario para alinear schemas.

Si Escenario D:
Leer projection_error de Q3 y adaptar la proyección
para manejar el formato del payload que está fallando.

Paso 4: Verificación post-hotfix
SQL

-- Ejecutar en el nodo que tenía el problema:

-- V1: Verificar que ahora hay debts materializados
SELECT COUNT(*) FROM debts WHERE created_at > NOW() - INTERVAL '30 days';

-- V2: Verificar que no hay gaps
SELECT COUNT(*) AS orphaned
FROM events e
LEFT JOIN debts d ON d.id = (e.payload->>'debt_id')::uuid
WHERE e.type = 'DebtCreated'
  AND e.created_at > NOW() - INTERVAL '30 days'
  AND d.id IS NULL;

-- V3: Verificar pagos
SELECT COUNT(*) AS orphaned_payments
FROM events e
LEFT JOIN debt_payments dp ON dp.id = (e.payload->>'payment_id')::uuid
WHERE e.type IN ('DebtPaymentRecorded', 'DebtPaymentAdded')
  AND e.created_at > NOW() - INTERVAL '30 days'
  AND dp.id IS NULL;
Si V2 o V3 dan > 0, reproyectar manualmente:

SQL

-- Obtener event_ids huérfanos para reproyectar
SELECT event_id, type, payload
FROM events e
LEFT JOIN debts d ON d.id = (e.payload->>'debt_id')::uuid
WHERE e.type = 'DebtCreated'
  AND e.created_at > NOW() - INTERVAL '30 days'
  AND d.id IS NULL;
Paso 5: Backup post-fix
Bash

pg_dump $DB_URL --format=custom --no-owner \
  -f backup_post_triage_$(date +%Y%m%d_%H%M).dump
Entregables de esta fase
 Resultados de las 6 queries diagnósticas (ambos nodos)
 Causa raíz identificada (Escenario A/B/C/D)
 Hotfix aplicado y verificado
 Backup post-fix tomado
 Documento con hallazgos para referencia futura
Criterios de éxito
Debts se replican correctamente al crear uno nuevo
Q2 (V1) muestra count > 0 en ambos nodos
Q3 (V2) muestra 0 orphaned en ambos nodos
Federation auto-reconcile reporta debts.localMissingCount = 0
Tiempo estimado: 4-8 horas
text


---

## `PHASE-1-FOUNDATION.md`

```markdown
# PHASE 1 — FOUNDATION FIXES

## Contexto
Lee MASTER-CONTEXT.md antes de ejecutar esta fase.
La Phase 0 (Triage) debe estar COMPLETADA antes de iniciar esta fase.

## Rol
Actúa como Senior Backend Engineer. Tu objetivo es implementar tres
servicios fundamentales que previenen los gaps de datos que causan
divergencia entre nodos:

1. **OrphanHealerService** — Detecta y repara proyecciones huérfanas
2. **Reconcile basado en events** — Corrige la reconciliación para
   comparar event logs en vez de tablas materializadas
3. **OutboxService** — Garantiza atomicidad entre persistencia de
   eventos y su proyección/relay

## Prerrequisitos

### Migración SQL requerida
Antes de escribir código, ejecuta esta migración:

```sql
-- Migration: add_outbox_and_audit_tables.sql

CREATE TABLE IF NOT EXISTS outbox_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  store_id UUID NOT NULL,
  target VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_pending 
  ON outbox_entries (created_at) 
  WHERE status = 'pending';

CREATE INDEX idx_outbox_event_id 
  ON outbox_entries (event_id);

CREATE TABLE IF NOT EXISTS conflict_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255),
  winner_event_id VARCHAR(255) NOT NULL,
  loser_event_ids TEXT[] NOT NULL DEFAULT '{}',
  strategy VARCHAR(50) NOT NULL,
  winner_payload JSONB,
  loser_payloads JSONB,
  resolved_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_by VARCHAR(100) DEFAULT 'auto'
);

CREATE INDEX idx_conflict_audit_store 
  ON conflict_audit_log (store_id, resolved_at DESC);
Deliverable 1: OrphanHealerService
Especificación
Crear apps/api/src/sync/orphan-healer.service.ts

Requisitos funcionales:

Cron job que corre cada 60 segundos
Para cada store activa, busca eventos cuya proyección no existe
en la tabla materializada correspondiente
Reproyecta los eventos huérfanos usando ProjectionsService
Actualiza projection_status en la tabla events
Guard contra ejecución concurrente (flag in-memory)
Límite de 50 eventos por ejecución para no sobrecargar
Tipos de eventos a verificar:

Evento	Tabla proyección	Join condition
SaleCreated	sales	sales.id = payload->>'sale_id'
SaleVoided	sales (voided_at)	sales.id = payload->>'sale_id' AND sales.voided_at IS NOT NULL
DebtCreated	debts	debts.id = payload->>'debt_id'
DebtPaymentRecorded	debt_payments	debt_payments.id = payload->>'payment_id'
DebtPaymentAdded	debt_payments	debt_payments.id = payload->>'payment_id'
CashSessionOpened	cash_sessions	cash_sessions.id = payload->>'session_id'
CashSessionClosed	cash_sessions (closed_at)	cash_sessions.id = payload->>'session_id' AND closed_at IS NOT NULL
Requisitos no funcionales:

No fallar silenciosamente — loguear cada heal con evento tipo y resultado
Idempotente — si se ejecuta múltiples veces, no crea duplicados
Solo procesa eventos de los últimos 7 días
Solo procesa eventos con projection_status != 'processed'
Método público para uso manual:

TypeScript

async healStore(storeId: string): Promise<OrphanHealResult>
Interface de resultado:

TypeScript

interface OrphanHealResult {
  checked: number;
  healed: number;
  failed: number;
  details: Array<{
    event_id: string;
    type: string;
    status: 'healed' | 'failed';
    error?: string;
  }>;
}
Tests requeridos (orphan-healer.service.spec.ts):

Detecta SaleCreated sin row en sales → heal exitoso
Detecta DebtCreated sin row en debts → heal exitoso
Detecta DebtPaymentRecorded sin row en debt_payments → heal exitoso
Idempotente — segundo heal encuentra 0 orphans
No procesa eventos con projection_status = 'processed'
No procesa eventos de más de 7 días
Maneja errores de proyección gracefully (marca como failed)
Límite de 50 por ejecución funciona correctamente
Registrar en módulo
Agregar OrphanHealerService al módulo de sync:

TypeScript

// sync.module.ts
providers: [
  // ... existentes
  OrphanHealerService,
],
Deliverable 2: Reconcile basado en Events
Especificación
Modificar apps/api/src/sync/federation-sync.service.ts

Problema actual:
Los métodos getSalesIds(), getDebtIds(), getDebtPaymentIds()
leen de las tablas MATERIALIZADAS (sales, debts, debt_payments).
Si un evento se guardó en events pero la proyección falló,
el reconcile no lo detecta como faltante.

Solución:
Crear métodos paralelos que lean de la tabla events en vez
de las tablas materializadas. Usar estos nuevos métodos en
reconcileStore().

Métodos a crear o reemplazar:

TypeScript

// Reemplazar getSalesIds con:
async getSalesEventIds(storeId, dateFrom, dateTo, limit, offset): Promise<FederationIdsResult>
// Query: SELECT DISTINCT payload->>'sale_id' FROM events WHERE type = 'SaleCreated'

// Reemplazar getDebtIds con:
async getDebtEventIds(storeId, dateFrom, dateTo, limit, offset): Promise<FederationIdsResult>
// Query: SELECT DISTINCT payload->>'debt_id' FROM events WHERE type = 'DebtCreated'

// Reemplazar getDebtPaymentIds con:
async getDebtPaymentEventIds(storeId, dateFrom, dateTo, limit, offset): Promise<FederationIdsResult>
// Query: SELECT DISTINCT payload->>'payment_id' FROM events WHERE type IN ('DebtPaymentRecorded', 'DebtPaymentAdded')

// Reemplazar getSessionIds con:
async getSessionEventIds(storeId, dateFrom, dateTo, limit, offset): Promise<FederationIdsResult>
// Query: SELECT DISTINCT payload->>'session_id' FROM events WHERE type IN ('CashSessionOpened', 'CashSessionClosed')

// Reemplazar getVoidedSalesIds con:
async getVoidedSalesEventIds(storeId, dateFrom, dateTo, limit, offset): Promise<FederationIdsResult>
// Query: SELECT DISTINCT payload->>'sale_id' FROM events WHERE type = 'SaleVoided'
Reglas:

Mantener los métodos originales (getXxxIds) para backward compat
Crear los nuevos métodos (getXxxEventIds)
Actualizar reconcileStore() para usar los nuevos métodos
Los endpoints del controller siguen usando los originales
(para que el nodo remoto pueda usar cualquiera)
Tests requeridos:

getSalesEventIds retorna IDs de eventos, no de tabla sales
Un evento SaleCreated sin proyección aparece en getSalesEventIds
reconcileStore detecta gaps que antes se ignoraban
Deliverable 3: OutboxService
Especificación
Crear apps/api/src/sync/outbox.service.ts

Requisitos funcionales:

Método writeOutboxEntries() que escribe en outbox_entries
DENTRO de la misma transacción que los eventos
Cron processor cada 3 segundos que procesa entradas pendientes
Dos targets: 'projection' y 'federation-relay'
Usa FOR UPDATE SKIP LOCKED para safety multi-pod
Retry hasta 10 veces, luego marca como 'dead'
Limpieza horaria de entradas procesadas (>24h)
Interface principal:

TypeScript

async writeOutboxEntries(
  manager: EntityManager,
  events: Event[],
  includeFederationRelay: boolean,
): Promise<void>
Integración con SyncService.push():
Modificar el bloque de persistencia en sync.service.ts para:

Guardar eventos con orIgnore()
Llamar outboxService.writeOutboxEntries() en la MISMA transacción
Eliminar las llamadas directas a:
this.salesProjectionQueue.add()
this.federationSyncService.queueRelay(event)
this.projectionsService.projectEvent(event) (para otros eventos)
El OutboxService se encarga de todo de forma asíncrona
IMPORTANTE: No eliminar la queue de BullMQ para ventas todavía.
El outbox es un COMPLEMENTO, no un reemplazo. Si el outbox falla
procesando una proyección de venta, el sistema puede caer en el
flujo anterior. Migrar completamente a outbox en Phase 4.

Approach conservador para Phase 1:

El outbox maneja: DebtCreated, DebtPaymentRecorded, DebtPaymentAdded,
CustomerCreated, CustomerUpdated, ProductCreated, ProductUpdated,
CashSessionOpened, CashSessionClosed, CashLedgerEntryCreated
SaleCreated sigue usando BullMQ (ya funciona)
Federation relay se mueve AL outbox para TODOS los tipos
Tests requeridos:

writeOutboxEntries crea entradas correctamente
Processor procesa entradas pending → processed
Processor maneja errores → retry_count incrementa
Processor marca como 'dead' después de 10 retries
Cleanup elimina entradas processed de >24h
FOR UPDATE SKIP LOCKED no bloquea entre pods (simular con delay)
Integration: evento DebtCreated → outbox → proyección → debt existe
Registrar en módulo
TypeScript

// sync.module.ts
providers: [
  // ... existentes
  OutboxService,
],
Checklist de deploy Phase 1
text

PRE-DEPLOY:
  [ ] Migración SQL ejecutada en staging
  [ ] Migración SQL ejecutada en producción
  [ ] OrphanHealerService: tests pasan
  [ ] Reconcile event-based: tests pasan
  [ ] OutboxService: tests pasan
  [ ] Integration test: debt end-to-end
  [ ] pnpm test --coverage muestra >80% para archivos nuevos
  [ ] Backup de BD de producción tomado

DEPLOY:
  [ ] Deploy API con nuevos servicios
  [ ] Verificar logs: "Healed X orphaned projections"
  [ ] Verificar outbox: 
      SELECT status, COUNT(*) FROM outbox_entries GROUP BY status
  [ ] Forzar reconcile:
      POST /federation/auto-reconcile {"store_id": "xxx"}
  [ ] Verificar debts replican en ambos nodos

POST-DEPLOY (24h):
  [ ] Verificar 0 orphaned projections
  [ ] Verificar outbox pending < 10 en promedio
  [ ] Verificar outbox dead = 0
  [ ] Verificar federation queue failed = 0
  [ ] Crear debt de prueba y verificar replicación
Criterios de éxito Phase 1
OrphanHealerService detecta y repara gaps automáticamente
0 projection gaps en 24h de operación
Outbox procesa entries en <5 segundos promedio
Reconcile detecta gaps que antes ignoraba
Fiaos replican correctamente entre nodos
Tiempo estimado: 7 días
text


---

## `PHASE-2-DEFENSIVE.md`

```markdown
# PHASE 2 — DEFENSIVE LAYER

## Contexto
Lee MASTER-CONTEXT.md antes de ejecutar esta fase.
Las Phases 0 y 1 deben estar COMPLETADAS.

## Rol
Actúa como Senior Full-Stack Engineer. Tu objetivo es implementar
capas defensivas tanto en el cliente (PWA) como en el servidor
para prevenir overselling y cascading failures.

## Prerrequisitos de Phase 1 completados
- [ ] OrphanHealerService funcionando en producción
- [ ] OutboxService procesando entries correctamente
- [ ] Reconcile basado en events desplegado
- [ ] 0 orphaned projections en últimas 24h

---

## Deliverable 5: Stock Validation Pre-Venta (PWA)

### Especificación

Crear `apps/pwa/src/services/stock-validator.service.ts`

**Objetivo:** Antes de crear un evento SaleCreated en el cliente,
validar contra el stock local de IndexedDB que hay disponibilidad.

**Política de negocio:**

| Condición | Online | Offline |
|-----------|--------|---------|
| Stock > qty solicitada | ✅ Permitir | ✅ Permitir |
| Stock > 0 pero < qty | ⚠️ Warning, permitir | ⚠️ Warning, permitir |
| Stock = 0 | ⚠️ Warning, permitir | 🔴 Bloquear |
| Stock < 0 | ⚠️ Warning, permitir | 🔴 Bloquear |
| Producto sin track_inventory | ✅ Siempre permitir | ✅ Siempre permitir |
| Error leyendo IndexedDB | ✅ Permitir (fail open) | ✅ Permitir (fail open) |

**Razón del "fail open":** Es preferible una venta con overselling
que bloquear al cajero y perder la venta. El overselling se resuelve
operativamente (reabastecer), pero una venta perdida es irrecuperable.

**Interface:**
```typescript
interface StockValidationResult {
  valid: boolean;        // false solo si hay errores (offline + sin stock)
  warnings: StockWarning[];
  errors: StockError[];
}

interface StockWarning {
  product_id: string;
  product_name: string;
  requested: number;
  available: number;
  message: string;
}

interface StockError {
  product_id: string;
  product_name: string;
  requested: number;
  available: number;
  message: string;
}
Método principal:

TypeScript

async validateBeforeSale(
  items: Array<{ product_id: string; qty: number; name: string }>,
  isOnline: boolean,
): Promise<StockValidationResult>
Método secundario — actualizar stock local post-venta:

TypeScript

async decrementLocalStock(
  items: Array<{ product_id: string; qty: number }>,
): Promise<void>
Después de cada venta exitosa, decrementar el stock en IndexedDB
para que la siguiente validación sea más precisa. Esto es un
"optimistic local decrement", no afecta el stock real del servidor.

IndexedDB stores a leer:

warehouse_stock_cache — snapshot del stock por producto
escrow_quotas — cuotas reservadas por este dispositivo (Phase 4)
products — para verificar track_inventory
Integración en el checkout:
Identificar el componente de checkout en el POS y agregar la
validación ANTES de llamar a createSaleEvent/enqueueSale.

Mostrar:

Warnings como toast amarillo con opción de continuar
Errors como modal rojo que bloquea la venta
Tests requeridos:

Stock suficiente → valid: true, 0 warnings, 0 errors
Stock < qty, online → valid: true, 1 warning
Stock = 0, offline → valid: false, 1 error
Stock = 0, online → valid: true, 1 warning (fail open)
Producto sin track_inventory → valid: true, skip
Error de IndexedDB → valid: true, fail open
decrementLocalStock reduce el stock local
Después de decrement, siguiente validación refleja nuevo stock
Deliverable 6: Circuit Breaker
Especificación
Crear apps/api/src/common/circuit-breaker.ts

Implementación de Circuit Breaker pattern para las llamadas
HTTP al servidor remoto de federation.

Estados:

CLOSED: Normal, requests pasan
OPEN: Fallando, requests bloqueados (throw inmediato)
HALF_OPEN: Probando, un request de prueba pasa
Configuración:

failureThreshold: 5 fallos consecutivos para abrir
successThreshold: 3 éxitos consecutivos para cerrar
timeoutMs: 60,000ms antes de pasar a half-open
Integrar en FederationSyncService:

relayEventNow() — wrap con circuit breaker
fetchRemoteIds() — wrap con circuit breaker
postRemoteReplay() — wrap con circuit breaker
postRemoteStockReconcile() — wrap con circuit breaker
probeRemote() — NO usar circuit breaker (es el health check)
Logging:

Log WARN cuando cambia de estado
Incluir estado del circuit breaker en getFederationStatus()
Tests requeridos:

CLOSED: requests pasan normalmente
5 fallos → pasa a OPEN
OPEN: throw sin hacer request
Después de timeout → HALF_OPEN
HALF_OPEN + éxito → CLOSED
HALF_OPEN + fallo → OPEN de vuelta
Integration: federation status incluye circuitBreakerState
Deliverable 7: Distributed Lock
Especificación
Crear apps/api/src/common/distributed-lock.service.ts

Implementación de lock distribuido usando Redis
para proteger la reconciliación contra ejecución concurrente
en múltiples pods/procesos.

Métodos:

TypeScript

async acquire(key: string, ttlMs?: number): Promise<string | null>
async release(key: string, lockValue: string): Promise<boolean>
Requisitos:

Usar SET NX PX para acquire atómico
Usar Lua script para release atómico (solo si el lock es nuestro)
TTL default: 5 minutos
Lock value: {pid}-{timestamp}-{random}
Integrar en FederationSyncService.reconcileStore():

Acquire lock al inicio con key federation:reconcile:{storeId}
Release en finally block
Si no se puede adquirir, retornar resultado con skipped: true
Reemplazar el flag autoReconcileInFlight in-memory:
El flag actual NO es safe para múltiples pods.
El distributed lock SÍ lo es.

Tests requeridos:

acquire retorna lockValue cuando no hay lock
acquire retorna null cuando ya hay lock
release libera el lock correctamente
release NO libera lock de otro proceso
Lock expira después de TTL
Integration: dos reconciles concurrentes, solo uno ejecuta
Deliverable 8: Hash Determinista
Especificación
Modificar apps/api/src/sync/sync.service.ts

Problema: hashPayload() usa Object.keys(payload).sort()
que solo ordena el primer nivel de keys. Objetos anidados con
keys en distinto orden producen hashes diferentes para el mismo
contenido semántico.

Solución: Implementar sortDeep() que ordena recursivamente
todas las keys de todos los niveles.

TypeScript

private sortDeep(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(item => this.sortDeep(item));
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString();

  const sorted: Record<string, any> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = this.sortDeep(obj[key]);
  }
  return sorted;
}

private hashPayload(payload: any): string {
  const json = JSON.stringify(this.sortDeep(payload));
  return crypto.createHash('sha256').update(json).digest('hex');
}
Tests requeridos:

Mismo payload con keys en diferente orden → mismo hash
Payload con objetos anidados en diferente orden → mismo hash
Payload con arrays → hash preserva orden de array
Payload con Date → convierte a ISO string
Payload null/undefined → manejado gracefully
Hash es determinista (mismo input → mismo output siempre)
Checklist de deploy Phase 2
text

PRE-DEPLOY:
  [ ] Stock validator service creado con tests
  [ ] Stock validator integrado en checkout UI
  [ ] Circuit breaker creado con tests
  [ ] Circuit breaker integrado en federation service
  [ ] Distributed lock service creado con tests
  [ ] Distributed lock integrado en reconcileStore
  [ ] Hash determinista implementado con tests
  [ ] pnpm test pasa al 100%
  [ ] PWA build sin errores

DEPLOY:
  [ ] Deploy API (circuit breaker + lock + hash)
  [ ] Deploy PWA (stock validator)
  [ ] Verificar logs: circuit breaker state = CLOSED
  [ ] Verificar: reconcile usa lock
      (log "reconcile lock held by another process" NO aparece
       cuando solo hay 1 pod)
  [ ] Test manual: vender offline con stock 0 → error

POST-DEPLOY (24h):
  [ ] Circuit breaker no ha abierto (red is healthy)
  [ ] Stock validation warnings logueados en analytics
  [ ] Hash mismatches = 0
  [ ] Lock contention events = 0 (1 pod)
Criterios de éxito Phase 2
PWA muestra warning cuando stock es bajo al vender offline
PWA bloquea venta offline cuando stock = 0
Circuit breaker protege contra cascading failures
Reconcile no ejecuta en paralelo (lock)
Hash mismatches eliminados
Tiempo estimado: 7 días
text


---

## `PHASE-3-FISCAL.md`

```markdown
# PHASE 3 — FISCAL SAFETY

## Contexto
Lee MASTER-CONTEXT.md antes de ejecutar esta fase.
Las Phases 0, 1 y 2 deben estar COMPLETADAS.

## Rol
Actúa como Senior Backend Engineer con conocimiento de requisitos
fiscales latinoamericanos (SENIAT Venezuela). Tu objetivo es
implementar un sistema de rangos fiscales pre-asignados que elimine
la posibilidad de colisiones de números de factura entre
dispositivos offline.

## Prerrequisitos
- [ ] Phase 2 completada y verificada
- [ ] Tabla fiscal_sequence_ranges creada (migración de Phase 0 día 2)

---

## Deliverable 9: FiscalSequenceService

### Especificación

Crear `apps/api/src/fiscal/fiscal-sequence.service.ts`

**Concepto:** Cada dispositivo POS reserva un bloque de números
fiscales ANTES de ir offline. Mientras está offline, consume
números de su bloque reservado. Al reconectar, puede reservar
un nuevo bloque.

**Métodos:**

```typescript
// Reservar un rango para un dispositivo
async reserveRange(
  storeId: string,
  seriesId: string,
  deviceId: string,
  quantity?: number,  // default 50
): Promise<FiscalRange>

// Consumir el siguiente número del rango activo
async consumeNext(
  storeId: string,
  seriesId: string,
  deviceId: string,
): Promise<number | null>

// Obtener rango activo de un dispositivo
async getActiveRange(
  storeId: string,
  seriesId: string,
  deviceId: string,
): Promise<FiscalRange | null>

// Reclamar rangos expirados (cron cada hora)
async reclaimExpiredRanges(): Promise<number>
Reglas de negocio:

Un dispositivo solo puede tener 1 rango activo por serie
Los rangos expiran a las 24h si no se agotan
Reservar usa SERIALIZABLE transaction + FOR UPDATE
Si el dispositivo agota su rango y está online, pide nuevo
Si está offline y agota, NO puede facturar (mostrar error)
Rangos expirados se reclaiman pero NO se reutilizan
(los números quedan como "gap" permitido fiscalmente)
Tabla:

text

fiscal_sequence_ranges:
  id, store_id, series_id, device_id,
  range_start, range_end, used_up_to,
  status ('active'|'exhausted'|'expired'),
  granted_at, expires_at
Endpoint:

TypeScript

POST /fiscal/reserve-range
Body: { series_id: string, device_id: string, quantity?: number }
Response: { device_id, range_start, range_end, expires_at }
PWA Integration:
Crear apps/pwa/src/services/fiscal-offline.service.ts:

Al conectarse, reservar rango si no tiene activo
Guardar rango en IndexedDB
Al crear factura offline, consumir de rango local
Si rango agotado offline → error "No se puede facturar offline"
Al reconectar, reportar consumo y reservar nuevo si necesario
Tests requeridos (backend):

reserveRange asigna rango correcto con números consecutivos
Dos reservaciones consecutivas NO se solapan
consumeNext retorna números secuenciales
consumeNext retorna null cuando rango agotado
SERIALIZABLE previene race condition en reservación
reclaimExpiredRanges marca como expired
Un dispositivo no puede tener 2 rangos activos
Rangos expirados no se reutilizan
Tests requeridos (PWA):

Reservar rango al conectarse exitosamente
Consumir números offline secuencialmente
Rango agotado offline → error
Reconexión → nuevo rango reservado
Persistencia en IndexedDB sobrevive refresh
Deliverable 10: Causal Relay Ordering
Especificación
Modificar apps/api/src/sync/federation-sync.service.ts

Problema: BullMQ no garantiza orden FIFO. Un evento
CashSessionOpened puede llegar al remote DESPUÉS de
SaleCreated que depende de esa sesión, causando rechazo.

Solución: Asignar prioridades a los jobs de relay
para que las dependencias se procesen primero.

Mapa de prioridades (menor número = mayor prioridad):

Tipo	Prioridad	Justificación
CashSessionOpened	1	Prerequisito de ventas
CashSessionClosed	2	Después de abrir
ProductCreated	3	Prerequisito de ventas
ProductUpdated	3	Puede cambiar precio
CustomerCreated	3	Prerequisito de debts
CustomerUpdated	3	Bajo riesgo
DebtCreated	4	Prerequisito de payments
SaleCreated	5	Depende de sesión + productos
StockReceived	5	Independiente
StockAdjusted	5	Independiente
StockDeltaApplied	5	Independiente
DebtPaymentRecorded	6	Depende de debt
DebtPaymentAdded	6	Depende de debt
SaleVoided	7	Depende de sale
CashLedgerEntryCreated	8	Bajo riesgo
Implementación:
Modificar queueRelay() para agregar priority al job:

TypeScript

async queueRelay(event: Event) {
  // ... existing checks ...
  
  await this.syncQueue.add('relay-event', data, {
    jobId: `relay-${event.event_id}`,
    priority: this.getRelayPriority(event.type),
    attempts: 10,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600, count: 5000 },
    removeOnFail: { age: 86400 },
  });
}

private getRelayPriority(eventType: string): number {
  const priorities: Record<string, number> = {
    CashSessionOpened: 1,
    CashSessionClosed: 2,
    ProductCreated: 3,
    ProductUpdated: 3,
    CustomerCreated: 3,
    CustomerUpdated: 3,
    DebtCreated: 4,
    SaleCreated: 5,
    StockReceived: 5,
    StockAdjusted: 5,
    StockDeltaApplied: 5,
    DebtPaymentRecorded: 6,
    DebtPaymentAdded: 6,
    SaleVoided: 7,
    CashLedgerEntryCreated: 8,
  };
  return priorities[eventType] ?? 10;
}
Tests requeridos:

CashSessionOpened se procesa antes que SaleCreated
DebtCreated se procesa antes que DebtPaymentRecorded
Prioridad default es 10 para tipos desconocidos
Deliverable 11: Conflict Audit Trail
Especificación
Modificar apps/api/src/sync/conflict-resolution.service.ts

Objetivo: Cada vez que un conflicto se resuelve automáticamente
(LWW, AWSet, MVR), guardar un registro en conflict_audit_log
con el ganador, perdedores y estrategia usada.

Modificaciones:

Agregar método saveConflictAudit()
Llamar en resolveWithLWW(), resolveWithAWSet(), etc.
No fallar el sync si el audit falla (try-catch silencioso)
Endpoint de consulta (opcional pero recomendado):

text

GET /sync/conflicts/audit?store_id=xxx&from=2025-01-01&to=2025-01-31
Tests requeridos:

Conflicto LWW → audit log creado con ganador y perdedor
Error en saveConflictAudit no rompe el sync
Endpoint retorna audit logs filtrados por fecha
Checklist de deploy Phase 3
text

PRE-DEPLOY:
  [ ] FiscalSequenceService con tests
  [ ] Endpoint /fiscal/reserve-range funcional
  [ ] PWA fiscal-offline.service integrado
  [ ] Causal relay priorities implementadas
  [ ] Conflict audit trail implementado
  [ ] Migración de fiscal_sequence_ranges ejecutada

DEPLOY:
  [ ] Deploy API
  [ ] Deploy PWA
  [ ] Reservar rangos de prueba para dispositivos
  [ ] Verificar prioridades en BullMQ dashboard
  [ ] Crear conflicto de prueba y verificar audit log

POST-DEPLOY:
  [ ] 0 fiscal numbers duplicados en 24h
  [ ] Audit log registra conflictos correctamente
  [ ] Relay procesa sesiones antes que ventas
Criterios de éxito Phase 3
Dispositivos offline pueden facturar sin colisiones
Eventos se replican en orden causal correcto
Conflictos auto-resueltos tienen audit trail completo
Tiempo estimado: 7 días
text


---

## `PHASE-4-ESCROW.md`

```markdown
# PHASE 4 — ESCROW & STOCK PROTECTION

## Contexto
Lee MASTER-CONTEXT.md antes de ejecutar esta fase.
Las Phases 0-3 deben estar COMPLETADAS.

## Rol
Actúa como Senior Backend Engineer. Tu objetivo es conectar el
sistema de Inventory Escrow (que ya existe pero no está integrado
con ventas) al flujo de prefetch del PWA, y agregar validación
de stock server-side en modo "soft" (warn, no block).

## Prerrequisitos
- [ ] Phases 0-3 completadas
- [ ] InventoryEscrowService ya existe en el codebase
- [ ] Stock validator PWA (Phase 2) funcionando

---

## Deliverable 12: Auto-Escrow en Prefetch

### Especificación

**Objetivo:** Cuando un dispositivo PWA se conecta y hace prefetch
de datos, automáticamente reservar cuotas de stock para los
productos más vendidos. Esto permite que al ir offline, el
dispositivo tenga una "reserva" de stock que no se puede
vender por otros dispositivos.

**Modificar:** `apps/pwa/src/services/prefetch.service.ts`

**Lógica:**
1. Al hacer prefetch, obtener top 50 productos por ventas
2. Para cada producto con track_inventory = true:
   - Calcular qty = ceil(avg_daily_sales * 0.5)
   - Mínimo: 2 unidades, Máximo: 20 unidades
3. POST /inventory/escrow/batch-grant con la lista
4. Guardar quotas en IndexedDB store 'escrow_quotas'
5. El stock validator (Phase 2) suma escrow a available

**Backend — crear endpoint batch:**
```typescript
POST /inventory/escrow/batch-grant
Body: {
  device_id: string,
  items: Array<{
    product_id: string,
    qty: number,
    expires_at: string  // ISO date
  }>
}
Response: {
  granted: Array<{ product_id, qty_granted }>,
  denied: Array<{ product_id, reason }>,
}
Reglas:

Escrow expira a las 4 horas (configurable)
No reservar más del 30% del stock disponible por dispositivo
Si stock < qty solicitada, reservar lo que haya
Reclaim automático por cron existente (reclaimExpiredQuotas)
Tests requeridos:

Prefetch reserva escrow para top productos
Escrow se guarda en IndexedDB
Stock validator suma escrow al calcular disponible
Escrow no excede 30% del stock
Escrow expira correctamente a las 4h
Dispositivo offline consume de su escrow
Deliverable 13: Server Stock Validation (Soft Mode)
Especificación
Modificar: apps/api/src/sync/sync.service.ts

Objetivo: Agregar validación de stock en el servidor cuando
recibe un SaleCreated. En modo "soft" (warn), la venta se
acepta SIEMPRE pero se genera una alerta si hay overselling.

Implementación:
Agregar después de la validación de precios existente:

TypeScript

// Dentro de validateSaleCreatedEventBatch o después del loop de items:

// Solo validar si NO viene de federation (evitar rechazar ventas legítimas)
if (authenticatedUserId !== 'system-federation') {
  const stockWarnings = await this.checkStockAvailability(
    storeId, payload.items, dto.device_id
  );
  
  if (stockWarnings.length > 0) {
    this.logger.warn(
      `⚠️ Overselling detected in ${event.event_id}: ${stockWarnings.join('; ')}`
    );
    // NO rechazar — solo alertar
    await this.createOversellAlert(storeId, event.event_id, stockWarnings);
  }
}
createOversellAlert:
Guardar en tabla de alertas o emitir notificación al owner.

Tests requeridos:

Venta con stock suficiente → sin warning
Venta con overselling → warning logueado, venta aceptada
Venta de federation → NO se valida stock (evitar rechazos)
Alerta de overselling se crea correctamente
Deliverable 14: Oversell Alerting System
Especificación
Crear: apps/api/src/inventory/oversell-alert.service.ts

Objetivo: Detectar stock negativo y alertar al dueño de la tienda.

Cron: Cada 5 minutos, verificar si hay productos con stock < 0:

SQL

SELECT p.id, p.name, ws.stock, w.name AS warehouse
FROM warehouse_stock ws
JOIN products p ON p.id = ws.product_id
JOIN warehouses w ON w.id = ws.warehouse_id
WHERE w.store_id = $1
  AND ws.stock < 0
Acción:

Loguear warning
Crear notificación in-app para el owner
Si hay webhook configurado, enviar alerta
Marcar productos alertados para no re-alertar en 1h
Tests requeridos:

Stock negativo detectado → alerta creada
No re-alertar dentro de 1 hora
Alerta incluye nombre de producto y cantidad negativa
Checklist de deploy Phase 4
text

PRE-DEPLOY:
  [ ] Auto-escrow en prefetch implementado
  [ ] Batch-grant endpoint funcional
  [ ] Server stock validation (soft mode)
  [ ] Oversell alerting service
  [ ] Tests pasan

DEPLOY:
  [ ] Deploy API
  [ ] Deploy PWA
  [ ] Verificar escrow se reserva al conectar PWA
  [ ] Verificar IndexedDB tiene escrow_quotas
  [ ] Provocar overselling de prueba → verificar alerta

POST-DEPLOY:
  [ ] Escrow quotas se reservan y expiran correctamente
  [ ] Oversell alerts se generan cuando corresponde
  [ ] Ventas offline con escrow funcionan correctamente
Criterios de éxito Phase 4
Dispositivos obtienen escrow automáticamente al conectar
Overselling genera alertas visibles para el dueño
Ventas NUNCA se bloquean en el servidor (soft mode)
Tiempo estimado: 7 días
text


---

## `PHASE-5-OBSERVABILITY.md`

```markdown
# PHASE 5 — OBSERVABILITY & MONITORING

## Contexto
Lee MASTER-CONTEXT.md antes de ejecutar esta fase.
Las Phases 0-4 deben estar COMPLETADAS.

## Rol
Actúa como Senior SRE / Platform Engineer. Tu objetivo es
implementar un sistema de observabilidad que permita detectar
problemas de consistencia entre nodos ANTES de que causen
impacto en el negocio.

## Prerrequisitos
- [ ] Phases 0-4 completadas
- [ ] Tabla federation_health_snapshots creada (migración Phase 0)

---

## Deliverable 15: SplitBrainMonitorService

### Especificación

Crear `apps/api/src/sync/split-brain-monitor.service.ts`

**Objetivo:** Servicio que calcula métricas de salud de la
federación y detecta divergencias entre nodos.

**Métricas a calcular:**

| Métrica | Query | Umbral Warning | Umbral Critical |
|---------|-------|---------------|-----------------|
| Event lag (no relayed) | eventos sin outbox processed | >20 | >100 |
| Projection gaps (sales) | SaleCreated sin row en sales | >0 | >10 |
| Projection gaps (debts) | DebtCreated sin row en debts | >0 | >5 |
| Stock divergence | warehouse_stock vs SUM(movements) | >5 SKUs | >20 SKUs |
| Negative stock | warehouse_stock.stock < 0 | >0 | >5 |
| Outbox backlog | outbox pending | >10 | >50 |
| Outbox dead | outbox dead | >0 | >5 |
| Queue depth | BullMQ waiting + active | >50 | >200 |
| Failed jobs | BullMQ failed | >0 | >10 |
| Remote reachable | probeRemote() | false | false |
| Remote latency | probeRemote() latency | >2000ms | >5000ms |
| Fiscal duplicates | fiscal_number COUNT > 1 | >0 | >0 |
| Conflict rate | conflict_audit_log last 1h | >10/h | >50/h |

**Método principal:**
```typescript
async getHealthReport(storeId: string): Promise<FederationHealthReport>
Cron — snapshot cada 5 minutos:

TypeScript

@Cron('*/5 * * * *')
async takeHealthSnapshot()
Guardar en federation_health_snapshots para histórico.

Overall health calculation:

healthy: Todas las métricas bajo warning threshold
degraded: Al menos una métrica en warning
critical: Al menos una métrica en critical
Tests requeridos:

Store saludable → overallHealth = 'healthy'
Projection gap > 0 → overallHealth = 'degraded'
Stock negativo > 5 → overallHealth = 'critical'
Snapshot se guarda en tabla
Métricas se calculan correctamente contra datos reales
Deliverable 16: Health Endpoint
Especificación
Agregar endpoint:

text

GET /sync/federation/health?store_id=xxx
Authorization: Bearer {admin_key}
Response format:

JSON

{
  "timestamp": "2025-01-15T10:30:00Z",
  "storeId": "xxx",
  "overallHealth": "healthy",
  "federation": {
    "enabled": true,
    "remoteReachable": true,
    "latencyMs": 145,
    "queueDepth": 3,
    "failedJobs": 0,
    "circuitBreakerState": "CLOSED"
  },
  "consistency": {
    "eventLag": { "count": 0, "oldestMinutes": null },
    "projectionGaps": {
      "sales": 0,
      "debts": 0,
      "debtPayments": 0,
      "sessions": 0
    },
    "stockDivergence": { "divergent": 0, "negative": 0 },
    "outbox": { "pending": 2, "dead": 0, "avgProcessingMs": 150 }
  },
  "conflicts": {
    "last24h": 3,
    "unresolved": 0,
    "byStrategy": { "lww": 2, "awset": 1 }
  },
  "fiscal": {
    "activeRanges": 2,
    "exhaustedRanges": 1,
    "duplicateNumbers": 0
  },
  "escrow": {
    "activeQuotas": 15,
    "expiredReclaimed": 3,
    "totalReserved": 120
  }
}
Health history endpoint:

text

GET /sync/federation/health/history?store_id=xxx&hours=24
Retorna los snapshots de las últimas N horas.

Deliverable 17: Alertas Automáticas
Especificación
Crear: apps/api/src/sync/federation-alerts.service.ts

Objetivo: Cuando el health cambia de healthy → degraded
o degraded → critical, crear alertas automáticas.

Canales de alerta:

Logger (siempre)
Notificación in-app al owner (tabla notifications)
Webhook (si configurado en store settings)
Alertas específicas:

FEDERATION_CRITICAL: Overall health es critical
PROJECTION_GAP_DETECTED: Hay eventos sin proyección
OVERSELLING_DETECTED: Stock negativo encontrado
FISCAL_DUPLICATE: Número fiscal duplicado (P0 inmediato)
FEDERATION_OFFLINE: Remote unreachable por >5 minutos
OUTBOX_DEAD_ENTRIES: Entries que fallaron 10+ veces
De-duplication:
No enviar la misma alerta más de una vez por hora.

Deliverable 18: Runbook de Incidentes
Especificación
Crear docs/runbooks/federation-incidents.md

Contenido:

¿Cómo verificar el health de la federación?
¿Qué hacer si overallHealth = critical?
¿Qué hacer si hay projection gaps?
¿Qué hacer si hay stock negativo?
¿Qué hacer si hay números fiscales duplicados?
¿Qué hacer si el remote está unreachable?
¿Cómo forzar una reconciliación manual?
¿Cómo replay events específicos?
¿Cómo verificar el outbox?
¿Cómo verificar el circuit breaker?
Queries diagnósticas de referencia rápida
Contactos de escalación
Checklist de deploy Phase 5
text

PRE-DEPLOY:
  [ ] SplitBrainMonitorService con tests
  [ ] Health endpoint funcional
  [ ] Federation alerts service
  [ ] Runbook completo
  [ ] Health snapshot cron funciona

DEPLOY:
  [ ] Deploy API
  [ ] Verificar GET /federation/health retorna datos correctos
  [ ] Verificar snapshots se guardan cada 5 min
  [ ] Simular problema → verificar alerta se genera
  [ ] Publicar runbook en documentación interna

POST-DEPLOY:
  [ ] Health = 'healthy' por 24h consecutivas
  [ ] Snapshots históricos accesibles
  [ ] Alertas funcionan end-to-end
Criterios de éxito Phase 5
Health endpoint muestra estado real del sistema
Alertas se disparan cuando hay problemas reales
Equipo puede diagnosticar problemas siguiendo el runbook
Histórico de health permite ver tendencias
Tiempo estimado: 7 días
text


---

## `PHASE-6-HARDENING.md`

```markdown
# PHASE 6 — HARDENING & RELEASE

## Contexto
Lee MASTER-CONTEXT.md antes de ejecutar esta fase.
Las Phases 0-5 deben estar COMPLETADAS.

## Rol
Actúa como Senior QA Engineer / SRE. Tu objetivo es validar
todo el trabajo realizado con chaos testing, crear documentación
final y preparar el release.

## Prerrequisitos
- [ ] Phases 0-5 completadas y en producción
- [ ] Health endpoint mostrando 'healthy' por >48h
- [ ] 0 projection gaps en últimas 48h
- [ ] 0 fiscal duplicates
- [ ] Fiaos replicando correctamente

---

## Deliverable 19: Chaos Tests

### Especificación

Crear `apps/api/test/chaos/` con los siguientes test suites:

**Suite 1: Overselling Prevention**
```typescript
describe('Chaos: Overselling', () => {
  // Setup: Product X with stock = 5

  it('two offline POS sell more than available stock', async () => {
    // POS-A sells 4 (offline)
    // POS-B sells 3 (offline)
    // Both sync
    // Verify: both accepted (AWSet)
    // Verify: stock = -2 (negative)
    // Verify: oversell alert created
  });

  it('escrow prevents overselling between devices', async () => {
    // POS-A gets escrow for 3 units
    // POS-B gets escrow for 2 units (remaining)
    // POS-A tries to sell 4 offline → blocked (only 3 in escrow)
    // POS-B sells 2 offline → OK
    // Verify: total sold = 5, stock = 0
  });
});
Suite 2: Projection Gap Recovery

TypeScript

describe('Chaos: Projection Gaps', () => {
  it('sale event saved but projection fails → healer recovers', async () => {
    // Mock projections to fail
    // Push SaleCreated event
    // Verify: event in DB, sale NOT in DB
    // Wait for OrphanHealer cron
    // Verify: sale now in DB
  });

  it('debt event saved but projection fails → healer recovers', async () => {
    // Same pattern for DebtCreated
  });
});
Suite 3: Federation Partition

TypeScript

describe('Chaos: Federation Partition', () => {
  it('remote unreachable → circuit opens → events queue', async () => {
    // Mock remote to timeout
    // Push 10 events
    // Verify: circuit breaker OPEN
    // Verify: events in BullMQ queue
    // Restore remote
    // Wait for retry
    // Verify: events relayed, circuit CLOSED
  });

  it('reconcile detects and repairs gaps after partition', async () => {
    // Create events on node A only
    // Run reconcile
    // Verify: events replayed to node B
    // Verify: projections exist on node B
  });
});
Suite 4: Fiscal Range Safety

TypeScript

describe('Chaos: Fiscal Ranges', () => {
  it('two devices cannot get overlapping ranges', async () => {
    // Reserve range for device A (1-50)
    // Reserve range for device B (51-100)
    // Verify: no overlap
  });

  it('expired range is not reused', async () => {
    // Reserve range 1-50
    // Expire it
    // Reserve new range
    // Verify: new range starts at 51, not 1
  });
});
Suite 5: Outbox Reliability

TypeScript

describe('Chaos: Outbox', () => {
  it('outbox entry fails 9 times then succeeds', async () => {
    // Mock projection to fail 9 times
    // Verify: retry_count increments
    // 10th attempt succeeds
    // Verify: status = 'processed'
  });

  it('outbox entry fails 10 times → marked dead', async () => {
    // Mock projection to always fail
    // After 10 retries
    // Verify: status = 'dead'
    // Verify: alert created
  });
});
Deliverable 20: Documentation
Especificación
Crear/actualizar los siguientes documentos:

1. docs/architecture/sync-federation.md

Diagrama de arquitectura actualizado
Flujo de un evento end-to-end
CRDT strategies por entidad
Vector clock usage
Federation relay flow
Reconciliation process
2. docs/architecture/split-brain-mitigations.md

Lista de mitigaciones implementadas
Qué protege cada una
Limitaciones conocidas
Trade-offs aceptados
3. docs/api/federation-endpoints.md

Todos los endpoints de federation
Request/response examples
Authentication requirements
Rate limits
4. CHANGELOG.md actualizado

Lista de todos los cambios por phase
Breaking changes (si alguno)
Migration steps
Deliverable 21: Runbook Final Publicado
Especificación
Actualizar docs/runbooks/federation-incidents.md con:

Lecciones aprendidas durante la implementación
Queries diagnósticas finales verificadas
Procedimientos probados en chaos testing
Screenshots del health endpoint
Tiempos de respuesta esperados
Deliverable 22: Release Notes & Retrospectiva
Especificación
Crear docs/releases/split-brain-remediation-v1.md

Contenido:

Resumen ejecutivo de lo implementado
Métricas antes/después
Riesgos eliminados
Riesgos residuales aceptados
Trabajo futuro (backlog)
Retrospectiva del proyecto
Backlog futuro (no implementado):

PN-Counter para inventario distribuido
P2P sync entre dispositivos (WebRTC)
UI de resolución manual de conflictos
Dashboard visual de federation health
Automated chaos testing en CI/CD
Checklist final
text

VERIFICATION:
  [ ] Chaos tests pasan al 100%
  [ ] Health = 'healthy' por 72h consecutivas
  [ ] 0 projection gaps en últimas 72h
  [ ] 0 fiscal duplicates en últimas 72h
  [ ] 0 outbox dead entries en últimas 72h
  [ ] Fiaos replican correctamente (verificado manualmente)
  [ ] Stock validator funciona en PWA offline
  [ ] Circuit breaker no ha abierto innecesariamente
  [ ] Escrow se reserva y expira correctamente
  [ ] Runbook revisado por al menos 1 persona adicional

DOCUMENTATION:
  [ ] Arquitectura actualizada
  [ ] API endpoints documentados
  [ ] Runbook completo y verificado
  [ ] CHANGELOG actualizado
  [ ] Release notes escritas
  [ ] Retrospectiva realizada

PRODUCTION:
  [ ] Todos los servicios nuevos monitorizados
  [ ] Alertas configuradas y probadas
  [ ] Backups verificados
  [ ] Plan de rollback documentado para cada phase
Criterios de éxito final del Master Plan
text

╔══════════════════════════════════════════════════════════╗
║  MÉTRICA                          │ ANTES │ DESPUÉS      ║
╠══════════════════════════════════════════════════════════╣
║  Fiaos replicando                 │  ❌   │  ✅          ║
║  Projection gaps (daily)          │  ??   │  0           ║
║  Overselling alertado             │  ❌   │  ✅          ║
║  Fiscal number duplicates         │  ??   │  0           ║
║  Federation health visible        │  ❌   │  ✅ endpoint  ║
║  Outbox atomicity                 │  ❌   │  ✅          ║
║  Circuit breaker protection       │  ❌   │  ✅          ║
║  Distributed lock safety          │  ❌   │  ✅          ║
║  Chaos tests coverage             │  0    │  5 suites    ║
║  Incident runbook                 │  ❌   │  ✅          ║
║  Time to detect problems          │  ∞    │  <5 min      ║
║  Time to resolve problems         │  ∞    │  <30 min     ║
╚══════════════════════════════════════════════════════════╝
Tiempo estimado: 5 días
Tiempo total del Master Plan: 42 días
text


---

Cada archivo `.md` es **autocontenido** — un agente puede tomar cualquier fase y ejecutarla sin necesitar contexto adicional más allá de `MASTER-CONTEXT.md`. Las dependencias entre fases están explícitas en los prerrequisitos de cada una.