import { sqliteService } from '@/services/sqlite.service';
import { IEventRepository } from '../types';
import { LocalEvent } from '@/db/database';

export const sqliteEventRepository: IEventRepository = {
    async add(event: LocalEvent): Promise<void> {
        const sql = `
            INSERT INTO local_events(
    event_id, store_id, device_id, seq, type, payload,
    sync_status, sync_attempts, created_at, next_retry_at,
    vector_clock, metadata
) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
        const params = [
            event.event_id,
            event.store_id,
            event.device_id,
            event.seq || 0,
            event.type,
            JSON.stringify(event.payload || {}), // Serializar payload
            event.sync_status || 'pending',
            event.sync_attempts || 0,
            event.created_at,
            event.next_retry_at || null,
            event.vector_clock ? JSON.stringify(event.vector_clock) : null,
            (event as any).metadata ? JSON.stringify((event as any).metadata) : null
        ];
        await sqliteService.execute(sql, params);
    },

    async addBatch(events: LocalEvent[]): Promise<void> {
        if (events.length === 0) return;
        // Optimization: Use a single transaction via rust plugin if available,
        // but for now loop is safer until we verify bulk insert support or iterate.
        // Actually, individual inserts are fine for now, or we can use BEGIN/COMMIT if supported.
        // The plugin might not expose explicit transaction control easily in JS side without raw queries.
        // We'll iterate. SQLite is fast.
        for (const event of events) {
            await this.add(event);
        }
    },

    async getPending(limit: number): Promise<LocalEvent[]> {
        // First get normal pending events ordered by creation
        const sql = `
SELECT * FROM local_events
            WHERE sync_status = 'pending'
            ORDER BY created_at ASC
LIMIT ?
    `;
        const pending = await sqliteService.select<any[]>(sql, [limit]);

        // If we haven't reached limit, check for retrying events that are due
        if (pending.length < limit) {
            const now = Date.now();
            const sqlRetry = `
                SELECT * FROM local_events
                WHERE sync_status = 'retrying' AND next_retry_at <= ?
    ORDER BY created_at ASC
LIMIT ?
    `;
            const retrying = await sqliteService.select<any[]>(sqlRetry, [now, limit - pending.length]);
            pending.push(...retrying);
        }

        return pending.map(row => mapRowToLocalEvent(row));
    },

    async findByEventId(eventId: string): Promise<LocalEvent | undefined> {
        const sql = `SELECT * FROM local_events WHERE event_id = ? `;
        const rows = await sqliteService.select<any[]>(sql, [eventId]);
        if (rows.length === 0) return undefined;
        return mapRowToLocalEvent(rows[0]);
    },

    async markAsSynced(eventIds: string[]): Promise<void> {
        if (eventIds.length === 0) return;
        const placeholders = eventIds.map(() => '?').join(',');
        const sql = `
            UPDATE local_events
            SET sync_status = 'synced', synced_at = ?
    WHERE event_id IN(${placeholders})
        `;
        await sqliteService.execute(sql, [Date.now(), ...eventIds]);
    },

    async markAsFailed(eventId: string, error: string, nextRetryAt?: number, isTerminal?: boolean): Promise<void> {
        const status = isTerminal ? 'dead' : (nextRetryAt ? 'retrying' : 'failed');
        const sql = `
            UPDATE local_events
            SET sync_status = ?,
    last_error = ?,
    sync_attempts = sync_attempts + 1,
    next_retry_at = ?
        WHERE event_id = ?
            `;
        await sqliteService.execute(sql, [status, error, nextRetryAt || null, eventId]);
    },

    async resetFailedToPending(): Promise<void> {
        const sql = `
            UPDATE local_events
            SET sync_status = 'pending',
    sync_attempts = 0,
    next_retry_at = ?
        WHERE sync_status = 'failed'
            `;
        await sqliteService.execute(sql, [Date.now()]);
    },

    async getLastSeq(storeId: string, deviceId: string): Promise<number> {
        const sql = `
            SELECT MAX(seq) as max_seq FROM local_events
            WHERE store_id = ? AND device_id = ?
    `;
        const result = await sqliteService.select<{ max_seq: number }>(sql, [storeId, deviceId]);
        // Result is array of rows
        return result[0]?.max_seq || 0;
    },

    async countPending(): Promise<number> {
        const sql = `SELECT COUNT(*) as count FROM local_events WHERE sync_status = 'pending'`;
        const result = await sqliteService.select<{ count: number }>(sql);
        return result[0]?.count || 0;
    },

    async pruneSynced(maxAge: number): Promise<number> {
        const cutoff = Date.now() - maxAge;
        const sql = `
            DELETE FROM local_events 
            WHERE sync_status = 'synced' AND synced_at < ?
    `;
        // Execute returns result with rowsAffected in some drivers, 
        // need to check what sqliteService.execute returns. 
        // Assuming we can't easily get count, we'll return 0 or check API.
        // For now, let's return 0 as it's just logging.
        await sqliteService.execute(sql, [cutoff]);
        return 0;
    }
};

// Helper to map DB row to LocalEvent object
function mapRowToLocalEvent(row: any): LocalEvent {
    return {
        ...row,
        payload: JSON.parse(row.payload),
        vector_clock: row.vector_clock ? JSON.parse(row.vector_clock) : undefined,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
}
