-- =====================================================
-- 97. PREPARE PARTITIONING FOR EVENTS TABLE
-- =====================================================
-- Phase 1: Infrastructure and Metadata
-- =====================================================

-- 1. Create the partitioned table events_p
CREATE TABLE IF NOT EXISTS events_p (
  event_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  device_id UUID NOT NULL,
  seq BIGINT NOT NULL,
  type TEXT NOT NULL,
  version INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  actor_user_id UUID,
  actor_role TEXT,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Offline-first fields
  vector_clock JSONB DEFAULT '{}',
  causal_dependencies TEXT[] DEFAULT '{}',
  conflict_status TEXT DEFAULT 'resolved',
  delta_payload JSONB,
  full_payload_hash TEXT,

  PRIMARY KEY (event_id, created_at)
) PARTITION BY RANGE (created_at);

COMMENT ON TABLE events_p IS 'Partitioned event store (Shadow table for migration)';

-- 2. Initial Partitions (Example: Feb 2026 and Mar 2026)
CREATE TABLE IF NOT EXISTS events_p_y2026_m01 PARTITION OF events_p 
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE IF NOT EXISTS events_p_y2026_m02 PARTITION OF events_p 
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE IF NOT EXISTS events_p_y2026_m03 PARTITION OF events_p 
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- 3. Default Partition (Safety)
CREATE TABLE IF NOT EXISTS events_p_default PARTITION OF events_p DEFAULT;

-- 4. Minimum Performance Indices
CREATE INDEX IF NOT EXISTS idx_events_p_store_seq ON events_p(store_id, seq);
CREATE INDEX IF NOT EXISTS idx_events_p_store_type ON events_p(store_id, type);
CREATE INDEX IF NOT EXISTS idx_events_p_store_created ON events_p(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_p_device ON events_p(device_id);

-- GIN index for vector_clock
CREATE INDEX IF NOT EXISTS idx_events_p_vector_clock ON events_p USING GIN(vector_clock);

-- Conditional index for conflicts
CREATE INDEX IF NOT EXISTS idx_events_p_conflict_status
  ON events_p(store_id, conflict_status)
  WHERE conflict_status != 'resolved';

-- 5. Backfill Tracking Table
CREATE TABLE IF NOT EXISTS partitioning_meta (
  process_key TEXT PRIMARY KEY,
  last_created_at TIMESTAMPTZ,
  last_event_id UUID,
  records_processed BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Verification
SELECT 'Partitioned table events_p and metadata prepared' AS status;
