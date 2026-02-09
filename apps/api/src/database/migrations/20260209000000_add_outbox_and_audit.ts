import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOutboxAndAuditTables20260209000000 implements MigrationInterface {
    name = 'AddOutboxAndAuditTables20260209000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Outbox para garantizar atomicidad event + projection + relay
        await queryRunner.query(`
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
    `);

        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_outbox_pending 
        ON outbox_entries (created_at) 
        WHERE status = 'pending';
    `);

        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_outbox_event_id 
        ON outbox_entries (event_id);
    `);

        // 2. Audit trail para conflictos resueltos
        await queryRunner.query(`
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
    `);

        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_conflict_audit_store 
        ON conflict_audit_log (store_id, resolved_at DESC);
    `);

        // 3. Fiscal sequence ranges (preparación Phase 3)
        await queryRunner.query(`
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
    `);

        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fiscal_ranges_active 
        ON fiscal_sequence_ranges (store_id, device_id, status) 
        WHERE status = 'active';
    `);

        // 4. Federation health snapshots (Phase 5 prep)
        await queryRunner.query(`
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
    `);

        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_health_snapshots 
        ON federation_health_snapshots (store_id, snapshot_at DESC);
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS federation_health_snapshots`);
        await queryRunner.query(`DROP TABLE IF EXISTS fiscal_sequence_ranges`);
        await queryRunner.query(`DROP TABLE IF EXISTS conflict_audit_log`);
        await queryRunner.query(`DROP TABLE IF EXISTS outbox_entries`);
    }
}
