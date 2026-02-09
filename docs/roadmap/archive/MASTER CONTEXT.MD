Master Plan 24/7 — Velox POS Split Brain Remediation
Visión General del Plan
text

╔══════════════════════════════════════════════════════════════════╗
║                    MASTER PLAN OVERVIEW                          ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  DURACIÓN TOTAL: 6 semanas (42 días)                            ║
║  MODALIDAD: 24/7 con rotación de fases                          ║
║  DESARROLLADOR: 1 (tú)                                          ║
║                                                                  ║
║  ESTRUCTURA DIARIA:                                              ║
║  ┌──────────────────────────────────────────┐                   ║
║  │ 🌅 Mañana (8:00-12:00)  → Código nuevo  │                   ║
║  │ 🌤️ Tarde  (13:00-18:00) → Código + Tests │                   ║
║  │ 🌙 Noche  (20:00-23:00) → Review + Deploy│                   ║
║  │ 🤖 Madrugada            → CI/CD + Monitoring auto           ║
║  └──────────────────────────────────────────┘                   ║
║                                                                  ║
║  REGLA DE ORO: Cada tarea debe poder desplegarse               ║
║  independientemente sin romper lo que ya funciona.               ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
Roadmap Visual
text

SEMANA 0        SEMANA 1        SEMANA 2        SEMANA 3        SEMANA 4        SEMANA 5        SEMANA 6
(Día 0-2)       (Día 3-9)       (Día 10-16)     (Día 17-23)     (Día 24-30)     (Día 31-37)     (Día 38-42)
│               │               │               │               │               │               │
▼               ▼               ▼               ▼               ▼               ▼               ▼
┌─────────┐   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────┐
│TRIAGE   │   │ PHASE 1     │ │ PHASE 2     │ │ PHASE 3     │ │ PHASE 4     │ │ PHASE 5     │ │PHASE 6   │
│         │   │             │ │             │ │             │ │             │ │             │ │          │
│• Diagnós│   │• [x]FixFiaos│ │• [x]Stock   │ │• Fiscal     │ │• Escrow     │ │• Observabil │ │• Chaos   │
│• Queries│   │• [x]Orphan H│ │  Validation │ │  Ranges     │ │  Automático │ │• Dashboard  │ │  Testing │
│• Backup │   │• [x]Outbox  │ │• [x]Circuit │ │• Causal     │ │• PN-Counter │ │• Alertas    │ │• Hardening│
│• Hotfix │   │• [x]Reconcil│ │  Breaker    │ │  Relay      │ │• Conflict   │ │• Runbook    │ │• Docs    │
│  fiaos  │   │     Fix     │ │• [x]Lock    │ │• Hash fix   │ │  Audit UI   │ │• Metrics    │ │• Release │
└─────────┘   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └──────────┘
    🔴              🔴              🔴              🟡              🟡              🟢              🟢
   CRÍTICO        CRÍTICO         CRÍTICO        IMPORTANTE     IMPORTANTE      MEJORA          CIERRE
SEMANA 0 — TRIAGE DE EMERGENCIA (Día 0-2)
Objetivo: Diagnosticar y hotfix el problema de fiaos
text

DÍA 0 (HOY) — Diagnóstico
═══════════════════════════════════════════════════════════

⏰ 08:00-10:00 │ Ejecutar queries diagnósticas
────────────────┼──────────────────────────────────────
                │ Ejecutar en SUPABASE:
SQL

-- Q1: Eventos DebtCreated en Supabase
SELECT COUNT(*) AS total_debt_events,
       COUNT(DISTINCT payload->>'debt_id') AS unique_debts
FROM events
WHERE type IN ('DebtCreated', 'DebtPaymentRecorded', 'DebtPaymentAdded')
  AND created_at > NOW() - INTERVAL '30 days';

-- Q2: Debts materializados en Supabase
SELECT COUNT(*) AS total_debts FROM debts
WHERE created_at > NOW() - INTERVAL '30 days';

-- Q3: Gaps entre eventos y proyecciones
SELECT 
  e.payload->>'debt_id' AS debt_id,
  e.event_id,
  e.type,
  e.device_id,
  e.created_at,
  e.projection_status,
  CASE WHEN d.id IS NOT NULL THEN '✅' ELSE '❌ MISSING' END AS projected
FROM events e
LEFT JOIN debts d ON d.id = (e.payload->>'debt_id')::uuid
WHERE e.type = 'DebtCreated'
  AND e.created_at > NOW() - INTERVAL '30 days'
ORDER BY e.created_at DESC;
SQL

-- Ejecutar en NODO 1 (PostgreSQL local):

-- Q4: ¿Llegaron los eventos?
SELECT COUNT(*) AS debt_events_in_node1,
       COUNT(DISTINCT payload->>'debt_id') AS unique_debts
FROM events
WHERE type IN ('DebtCreated', 'DebtPaymentRecorded', 'DebtPaymentAdded')
  AND created_at > NOW() - INTERVAL '30 days';

-- Q5: ¿Se proyectaron?
SELECT 
  e.payload->>'debt_id' AS debt_id,
  e.event_id,
  e.type,
  e.projection_status,
  e.projection_error,
  CASE WHEN d.id IS NOT NULL THEN '✅' ELSE '❌' END AS has_row
FROM events e
LEFT JOIN debts d ON d.id = (e.payload->>'debt_id')::uuid
WHERE e.type = 'DebtCreated'
  AND e.created_at > NOW() - INTERVAL '30 days'
ORDER BY e.created_at DESC
LIMIT 50;

-- Q6: Schema comparison
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'debts'
ORDER BY ordinal_position;

-- Q7: Stock negativo (verificar overselling existente)
SELECT p.name, ws.stock, w.name AS warehouse
FROM warehouse_stock ws
JOIN products p ON p.id = ws.product_id
JOIN warehouses w ON w.id = ws.warehouse_id
WHERE ws.stock < 0;

-- Q8: Federation status
SELECT 
  type,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE device_id LIKE '%federation%') AS from_federation,
  MIN(created_at) AS oldest,
  MAX(created_at) AS newest
FROM events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY type
ORDER BY total DESC;
text

⏰ 10:00-12:00 │ Analizar resultados y determinar causa raíz
────────────────┼──────────────────────────────────────

  RESULTADO Q4 = 0    → Los eventos NUNCA llegaron
  │                      → Problema en relay/federation
  │
  RESULTADO Q4 > 0    → Los eventos SÍ llegaron  
  │ PERO Q5 = ❌       → Proyección falla
  │                      → Problema en ProjectionsService
  │
  RESULTADO Q5 = ✅    → Todo proyectado
                         → Problema en la UI/API de consulta

⏰ 13:00-18:00 │ HOTFIX según causa raíz (ver abajo)
────────────────┼──────────────────────────────────────

⏰ 20:00-22:00 │ Deploy hotfix + verificar
────────────────┼──────────────────────────────────────
Hotfix A: Si los eventos nunca llegaron al Nodo 1
TypeScript

// Verificar federation-sync.service.ts
// ¿El relay incluye DebtCreated en los tipos que procesa?

// Forzar replay manual AHORA:
// POST /sync/federation/auto-reconcile
// Body: { "store_id": "TU_STORE_ID" }

// Verificar que el resultado muestra:
// debts.localMissingCount > 0 && debts.replayedToLocal > 0
Hotfix B: Si los eventos llegaron pero no se proyectaron
TypeScript

// projections.service.ts — VERIFICAR que estos cases existan:

async projectEvent(event: Event) {
  switch (event.type) {
    // ... otros cases ...
    
    case 'DebtCreated':
      await this.projectDebt(event);        // ← ¿EXISTE?
      break;
    case 'DebtPaymentRecorded':
    case 'DebtPaymentAdded':
      await this.projectDebtPayment(event);  // ← ¿EXISTE?
      break;
  }
}

// Si NO existen, AGREGARLOS:
private async projectDebt(event: Event) {
  const payload = event.payload as any;
  
  // Verificar que no exista ya (idempotencia)
  const exists = await this.debtRepository.findOne({
    where: { id: payload.debt_id }
  });
  if (exists) return;

  await this.debtRepository.save({
    id: payload.debt_id,
    store_id: event.store_id,
    customer_id: payload.customer_id,
    sale_id: payload.sale_id,
    total_amount: payload.total_amount,
    remaining_amount: payload.remaining_amount ?? payload.total_amount,
    status: payload.status ?? 'pending',
    notes: payload.notes,
    created_at: event.created_at,
    created_by: event.actor_user_id,
  });
}
text

DÍA 1 — Verificación y Backup
═══════════════════════════════════════════════════════════

⏰ 08:00-10:00 │ Verificar que el hotfix funcionó
────────────────┼──────────────────────────────────────
                │ • Re-ejecutar Q5 → todos ✅
                │ • Verificar UI de fiaos muestra datos
                │ • Crear nuevo fiao y verificar replica

⏰ 10:00-12:00 │ Backup completo de ambos nodos
────────────────┼──────────────────────────────────────
Bash

# Backup Supabase
pg_dump $SUPABASE_DB_URL \
  --format=custom \
  --no-owner \
  -f backup_supabase_$(date +%Y%m%d).dump

# Backup Nodo 1
pg_dump $NODE1_DB_URL \
  --format=custom \
  --no-owner \
  -f backup_node1_$(date +%Y%m%d).dump

# Snapshot de estado de federation
curl -s https://tu-api/sync/federation/status \
  -H "Authorization: Bearer $ADMIN_KEY" \
  | jq . > federation_status_$(date +%Y%m%d).json
text

⏰ 13:00-18:00 │ Preparar infraestructura para Phase 1
────────────────┼──────────────────────────────────────
                │ • Crear rama: git checkout -b fix/split-brain-master
                │ • Configurar CI pipeline para tests incrementales
                │ • Crear tabla outbox_entries (migración)

⏰ 20:00-22:00 │ Documentar hallazgos del diagnóstico
────────────────┼──────────────────────────────────────

DÍA 2 — Preparación
═══════════════════════════════════════════════════════════

⏰ 08:00-18:00 │ Crear migración para outbox + conflict_audit
────────────────┼──────────────────────────────────────
SQL

-- Migration: 20250101000001_add_outbox_and_audit.sql

-- 1. Outbox para garantizar atomicidad event + projection + relay
CREATE TABLE IF NOT EXISTS outbox_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  store_id UUID NOT NULL,
  target VARCHAR(50) NOT NULL,  -- 'projection' | 'federation-relay'
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

-- 2. Audit trail para conflictos resueltos
CREATE TABLE IF NOT EXISTS conflict_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255),
  winner_event_id VARCHAR(255) NOT NULL,
  loser_event_ids TEXT[] NOT NULL DEFAULT '{}',
  strategy VARCHAR(50) NOT NULL,  -- 'lww', 'awset', 'mvr', 'server_wins'
  winner_payload JSONB,
  loser_payloads JSONB,
  resolved_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_by VARCHAR(100) DEFAULT 'auto'
);

CREATE INDEX idx_conflict_audit_store 
  ON conflict_audit_log (store_id, resolved_at DESC);

-- 3. Fiscal sequence ranges (preparación)
CREATE TABLE IF NOT EXISTS fiscal_sequence_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  series_id UUID NOT NULL,
  device_id VARCHAR(255) NOT NULL,
  range_start INT NOT NULL,
  range_end INT NOT NULL,
  used_up_to INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',  -- 'active' | 'exhausted' | 'expired'
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  CONSTRAINT uq_fiscal_range_device 
    UNIQUE (store_id, series_id, device_id, range_start)
);

CREATE INDEX idx_fiscal_ranges_active 
  ON fiscal_sequence_ranges (store_id, device_id, status) 
  WHERE status = 'active';

-- 4. Federation health snapshots
CREATE TABLE IF NOT EXISTS federation_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  overall_health VARCHAR(20) NOT NULL,
  event_lag_count INT DEFAULT 0,
  projection_gap_count INT DEFAULT 0,
  stock_divergence_count INT DEFAULT 0,
  negative_stock_count INT DEFAULT 0,
  queue_depth INT DEFAULT 0,
  failed_jobs INT DEFAULT 0,
  remote_reachable BOOLEAN DEFAULT true,
  remote_latency_ms INT,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_health_snapshots 
  ON federation_health_snapshots (store_id, snapshot_at DESC);
PHASE 1 — FOUNDATION FIXES (Día 3-9)
Objetivo: Eliminar los gaps de proyección y federation
text

╔══════════════════════════════════════════════════════════════╗
║  PHASE 1 DELIVERABLES                                        ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ✅ D1: healOrphanedProjections() — Cron auto-healer        ║
║  ✅ D2: Reconcile basado en events (no projections)          ║
║  ✅ D3: Outbox pattern para atomicidad                       ║
║  ✅ D4: Tests para cada fix                                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
Día 3-4: Orphan Healer + Reconcile Fix
text

DÍA 3
═══════════════════════════════════════════════════════════

⏰ 08:00-12:00 │ healOrphanedProjections service
────────────────┼──────────────────────────────────────
TypeScript

// apps/api/src/sync/orphan-healer.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Event } from '../database/entities/event.entity';
import { ProjectionsService } from '../projections/projections.service';

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

@Injectable()
export class OrphanHealerService {
  private readonly logger = new Logger(OrphanHealerService.name);
  private healingInProgress = false;

  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private projectionsService: ProjectionsService,
    private dataSource: DataSource,
  ) {}

  /**
   * Cada 2 minutos, busca eventos que se guardaron
   * pero cuya proyección falló o nunca se ejecutó.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async autoHealCron() {
    if (this.healingInProgress) return;
    
    this.healingInProgress = true;
    try {
      const storeIds = await this.getActiveStoreIds();
      for (const storeId of storeIds) {
        await this.healStore(storeId);
      }
    } catch (error) {
      this.logger.error(`Auto-heal failed: ${error.message}`);
    } finally {
      this.healingInProgress = false;
    }
  }

  async healStore(storeId: string): Promise<OrphanHealResult> {
    const result: OrphanHealResult = {
      checked: 0,
      healed: 0,
      failed: 0,
      details: [],
    };

    // 1. Sales sin proyección
    const orphanedSales = await this.dataSource.query(`
      SELECT e.event_id, e.type
      FROM events e
      LEFT JOIN sales s ON s.id = (e.payload->>'sale_id')::uuid
      WHERE e.store_id = $1
        AND e.type = 'SaleCreated'
        AND e.created_at > NOW() - INTERVAL '7 days'
        AND s.id IS NULL
        AND (e.projection_status IS NULL 
             OR e.projection_status != 'processed')
      ORDER BY e.created_at ASC
      LIMIT 50
    `, [storeId]);

    // 2. Debts sin proyección
    const orphanedDebts = await this.dataSource.query(`
      SELECT e.event_id, e.type
      FROM events e
      LEFT JOIN debts d ON d.id = (e.payload->>'debt_id')::uuid
      WHERE e.store_id = $1
        AND e.type = 'DebtCreated'
        AND e.created_at > NOW() - INTERVAL '7 days'
        AND d.id IS NULL
        AND (e.projection_status IS NULL 
             OR e.projection_status != 'processed')
      ORDER BY e.created_at ASC
      LIMIT 50
    `, [storeId]);

    // 3. Debt payments sin proyección
    const orphanedPayments = await this.dataSource.query(`
      SELECT e.event_id, e.type
      FROM events e
      LEFT JOIN debt_payments dp 
        ON dp.id = (e.payload->>'payment_id')::uuid
      WHERE e.store_id = $1
        AND e.type IN ('DebtPaymentRecorded', 'DebtPaymentAdded')
        AND e.created_at > NOW() - INTERVAL '7 days'
        AND dp.id IS NULL
        AND (e.projection_status IS NULL 
             OR e.projection_status != 'processed')
      ORDER BY e.created_at ASC
      LIMIT 50
    `, [storeId]);

    // 4. Voided sales sin proyección
    const orphanedVoids = await this.dataSource.query(`
      SELECT e.event_id, e.type
      FROM events e
      INNER JOIN sales s ON s.id = (e.payload->>'sale_id')::uuid
      WHERE e.store_id = $1
        AND e.type = 'SaleVoided'
        AND e.created_at > NOW() - INTERVAL '7 days'
        AND s.voided_at IS NULL
        AND (e.projection_status IS NULL 
             OR e.projection_status != 'processed')
      ORDER BY e.created_at ASC
      LIMIT 50
    `, [storeId]);

    const allOrphans = [
      ...orphanedSales,
      ...orphanedDebts,
      ...orphanedPayments,
      ...orphanedVoids,
    ];

    result.checked = allOrphans.length;

    if (allOrphans.length === 0) return result;

    this.logger.warn(
      `🩹 Found ${allOrphans.length} orphaned projections for store ${storeId}`
    );

    // 5. Reproyectar cada uno
    for (const orphan of allOrphans) {
      try {
        const event = await this.eventRepository.findOne({
          where: { event_id: orphan.event_id },
        });

        if (!event) {
          result.details.push({
            event_id: orphan.event_id,
            type: orphan.type,
            status: 'failed',
            error: 'Event not found in repository',
          });
          result.failed++;
          continue;
        }

        await this.projectionsService.projectEvent(event);

        await this.eventRepository.update(event.event_id, {
          projection_status: 'processed',
          projection_error: null,
        });

        result.details.push({
          event_id: orphan.event_id,
          type: orphan.type,
          status: 'healed',
        });
        result.healed++;

      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        
        await this.eventRepository.update(orphan.event_id, {
          projection_status: 'failed',
          projection_error: msg,
        });

        result.details.push({
          event_id: orphan.event_id,
          type: orphan.type,
          status: 'failed',
          error: msg,
        });
        result.failed++;
      }
    }

    if (result.healed > 0) {
      this.logger.log(
        `🩹 Healed ${result.healed}/${result.checked} orphaned projections ` +
        `for store ${storeId} (${result.failed} failed)`
      );
    }

    return result;
  }

  private async getActiveStoreIds(): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT DISTINCT store_id FROM events 
       WHERE created_at > NOW() - INTERVAL '24 hours'
       LIMIT 50`
    );
    return rows.map((r: { store_id: string }) => r.store_id);
  }
}
text

⏰ 13:00-18:00 │ Reconcile basado en events
────────────────┼──────────────────────────────────────
TypeScript

// Modificar federation-sync.service.ts
// Reemplazar getSalesIds para leer de events en vez de sales

async getSalesEventIds(
  storeId: string,
  dateFrom: string,
  dateTo: string,
  limit = 10000,
  offset = 0,
): Promise<FederationIdsResult> {
  const totalRows = await this.dataSource.query(`
    SELECT COUNT(DISTINCT payload->>'sale_id')::int AS total
    FROM events
    WHERE store_id = $1
      AND type = 'SaleCreated'
      AND created_at >= $2::date
      AND created_at < ($3::date + interval '1 day')
      AND payload->>'sale_id' IS NOT NULL
  `, [storeId, dateFrom, dateTo]);

  const rows = await this.dataSource.query(`
    SELECT DISTINCT payload->>'sale_id' AS id
    FROM events
    WHERE store_id = $1
      AND type = 'SaleCreated'
      AND created_at >= $2::date
      AND created_at < ($3::date + interval '1 day')
      AND payload->>'sale_id' IS NOT NULL
    ORDER BY id
    LIMIT $4 OFFSET $5
  `, [storeId, dateFrom, dateTo, limit, offset]);

  return {
    total: Number(totalRows?.[0]?.total || 0),
    ids: rows.map((row: { id: string }) => row.id),
  };
}

// Mismo patrón para debts:
async getDebtEventIds(
  storeId: string,
  dateFrom: string,
  dateTo: string,
  limit = 10000,
  offset = 0,
): Promise<FederationIdsResult> {
  const totalRows = await this.dataSource.query(`
    SELECT COUNT(DISTINCT payload->>'debt_id')::int AS total
    FROM events
    WHERE store_id = $1
      AND type = 'DebtCreated'
      AND created_at >= $2::date
      AND created_at < ($3::date + interval '1 day')
      AND payload->>'debt_id' IS NOT NULL
  `, [storeId, dateFrom, dateTo]);

  const rows = await this.dataSource.query(`
    SELECT DISTINCT payload->>'debt_id' AS id
    FROM events
    WHERE store_id = $1
      AND type = 'DebtCreated'
      AND created_at >= $2::date
      AND created_at < ($3::date + interval '1 day')
      AND payload->>'debt_id' IS NOT NULL
    ORDER BY id
    LIMIT $4 OFFSET $5
  `, [storeId, dateFrom, dateTo, limit, offset]);

  return {
    total: Number(totalRows?.[0]?.total || 0),
    ids: rows.map((row: { id: string }) => row.id),
  };
}
text

⏰ 20:00-23:00 │ Tests para orphan healer
────────────────┼──────────────────────────────────────
TypeScript

// orphan-healer.service.spec.ts

describe('OrphanHealerService', () => {
  it('should detect SaleCreated events without sales row', async () => {
    // Insertar evento SaleCreated sin row en sales
    await eventRepo.save(createMockEvent({
      type: 'SaleCreated',
      payload: { sale_id: 'test-sale-1', items: [], totals: {} },
    }));

    const result = await service.healStore(testStoreId);

    expect(result.checked).toBe(1);
    expect(result.healed).toBe(1);
    
    // Verificar que ahora existe en sales
    const sale = await salesRepo.findOne({ where: { id: 'test-sale-1' } });
    expect(sale).toBeDefined();
  });

  it('should detect DebtCreated events without debts row', async () => {
    await eventRepo.save(createMockEvent({
      type: 'DebtCreated',
      payload: { debt_id: 'test-debt-1', customer_id: 'c1', total_amount: 100 },
    }));

    const result = await service.healStore(testStoreId);

    expect(result.checked).toBe(1);
    expect(result.healed).toBe(1);
  });

  it('should be idempotent — skip already healed', async () => {
    // Heal twice
    await service.healStore(testStoreId);
    const result = await service.healStore(testStoreId);

    expect(result.checked).toBe(0);
  });
});
Día 5-6: Outbox Pattern
text

DÍA 5
═══════════════════════════════════════════════════════════

⏰ 08:00-18:00 │ Outbox service + processor
────────────────┼──────────────────────────────────────
TypeScript

// apps/api/src/sync/outbox.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../database/entities/event.entity';
import { ProjectionsService } from '../projections/projections.service';
import { FederationSyncService } from './federation-sync.service';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private processing = false;

  constructor(
    private dataSource: DataSource,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private projectionsService: ProjectionsService,
    private federationSyncService: FederationSyncService,
  ) {}

  /**
   * Escribir entradas de outbox dentro de la misma transacción
   * que los eventos.
   */
  async writeOutboxEntries(
    manager: any, // EntityManager from transaction
    events: Event[],
    includeFederationRelay: boolean,
  ): Promise<void> {
    const entries: any[] = [];

    for (const event of events) {
      // Siempre crear entrada para proyección
      entries.push({
        event_id: event.event_id,
        event_type: event.type,
        store_id: event.store_id,
        target: 'projection',
        status: 'pending',
      });

      // Federation relay (si no viene de federation)
      if (includeFederationRelay) {
        entries.push({
          event_id: event.event_id,
          event_type: event.type,
          store_id: event.store_id,
          target: 'federation-relay',
          status: 'pending',
        });
      }
    }

    if (entries.length > 0) {
      await manager.query(`
        INSERT INTO outbox_entries 
          (id, event_id, event_type, store_id, target, status, created_at)
        SELECT 
          gen_random_uuid(), 
          unnest($1::text[]),
          unnest($2::text[]),
          unnest($3::uuid[]),
          unnest($4::text[]),
          'pending',
          NOW()
      `, [
        entries.map(e => e.event_id),
        entries.map(e => e.event_type),
        entries.map(e => e.store_id),
        entries.map(e => e.target),
      ]);
    }
  }

  /**
   * Processor: cada 3 segundos procesa entradas pendientes.
   * Usa FOR UPDATE SKIP LOCKED para safety multi-pod.
   */
  @Cron('*/3 * * * * *') // Cada 3 segundos
  async processOutbox() {
    if (this.processing) return;
    this.processing = true;

    try {
      const entries = await this.dataSource.query(`
        SELECT id, event_id, event_type, store_id, target, retry_count
        FROM outbox_entries
        WHERE status = 'pending'
          AND retry_count < 10
        ORDER BY created_at ASC
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      `);

      if (entries.length === 0) return;

      for (const entry of entries) {
        try {
          await this.processEntry(entry);

          await this.dataSource.query(`
            UPDATE outbox_entries 
            SET status = 'processed', processed_at = NOW()
            WHERE id = $1
          `, [entry.id]);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          
          await this.dataSource.query(`
            UPDATE outbox_entries 
            SET retry_count = retry_count + 1,
                error = $2,
                status = CASE 
                  WHEN retry_count >= 9 THEN 'dead'
                  ELSE 'pending'
                END
            WHERE id = $1
          `, [entry.id, msg]);

          this.logger.error(
            `Outbox entry ${entry.id} failed (attempt ${entry.retry_count + 1}): ${msg}`
          );
        }
      }
    } catch (error) {
      this.logger.error(`Outbox processor error: ${error.message}`);
    } finally {
      this.processing = false;
    }
  }

  private async processEntry(entry: any): Promise<void> {
    const event = await this.eventRepository.findOne({
      where: { event_id: entry.event_id },
    });

    if (!event) {
      throw new Error(`Event ${entry.event_id} not found`);
    }

    switch (entry.target) {
      case 'projection':
        await this.projectionsService.projectEvent(event);
        await this.eventRepository.update(event.event_id, {
          projection_status: 'processed',
          projection_error: null,
        });
        break;

      case 'federation-relay':
        await this.federationSyncService.queueRelay(event);
        break;

      default:
        throw new Error(`Unknown outbox target: ${entry.target}`);
    }
  }

  /**
   * Limpieza periódica de entradas procesadas (>24h)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupProcessed() {
    const result = await this.dataSource.query(`
      DELETE FROM outbox_entries
      WHERE status = 'processed'
        AND processed_at < NOW() - INTERVAL '24 hours'
    `);
    
    if (result?.[1] > 0) {
      this.logger.debug(`🧹 Cleaned ${result[1]} processed outbox entries`);
    }
  }
}
Día 7-8: Integrar Outbox en SyncService
text

DÍA 7
═══════════════════════════════════════════════════════════

⏰ 08:00-18:00 │ Modificar SyncService.push() para usar outbox
────────────────┼──────────────────────────────────────
TypeScript

// sync.service.ts — Sección de guardado (líneas ~200-250)
// REEMPLAZAR el dual-write actual con outbox atómico:

// ANTES (vulnerable):
// await manager.createQueryBuilder().insert().into(Event)
//   .values(eventsToSave).orIgnore().execute();
// ... fuera de transacción ...
// await this.salesProjectionQueue.add(...)
// await this.federationSyncService.queueRelay(event)

// DESPUÉS (atómico con outbox):
if (eventsToSave.length > 0) {
  const isFederationSource = authenticatedUserId === 'system-federation';

  await this.eventRepository.manager.transaction(async (manager) => {
    // 1. Guardar eventos (idempotente)
    await manager.createQueryBuilder()
      .insert()
      .into(Event)
      .values(eventsToSave)
      .orIgnore()
      .execute();

    // 2. Escribir outbox (misma transacción = atómico)
    await this.outboxService.writeOutboxEntries(
      manager,
      eventsToSave,
      !isFederationSource, // No relay si viene de federation
    );

    // 3. Usage increments
    if (productUsageIncrements > 0) {
      await this.usageService.increment(
        dto.store_id, 'products', productUsageIncrements, manager
      );
    }
    if (invoiceUsageIncrements > 0) {
      await this.usageService.increment(
        dto.store_id, 'invoices_per_month', invoiceUsageIncrements, manager
      );
    }
  });

  // El OutboxService.processOutbox() se encarga del resto
  // automáticamente cada 3 segundos
}
Día 9: Tests de integración + Deploy Phase 1
text

DÍA 9
═══════════════════════════════════════════════════════════

⏰ 08:00-12:00 │ Tests de integración
────────────────┼──────────────────────────────────────
TypeScript

// outbox-integration.spec.ts

describe('Outbox Integration', () => {
  it('should project event even if queue is down', async () => {
    // Simular Redis down (BullMQ no disponible)
    jest.spyOn(salesProjectionQueue, 'add').mockRejectedValue(
      new Error('Redis connection refused')
    );

    // Push evento
    const result = await syncService.push(createPushDto({
      events: [createSaleEvent()],
    }));

    expect(result.accepted).toHaveLength(1);

    // Esperar a que outbox procese (3s)
    await sleep(4000);

    // Verificar que la venta se proyectó via outbox
    const sale = await salesRepo.findOne({
      where: { id: 'test-sale-id' }
    });
    expect(sale).toBeDefined();
  });

  it('should relay to federation even if initial relay fails', async () => {
    jest.spyOn(federationService, 'queueRelay')
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(undefined);

    const result = await syncService.push(createPushDto({
      events: [createDebtEvent()],
    }));

    expect(result.accepted).toHaveLength(1);

    // Outbox reintenta
    await sleep(7000);

    // Verificar que el relay se procesó en el segundo intento
    expect(federationService.queueRelay).toHaveBeenCalledTimes(2);
  });
});
text

⏰ 13:00-18:00 │ Deploy Phase 1
────────────────┼──────────────────────────────────────

  CHECKLIST PRE-DEPLOY:
  □ Migración de BD ejecutada en staging
  □ Tests pasan: pnpm test --coverage
  □ OrphanHealerService registrado en módulo
  □ OutboxService registrado en módulo
  □ Reconcile usa getXxxEventIds() en vez de getXxxIds()
  □ SyncService.push() usa outbox
  □ Backup de BD de producción tomado
  
  DEPLOY ORDER:
  1. Ejecutar migración SQL
  2. Deploy API con nuevos servicios
  3. Verificar logs: "Healed X orphaned projections"
  4. Verificar outbox: SELECT COUNT(*) FROM outbox_entries WHERE status = 'processed'
  5. Forzar reconcile: POST /federation/auto-reconcile
  6. Verificar fiaos replican correctamente
PHASE 2 — DEFENSIVE LAYER (Día 10-16)
text

╔══════════════════════════════════════════════════════════════╗
║  PHASE 2 DELIVERABLES                                        ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ✅ D5: Stock validation pre-venta (PWA client)             ║
║  ✅ D6: Circuit breaker para federation calls               ║
║  ✅ D7: Distributed lock para reconciliación                ║
║  ✅ D8: Hash determinista (sortDeep)                        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
Día 10-12: Stock Validation en PWA
text

DÍA 10
═══════════════════════════════════════════════════════════

⏰ 08:00-18:00 │ Stock validation service (PWA)
────────────────┼──────────────────────────────────────
TypeScript

// apps/pwa/src/services/stock-validator.service.ts

import { db } from '@/lib/db'; // IndexedDB wrapper

export interface StockValidationResult {
  valid: boolean;
  warnings: StockWarning[];
  errors: StockError[];
}

export interface StockWarning {
  product_id: string;
  product_name: string;
  requested: number;
  available: number;
  message: string;
}

export interface StockError {
  product_id: string;
  product_name: string;
  requested: number;
  available: number;
  message: string;
}

export class StockValidatorService {
  /**
   * Valida stock ANTES de crear el evento SaleCreated.
   * Usa datos locales de IndexedDB.
   * 
   * POLÍTICA:
   * - Si online: WARN pero permitir (server validará)
   * - Si offline: BLOCK si stock <= 0
   * - Si offline: WARN si stock < qty pero > 0
   */
  async validateBeforeSale(
    items: Array<{ product_id: string; qty: number; name: string }>,
    isOnline: boolean,
  ): Promise<StockValidationResult> {
    const warnings: StockWarning[] = [];
    const errors: StockError[] = [];

    for (const item of items) {
      try {
        // Leer stock local de IndexedDB
        const stockRecord = await db.get('warehouse_stock_cache', item.product_id);
        const escrowRecord = await db.get('escrow_quotas', item.product_id);
        
        const currentStock = Number(stockRecord?.stock ?? 0);
        const escrowQty = Number(escrowRecord?.qty_granted ?? 0);
        const available = currentStock + escrowQty;

        // Producto sin tracking de inventario — skip
        const product = await db.get('products', item.product_id);
        if (product && !product.track_inventory) continue;

        if (available <= 0) {
          if (isOnline) {
            // Online: warn, el server tiene datos más frescos
            warnings.push({
              product_id: item.product_id,
              product_name: item.name,
              requested: item.qty,
              available,
              message: `${item.name} podría estar agotado (stock local: ${available})`,
            });
          } else {
            // Offline: block
            errors.push({
              product_id: item.product_id,
              product_name: item.name,
              requested: item.qty,
              available,
              message: `${item.name} sin stock disponible`,
            });
          }
        } else if (item.qty > available) {
          warnings.push({
            product_id: item.product_id,
            product_name: item.name,
            requested: item.qty,
            available,
            message: `${item.name}: solo ${available} disponibles, pidiendo ${item.qty}`,
          });
        }
      } catch {
        // Si no podemos leer stock local, permitir la venta
        // (mejor vender que bloquear por error de IndexedDB)
        continue;
      }
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Actualiza el stock local después de una venta
   * para que la siguiente validación sea más precisa.
   */
  async decrementLocalStock(
    items: Array<{ product_id: string; qty: number }>,
  ): Promise<void> {
    for (const item of items) {
      try {
        const record = await db.get('warehouse_stock_cache', item.product_id);
        if (record) {
          record.stock = Math.max(0, (record.stock || 0) - item.qty);
          record.last_decremented_at = Date.now();
          await db.put('warehouse_stock_cache', record);
        }
      } catch {
        // Silenciar — no bloquear venta por error de cache
      }
    }
  }
}

export const stockValidator = new StockValidatorService();
TypeScript

// Integración en el flujo de checkout del POS:
// apps/pwa/src/components/pos/CheckoutButton.tsx (o similar)

import { stockValidator } from '@/services/stock-validator.service';
import { useOnline } from '@/hooks/use-online';

// Dentro del handler de checkout:
const handleCheckout = async () => {
  const { isOnline } = useOnline();
  
  // 1. Validar stock ANTES de crear evento
  const validation = await stockValidator.validateBeforeSale(
    cartItems.map(item => ({
      product_id: item.product_id,
      qty: item.qty,
      name: item.name,
    })),
    isOnline,
  );

  // 2. Si hay errores (offline + sin stock) → bloquear
  if (!validation.valid) {
    toast.error(validation.errors[0].message);
    return;
  }

  // 3. Si hay warnings → mostrar pero permitir
  if (validation.warnings.length > 0) {
    const proceed = await confirm(
      `⚠️ ${validation.warnings[0].message}\n¿Deseas continuar?`
    );
    if (!proceed) return;
  }

  // 4. Crear evento SaleCreated
  await createSaleEvent(cartItems, paymentMethod);

  // 5. Decrementar stock local para siguiente validación
  await stockValidator.decrementLocalStock(
    cartItems.map(item => ({
      product_id: item.product_id,
      qty: item.qty,
    }))
  );
};
Día 13-14: Circuit Breaker + Distributed Lock
text

DÍA 13
═══════════════════════════════════════════════════════════

⏰ 08:00-12:00 │ Circuit Breaker
────────────────┼──────────────────────────────────────
TypeScript

// apps/api/src/common/circuit-breaker.ts

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly logger: any;

  constructor(private readonly options: CircuitBreakerOptions) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.options.timeoutMs) {
        this.transition(CircuitState.HALF_OPEN);
      } else {
        throw new Error(
          `Circuit [${this.options.name}] OPEN — remote unreachable`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.transition(CircuitState.CLOSED);
        this.reset();
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.failureCount >= this.options.failureThreshold) {
      this.transition(CircuitState.OPEN);
    }
  }

  private transition(to: CircuitState) {
    const from = this.state;
    this.state = to;
    this.options.onStateChange?.(from, to);
  }

  private reset() {
    this.failureCount = 0;
    this.successCount = 0;
  }

  getState(): CircuitState { return this.state; }
}
TypeScript

// Integrar en FederationSyncService:

private remoteCircuit = new CircuitBreaker({
  name: 'federation-remote',
  failureThreshold: 5,
  successThreshold: 3,
  timeoutMs: 60_000,
  onStateChange: (from, to) => {
    this.logger.warn(`🔌 Federation circuit: ${from} → ${to}`);
  },
});

// Usar en relayEventNow:
private async relayEventNow(event: Event) {
  if (!this.remoteUrl) return;

  return this.remoteCircuit.execute(async () => {
    await axios.post(`${this.remoteUrl}/sync/push`, payload, {
      timeout: 10_000,
    });
  });
}

// Usar en fetchRemoteIds:
private async fetchRemoteIds(endpoint, storeId, dateFrom, dateTo) {
  return this.remoteCircuit.execute(async () => {
    const response = await axios.get(`${this.remoteUrl}${endpoint}`, {
      params: { store_id: storeId, date_from: dateFrom, date_to: dateTo },
      timeout: 15_000,
    });
    return response.data;
  });
}
text

⏰ 13:00-18:00 │ Distributed Lock + Hash fix
────────────────┼──────────────────────────────────────
TypeScript

// apps/api/src/common/distributed-lock.ts

import { Injectable, Inject } from '@nestjs/common';

@Injectable()
export class DistributedLockService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: any,
  ) {}

  async acquire(
    key: string,
    ttlMs: number = 300_000,
  ): Promise<string | null> {
    const lockValue = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const acquired = await this.redis.set(
      `lock:${key}`, lockValue, 'PX', ttlMs, 'NX'
    );
    return acquired === 'OK' ? lockValue : null;
  }

  async release(key: string, lockValue: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.redis.eval(script, 1, `lock:${key}`, lockValue);
    return result === 1;
  }
}

// Uso en FederationSyncService.reconcileStore():
private async reconcileStore(storeId: string) {
  const lockValue = await this.lockService.acquire(
    `federation:reconcile:${storeId}`,
    300_000
  );
  
  if (!lockValue) {
    return { storeId, skipped: true, reason: 'locked by another process' };
  }

  try {
    // ... lógica existente ...
  } finally {
    await this.lockService.release(
      `federation:reconcile:${storeId}`,
      lockValue
    );
  }
}
Día 15-16: Deploy Phase 2
text

DÍA 15-16
═══════════════════════════════════════════════════════════

CHECKLIST DEPLOY PHASE 2:
  □ Stock validator integrado en checkout PWA
  □ Circuit breaker en todas las llamadas axios al remote
  □ Distributed lock en reconcileStore
  □ Hash determinista (sortDeep) reemplaza hashPayload
  □ Tests E2E: venta offline con stock bajo → warning
  □ Tests: circuit breaker abre después de 5 fallos
  □ Deploy PWA con stock validation
  □ Deploy API con circuit breaker + lock
PHASE 3 — FISCAL SAFETY (Día 17-23)
text

╔══════════════════════════════════════════════════════════════╗
║  PHASE 3 DELIVERABLES                                        ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ✅ D9:  FiscalSequenceService — rangos pre-asignados        ║
║  ✅ D10: Causal relay ordering                               ║
║  ✅ D11: Conflict audit trail (tabla + logging)              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
Día 17-20: Fiscal Range Reservation
TypeScript

// apps/api/src/fiscal/fiscal-sequence.service.ts

@Injectable()
export class FiscalSequenceService {
  private readonly logger = new Logger(FiscalSequenceService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * Reserva un rango de números fiscales para un dispositivo.
   * Usa SELECT ... FOR UPDATE para evitar colisiones.
   */
  async reserveRange(
    storeId: string,
    seriesId: string,
    deviceId: string,
    quantity: number = 50,
  ): Promise<{
    device_id: string;
    range_start: number;
    range_end: number;
    expires_at: Date;
  }> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      // 1. Obtener y lockear la secuencia actual
      const current = await manager.query(`
        SELECT next_number
        FROM invoice_series
        WHERE id = $1 AND store_id = $2
        FOR UPDATE
      `, [seriesId, storeId]);

      if (!current?.[0]) {
        throw new Error(`Series ${seriesId} not found for store ${storeId}`);
      }

      const rangeStart = Number(current[0].next_number);
      const rangeEnd = rangeStart + quantity - 1;

      // 2. Incrementar secuencia
      await manager.query(`
        UPDATE invoice_series
        SET next_number = $1
        WHERE id = $2 AND store_id = $3
      `, [rangeEnd + 1, seriesId, storeId]);

      // 3. Registrar reservación
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await manager.query(`
        INSERT INTO fiscal_sequence_ranges
          (store_id, series_id, device_id, range_start, range_end, 
           status, granted_at, expires_at)
        VALUES ($1, $2, $3, $4, $5, 'active', NOW(), $6)
      `, [storeId, seriesId, deviceId, rangeStart, rangeEnd, expiresAt]);

      this.logger.log(
        `📋 Fiscal range reserved: ${deviceId} → [${rangeStart}-${rangeEnd}]`
      );

      return {
        device_id: deviceId,
        range_start: rangeStart,
        range_end: rangeEnd,
        expires_at: expiresAt,
      };
    });
  }

  /**
   * El dispositivo consume un número de su rango.
   * Retorna el siguiente número disponible.
   */
  async consumeNext(
    storeId: string,
    seriesId: string,
    deviceId: string,
  ): Promise<number | null> {
    const result = await this.dataSource.query(`
      UPDATE fiscal_sequence_ranges
      SET used_up_to = used_up_to + 1,
          status = CASE 
            WHEN used_up_to + 1 >= range_end THEN 'exhausted'
            ELSE status
          END
      WHERE store_id = $1
        AND series_id = $2
        AND device_id = $3
        AND status = 'active'
        AND used_up_to < range_end
        AND expires_at > NOW()
      RETURNING range_start + used_up_to AS next_number
    `, [storeId, seriesId, deviceId]);

    return result?.[0]?.next_number ?? null;
  }

  /**
   * Reclamar rangos expirados o no utilizados
   */
  @Cron(CronExpression.EVERY_HOUR)
  async reclaimExpiredRanges() {
    const result = await this.dataSource.query(`
      UPDATE fiscal_sequence_ranges
      SET status = 'expired'
      WHERE status = 'active'
        AND expires_at < NOW()
      RETURNING id, device_id, range_start, range_end, used_up_to
    `);

    if (result?.length > 0) {
      this.logger.warn(
        `📋 Reclaimed ${result.length} expired fiscal ranges`
      );
    }
  }
}
TypeScript

// Endpoint para que el PWA reserve rangos al conectarse:
// apps/api/src/fiscal/fiscal.controller.ts

@Post('reserve-range')
@UseGuards(JwtAuthGuard)
async reserveRange(
  @Body() dto: { series_id: string; device_id: string; quantity?: number },
  @Req() req: any,
) {
  const storeId = req.user.store_id;
  return this.fiscalSequenceService.reserveRange(
    storeId,
    dto.series_id,
    dto.device_id,
    dto.quantity ?? 50,
  );
}
TypeScript

// PWA: Consumir rango offline
// apps/pwa/src/services/fiscal-offline.service.ts

export class FiscalOfflineService {
  private currentRange: {
    range_start: number;
    range_end: number;
    used_up_to: number;
  } | null = null;

  async getNextFiscalNumber(seriesId: string): Promise<number | null> {
    // 1. Intentar obtener del rango local
    if (this.currentRange) {
      const next = this.currentRange.range_start + this.currentRange.used_up_to;
      if (next <= this.currentRange.range_end) {
        this.currentRange.used_up_to++;
        await this.persistRange(); // Guardar en IndexedDB
        return next;
      }
    }

    // 2. Si el rango se agotó y estamos online, pedir nuevo
    if (navigator.onLine) {
      try {
        const range = await api.post('/fiscal/reserve-range', {
          series_id: seriesId,
          device_id: getDeviceId(),
          quantity: 50,
        });
        this.currentRange = {
          range_start: range.range_start,
          range_end: range.range_end,
          used_up_to: 0,
        };
        return this.getNextFiscalNumber(seriesId);
      } catch {
        return null; // No se puede facturar offline sin rango
      }
    }

    // 3. Offline y sin rango → no se puede facturar
    return null;
  }

  private async persistRange() {
    if (this.currentRange) {
      await db.put('fiscal_ranges', {
        id: 'current',
        ...this.currentRange,
      });
    }
  }

  async loadFromStorage() {
    const saved = await db.get('fiscal_ranges', 'current');
    if (saved) {
      this.currentRange = saved;
    }
  }
}
Día 21-22: Causal Relay + Conflict Audit
TypeScript

// Conflict audit — agregar a conflict-resolution.service.ts

async saveConflictAudit(audit: {
  store_id: string;
  entity_type: string;
  entity_id: string | null;
  winner_event_id: string;
  loser_event_ids: string[];
  strategy: string;
  winner_payload: any;
  loser_payloads: any[];
}): Promise<void> {
  try {
    await this.dataSource.query(`
      INSERT INTO conflict_audit_log
        (store_id, entity_type, entity_id, winner_event_id, 
         loser_event_ids, strategy, winner_payload, loser_payloads)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      audit.store_id,
      audit.entity_type,
      audit.entity_id,
      audit.winner_event_id,
      audit.loser_event_ids,
      audit.strategy,
      JSON.stringify(audit.winner_payload),
      JSON.stringify(audit.loser_payloads),
    ]);
  } catch (error) {
    // No fallar el sync por error de audit
    this.logger.error(`Failed to save conflict audit: ${error.message}`);
  }
}
Día 23: Deploy Phase 3
text

CHECKLIST DEPLOY PHASE 3:
  □ FiscalSequenceService funcional con tests
  □ Endpoint /fiscal/reserve-range protegido
  □ PWA FiscalOfflineService integrado
  □ Conflict audit trail logging
  □ Causal dependencies se validan en relay
  □ Deploy + verificar
PHASE 4 — ESCROW & COUNTERS (Día 24-30)
text

╔══════════════════════════════════════════════════════════════╗
║  PHASE 4 DELIVERABLES                                        ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ✅ D12: Auto-escrow en prefetch (PWA)                       ║
║  ✅ D13: Server stock validation (soft mode)                 ║
║  ✅ D14: Oversell alerting system                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

DÍA 24-26: Auto-escrow
DÍA 27-28: Server stock validation (warn, no block)
DÍA 29-30: Oversell detection + alertas + deploy
PHASE 5 — OBSERVABILITY (Día 31-37)
text

╔══════════════════════════════════════════════════════════════╗
║  PHASE 5 DELIVERABLES                                        ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ✅ D15: SplitBrainMonitorService                            ║
║  ✅ D16: Health endpoint /federation/health                  ║
║  ✅ D17: Alertas automáticas (stock neg, projection gap)     ║
║  ✅ D18: Runbook de incidentes                               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
TypeScript

// Endpoint de health consolidado:
// GET /sync/federation/health?store_id=xxx

@Get('health')
async getHealth(@Query('store_id') storeId: string) {
  return this.splitBrainMonitor.getHealthReport(storeId);
}

// Response:
{
  "timestamp": "2025-01-15T10:30:00Z",
  "storeId": "xxx",
  "overallHealth": "healthy",  // | "degraded" | "critical"
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
    "projectionGap": { "sales": 0, "debts": 0, "payments": 0 },
    "stockDivergence": { "divergent": 0, "negative": 0 },
    "outboxBacklog": { "pending": 2, "dead": 0 }
  },
  "conflicts": {
    "last24h": 0,
    "unresolved": 0
  },
  "fiscal": {
    "activeRanges": 2,
    "exhaustedRanges": 0,
    "duplicateNumbers": 0
  }
}
PHASE 6 — HARDENING (Día 38-42)
text

╔══════════════════════════════════════════════════════════════╗
║  PHASE 6 DELIVERABLES                                        ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ✅ D19: Chaos tests (overselling, partition, fiscal)        ║
║  ✅ D20: Documentation completa                              ║
║  ✅ D21: Runbook de incidentes publicado                     ║
║  ✅ D22: Release notes + retrospectiva                       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
TypeScript

// Chaos test: overselling
describe('Chaos: Overselling Prevention', () => {
  it('should warn when 2 offline POS sell same product', async () => {
    // Setup: Product with stock = 5
    await seedProduct({ id: 'p1', stock: 5 });

    // Simulate POS-A offline sale (qty=4)
    const resultA = await syncService.push(createPushDto({
      device_id: 'pos-a',
      events: [createSaleEvent({ product_id: 'p1', qty: 4 })],
    }));

    // Simulate POS-B offline sale (qty=3)
    const resultB = await syncService.push(createPushDto({
      device_id: 'pos-b',
      events: [createSaleEvent({ product_id: 'p1', qty: 3 })],
    }));

    // Both should be accepted (append-only AWSet)
    expect(resultA.accepted).toHaveLength(1);
    expect(resultB.accepted).toHaveLength(1);

    // But stock should be negative (-2)
    const stock = await getStock('p1');
    expect(stock).toBeLessThan(0);

    // And an oversell alert should exist
    const alerts = await getOversellAlerts('p1');
    expect(alerts).toHaveLength(1);
  });
});
RESUMEN EJECUTIVO FINAL
text

╔══════════════════════════════════════════════════════════════════╗
║                     MASTER PLAN SUMMARY                          ║
╠═══════════╦══════════════════════════════╦═══════════╦═══════════╣
║ Phase     ║ Deliverables                 ║ Días      ║ Status    ║
╠═══════════╬══════════════════════════════╬═══════════╬═══════════╣
║ TRIAGE    ║ Diagnóstico + Hotfix fiaos   ║ 0-2       ║           ║
║ PHASE 1   ║ Orphan healer + Outbox       ║ 3-9       ║           ║
║ PHASE 2   ║ Stock valid + Circuit break  ║ 10-16     ║           ║
║ PHASE 3   ║ Fiscal ranges + Audit trail  ║ 17-23     ║           ║
║ PHASE 4   ║ Escrow + Oversell alerts     ║ 24-30     ║           ║
║ PHASE 5   ║ Observability + Dashboard    ║ 31-37     ║           ║
║ PHASE 6   ║ Chaos testing + Release      ║ 38-42     ║           ║
╠═══════════╬══════════════════════════════╬═══════════╬═══════════╣
║ TOTAL     ║ 22 deliverables              ║ 42 días   ║           ║
╚═══════════╩══════════════════════════════╩═══════════╩═══════════╝

MÉTRICAS DE ÉXITO:
  ✅ Fiaos replican correctamente entre nodos
  ✅ 0 projection gaps en 7 días consecutivos
  ✅ 0 stock negativo no-alertado
  ✅ 0 fiscal numbers duplicados
  ✅ Federation health = "healthy" 99%+ del tiempo
  ✅ Circuit breaker evita cascading failures
  ✅ Outbox garantiza atomicidad event → projection
  ✅ Chaos tests pasan al 100%
Empieza por el Día 0 — las queries diagnósticas de los fiaos. Todo lo demás depende de entender primero qué está fallando ahí.