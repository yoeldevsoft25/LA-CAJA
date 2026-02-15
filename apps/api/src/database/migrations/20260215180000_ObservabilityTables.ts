import { MigrationInterface, QueryRunner } from 'typeorm';

export class ObservabilityTables20260215180000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 62. OBSERVABILIDAD - ALERTAS Y UPTIME

        // Tabla de alertas
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        service_name VARCHAR(100) NOT NULL,
        alert_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
        message TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'acknowledged')),
        resolved_at TIMESTAMPTZ,
        acknowledged_at TIMESTAMPTZ,
        acknowledged_by UUID,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

        // Tabla de registros de uptime
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS uptime_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMPTZ NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('up', 'down', 'degraded')),
        service_name VARCHAR(100),
        response_time_ms INTEGER,
        error_message TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

        // Índices para alerts
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
      CREATE INDEX IF NOT EXISTS idx_alerts_service ON alerts(service_name);
      CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);
      CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(status, created_at) WHERE status = 'active';
    `);

        // Índices para uptime_records
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_uptime_timestamp ON uptime_records(timestamp);
      CREATE INDEX IF NOT EXISTS idx_uptime_service ON uptime_records(service_name);
      CREATE INDEX IF NOT EXISTS idx_uptime_status ON uptime_records(status);
      CREATE INDEX IF NOT EXISTS idx_uptime_service_timestamp ON uptime_records(service_name, timestamp DESC);
    `);

        // Comentarios
        await queryRunner.query(`
      COMMENT ON TABLE alerts IS 'Sistema de alertas para monitoreo de servicios';
      COMMENT ON TABLE uptime_records IS 'Registros históricos de uptime para cálculo de SLA';
      COMMENT ON COLUMN alerts.severity IS 'Nivel de severidad: critical, warning, info';
      COMMENT ON COLUMN alerts.status IS 'Estado de la alerta: active, resolved, acknowledged';
      COMMENT ON COLUMN uptime_records.status IS 'Estado del servicio: up, down, degraded';
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS uptime_records;`);
        await queryRunner.query(`DROP TABLE IF EXISTS alerts;`);
    }
}
