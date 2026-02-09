import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface LockOptions {
    timeoutMs?: number; // Max time to wait for lock acquisition (default: 5000ms)
    ttlMs?: number; // Lock TTL (default: 30000ms)
}

/**
 * Distributed Lock Service using PostgreSQL advisory locks.
 * 
 * This service provides distributed locking capabilities to prevent
 * concurrent execution of critical sections (e.g., reconciliation, escrow operations).
 * 
 * Uses PostgreSQL's pg_advisory_lock for session-level locks and
 * pg_try_advisory_lock for non-blocking attempts.
 */
@Injectable()
export class DistributedLockService {
    private readonly logger = new Logger(DistributedLockService.name);

    constructor(
        @InjectDataSource()
        private dataSource: DataSource,
    ) { }

    /**
     * Acquire a distributed lock with the given key.
     * 
     * @param lockKey - Unique string identifier for the lock (will be hashed to int64)
     * @param options - Lock acquisition options
     * @returns A release function to unlock when done
     * @throws Error if lock cannot be acquired within timeout
     */
    async acquireLock(
        lockKey: string,
        options: LockOptions = {},
    ): Promise<() => Promise<void>> {
        const { timeoutMs = 5000, ttlMs = 30000 } = options;
        const lockId = this.hashKeyToInt64(lockKey);
        const startTime = Date.now();

        this.logger.debug(`Attempting to acquire lock: ${lockKey} (id: ${lockId})`);

        // Try to acquire lock with timeout
        const acquired = await this.tryAcquireWithTimeout(lockId, timeoutMs);

        if (!acquired) {
            throw new Error(
                `Failed to acquire lock "${lockKey}" within ${timeoutMs}ms`,
            );
        }

        const elapsedMs = Date.now() - startTime;
        this.logger.log(
            `✅ Lock acquired: ${lockKey} (waited ${elapsedMs}ms, TTL: ${ttlMs}ms)`,
        );

        // Set up auto-release after TTL (safety mechanism)
        const ttlTimer = setTimeout(() => {
            this.logger.warn(
                `⚠️ Lock TTL expired for "${lockKey}". Auto-releasing (potential deadlock prevention).`,
            );
            this.releaseLock(lockId, lockKey).catch((err) => {
                this.logger.error(`Failed to auto-release lock ${lockKey}: ${err.message}`);
            });
        }, ttlMs);

        // Return release function
        return async () => {
            clearTimeout(ttlTimer);
            await this.releaseLock(lockId, lockKey);
        };
    }

    /**
     * Execute a function with a distributed lock.
     * Automatically acquires the lock, executes the function, and releases the lock.
     * 
     * @param lockKey - Unique lock identifier
     * @param fn - Function to execute while holding the lock
     * @param options - Lock options
     * @returns Result of the function
     */
    async withLock<T>(
        lockKey: string,
        fn: () => Promise<T>,
        options: LockOptions = {},
    ): Promise<T> {
        const release = await this.acquireLock(lockKey, options);
        try {
            return await fn();
        } finally {
            await release();
        }
    }

    /**
     * Try to acquire lock with polling and timeout.
     */
    private async tryAcquireWithTimeout(
        lockId: bigint,
        timeoutMs: number,
    ): Promise<boolean> {
        const startTime = Date.now();
        const pollIntervalMs = 100; // Poll every 100ms

        while (Date.now() - startTime < timeoutMs) {
            const acquired = await this.tryAcquire(lockId);
            if (acquired) {
                return true;
            }
            // Wait before retrying
            await this.sleep(pollIntervalMs);
        }

        return false;
    }

    /**
     * Attempt to acquire lock (non-blocking).
     */
    private async tryAcquire(lockId: bigint): Promise<boolean> {
        try {
            const result = await this.dataSource.query(
                'SELECT pg_try_advisory_lock($1) AS acquired',
                [lockId.toString()],
            );
            return result[0]?.acquired === true;
        } catch (error) {
            this.logger.error(`Error trying to acquire lock: ${error.message}`);
            return false;
        }
    }

    /**
     * Release the lock.
     */
    private async releaseLock(lockId: bigint, lockKey: string): Promise<void> {
        try {
            await this.dataSource.query('SELECT pg_advisory_unlock($1)', [
                lockId.toString(),
            ]);
            this.logger.debug(`🔓 Lock released: ${lockKey} (id: ${lockId})`);
        } catch (error) {
            this.logger.error(
                `Failed to release lock ${lockKey}: ${error.message}`,
            );
            throw error;
        }
    }

    /**
     * Hash a string key to a 64-bit integer for PostgreSQL advisory locks.
     * Uses a simple FNV-1a hash algorithm.
     */
    private hashKeyToInt64(key: string): bigint {
        let hash = 2166136261n; // FNV offset basis (32-bit)
        for (let i = 0; i < key.length; i++) {
            hash ^= BigInt(key.charCodeAt(i));
            hash *= 16777619n; // FNV prime (32-bit)
            // Keep within 63 bits (PostgreSQL bigint range: -2^63 to 2^63-1)
            hash &= 0x7FFFFFFFFFFFFFFFn;
        }
        return hash;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
