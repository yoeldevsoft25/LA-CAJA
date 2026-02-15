-- Create alerts table
CREATE TABLE IF NOT EXISTS "alerts" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "service_name" varchar(100) NOT NULL,
    "alert_type" varchar(50) NOT NULL,
    "severity" varchar(20) NOT NULL,
    "message" text NOT NULL,
    "status" varchar(20) NOT NULL,
    "metadata" jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "PK_alerts_id" PRIMARY KEY ("id")
);

-- Create indices for alerts
CREATE INDEX IF NOT EXISTS "IDX_alerts_status" ON "alerts" ("status");
CREATE INDEX IF NOT EXISTS "IDX_alerts_service_name" ON "alerts" ("service_name");
CREATE INDEX IF NOT EXISTS "IDX_alerts_severity" ON "alerts" ("severity");
CREATE INDEX IF NOT EXISTS "IDX_alerts_created_at" ON "alerts" ("created_at");
-- Partial index for active alerts
CREATE INDEX IF NOT EXISTS "IDX_alerts_status_created_at_active" ON "alerts" ("status", "created_at") WHERE status = 'active';

-- Create uptime_records table
CREATE TABLE IF NOT EXISTS "uptime_records" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "timestamp" timestamptz NOT NULL,
    "status" varchar(20) NOT NULL,
    "service_name" varchar(100),
    "response_time_ms" integer,
    "error_message" text,
    "metadata" jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "PK_uptime_records_id" PRIMARY KEY ("id")
);

-- Create indices for uptime_records
CREATE INDEX IF NOT EXISTS "IDX_uptime_records_timestamp" ON "uptime_records" ("timestamp");
CREATE INDEX IF NOT EXISTS "IDX_uptime_records_service_name" ON "uptime_records" ("service_name");
CREATE INDEX IF NOT EXISTS "IDX_uptime_records_status" ON "uptime_records" ("status");
CREATE INDEX IF NOT EXISTS "IDX_uptime_records_service_name_timestamp" ON "uptime_records" ("service_name", "timestamp");
