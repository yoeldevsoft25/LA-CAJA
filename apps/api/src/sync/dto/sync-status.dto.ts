export class SyncStatusDto {
  store_id: string;
  device_id: string;
  last_synced_at: Date | null;
  last_event_seq: number;
  pending_events_count: number;
  last_sync_duration_ms: number | null;
  last_sync_error: string | null;
}

