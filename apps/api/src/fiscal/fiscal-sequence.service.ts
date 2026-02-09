import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface FiscalRange {
    id: string;
    store_id: string;
    series_id: string;
    device_id: string;
    range_start: number;
    range_end: number;
    used_up_to: number;
    status: 'active' | 'exhausted' | 'expired';
    granted_at: Date;
    expires_at: Date;
}

/**
 * Fiscal Sequence Service
 * 
 * Manages pre-assigned fiscal number ranges for offline devices.
 * Each POS device reserves a block of sequential fiscal numbers
 * before going offline, preventing collisions between devices.
 * 
 * Key Features:
 * - One active range per device per series
 * - Ranges expire after 24h if not exhausted
 * - SERIALIZABLE transactions prevent race conditions
 * - Expired ranges are reclaimed but numbers are never reused (fiscal gap)
 */
@Injectable()
export class FiscalSequenceService {
    private readonly logger = new Logger(FiscalSequenceService.name);
    private readonly DEFAULT_RANGE_SIZE = 50;
    private readonly RANGE_TTL_HOURS = 24;

    constructor(
        @InjectDataSource()
        private dataSource: DataSource,
    ) { }

    /**
     * Reserve a fiscal number range for a device.
     * 
     * @param storeId - Store ID
     * @param seriesId - Invoice series ID
     * @param deviceId - Device ID requesting the range
     * @param quantity - Number of fiscal numbers to reserve (default: 50)
     * @returns Reserved fiscal range
     * @throws BadRequestException if device already has an active range
     */
    async reserveRange(
        storeId: string,
        seriesId: string,
        deviceId: string,
        quantity: number = this.DEFAULT_RANGE_SIZE,
    ): Promise<FiscalRange> {
        if (quantity <= 0 || quantity > 1000) {
            throw new BadRequestException('Quantity must be between 1 and 1000');
        }

        return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
            // Check if device already has an active range
            const existingActive = await manager.query(
                `
        SELECT id, range_start, range_end, used_up_to, expires_at
        FROM fiscal_sequence_ranges
        WHERE store_id = $1
          AND series_id = $2
          AND device_id = $3
          AND status = 'active'
        FOR UPDATE
        `,
                [storeId, seriesId, deviceId],
            );

            if (existingActive.length > 0) {
                throw new BadRequestException(
                    `Device ${deviceId} already has an active range for series ${seriesId}`,
                );
            }

            // Get the highest range_end for this series to determine next start
            const lastRange = await manager.query(
                `
        SELECT MAX(range_end) AS max_end
        FROM fiscal_sequence_ranges
        WHERE store_id = $1
          AND series_id = $2
        FOR UPDATE
        `,
                [storeId, seriesId],
            );

            const nextStart = (Number(lastRange[0]?.max_end) || 0) + 1;
            const rangeEnd = nextStart + quantity - 1;
            const expiresAt = new Date(
                Date.now() + this.RANGE_TTL_HOURS * 60 * 60 * 1000,
            );

            // Insert new range
            const result = await manager.query(
                `
        INSERT INTO fiscal_sequence_ranges (
          store_id, series_id, device_id,
          range_start, range_end, used_up_to,
          status, granted_at, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
        RETURNING *
        `,
                [
                    storeId,
                    seriesId,
                    deviceId,
                    nextStart,
                    rangeEnd,
                    nextStart - 1, // used_up_to starts at range_start - 1
                    'active',
                    expiresAt,
                ],
            );

            const range = result[0] as FiscalRange;

            this.logger.log(
                `✅ Reserved fiscal range for device ${deviceId}: ${range.range_start}-${range.range_end} (expires: ${expiresAt.toISOString()})`,
            );

            return range;
        });
    }

    /**
     * Consume the next fiscal number from the device's active range.
     * 
     * @param storeId - Store ID
     * @param seriesId - Invoice series ID
     * @param deviceId - Device ID
     * @returns Next fiscal number, or null if range is exhausted
     */
    async consumeNext(
        storeId: string,
        seriesId: string,
        deviceId: string,
    ): Promise<number | null> {
        return this.dataSource.transaction(async (manager) => {
            const range = await manager.query(
                `
        SELECT id, range_start, range_end, used_up_to, status
        FROM fiscal_sequence_ranges
        WHERE store_id = $1
          AND series_id = $2
          AND device_id = $3
          AND status = 'active'
        FOR UPDATE
        `,
                [storeId, seriesId, deviceId],
            );

            if (range.length === 0) {
                this.logger.warn(
                    `No active range found for device ${deviceId}, series ${seriesId}`,
                );
                return null;
            }

            const current = range[0];
            const nextNumber = current.used_up_to + 1;

            // Check if range is exhausted
            if (nextNumber > current.range_end) {
                // Mark as exhausted
                await manager.query(
                    `
          UPDATE fiscal_sequence_ranges
          SET status = 'exhausted'
          WHERE id = $1
          `,
                    [current.id],
                );

                this.logger.warn(
                    `Fiscal range exhausted for device ${deviceId}: ${current.range_start}-${current.range_end}`,
                );
                return null;
            }

            // Update used_up_to
            await manager.query(
                `
        UPDATE fiscal_sequence_ranges
        SET used_up_to = $1
        WHERE id = $2
        `,
                [nextNumber, current.id],
            );

            this.logger.debug(
                `Consumed fiscal number ${nextNumber} from range ${current.range_start}-${current.range_end} (device: ${deviceId})`,
            );

            return nextNumber;
        });
    }

    /**
     * Get the active fiscal range for a device.
     * 
     * @param storeId - Store ID
     * @param seriesId - Invoice series ID
     * @param deviceId - Device ID
     * @returns Active fiscal range, or null if none exists
     */
    async getActiveRange(
        storeId: string,
        seriesId: string,
        deviceId: string,
    ): Promise<FiscalRange | null> {
        const result = await this.dataSource.query(
            `
      SELECT *
      FROM fiscal_sequence_ranges
      WHERE store_id = $1
        AND series_id = $2
        AND device_id = $3
        AND status = 'active'
      `,
            [storeId, seriesId, deviceId],
        );

        return result.length > 0 ? (result[0] as FiscalRange) : null;
    }

    /**
     * Reclaim expired fiscal ranges (cron job runs every hour).
     * Expired ranges are marked as 'expired' but numbers are never reused.
     * 
     * @returns Number of ranges reclaimed
     */
    @Cron(CronExpression.EVERY_HOUR)
    async reclaimExpiredRanges(): Promise<number> {
        const result = await this.dataSource.query(
            `
      UPDATE fiscal_sequence_ranges
      SET status = 'expired'
      WHERE status = 'active'
        AND expires_at < NOW()
      RETURNING id, device_id, range_start, range_end
      `,
        );

        if (result.length > 0) {
            this.logger.warn(
                `♻️ Reclaimed ${result.length} expired fiscal ranges: ${result.map((r: any) => `${r.device_id}:${r.range_start}-${r.range_end}`).join(', ')}`,
            );
        }

        return result.length;
    }

    /**
     * Get all ranges for a device (for debugging/admin).
     */
    async getRangesForDevice(
        storeId: string,
        seriesId: string,
        deviceId: string,
    ): Promise<FiscalRange[]> {
        const result = await this.dataSource.query(
            `
      SELECT *
      FROM fiscal_sequence_ranges
      WHERE store_id = $1
        AND series_id = $2
        AND device_id = $3
      ORDER BY granted_at DESC
      `,
            [storeId, seriesId, deviceId],
        );

        return result as FiscalRange[];
    }

    /**
     * Validate if a fiscal number belongs to a valid range allocated to the device.
     */
    async validateFiscalNumber(
        storeId: string,
        number: number,
        seriesId: string,
        deviceId: string
    ): Promise<boolean> {
        const result = await this.dataSource.query(
            `
            SELECT 1 
            FROM fiscal_sequence_ranges 
            WHERE store_id = $1 
              AND series_id = $2
              AND device_id = $3
              AND $4 BETWEEN range_start AND range_end
            LIMIT 1
            `,
            [storeId, seriesId, deviceId, number]
        );

        return result.length > 0;
    }
}
