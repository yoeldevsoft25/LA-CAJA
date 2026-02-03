
/**
 * ReconnectSyncOrchestrator
 *
 * Orchestrates automatic synchronization triggering based on
 * network connectivity and app visibility events.
 *
 * Features:
 * - Listeners: online, visibilitychange, focus
 * - Debounce/Throttle to allow connection stabilization before syncing
 * - Async Locking to prevent parallel syncs
 * - Telemetry hooks
 */

export interface ReconnectOrchestratorConfig {
    /** Time to wait after an event before triggering sync (debounce) */
    debounceMs?: number;
    /** Minimum time between successful syncs */
    throttleMs?: number;
    /** If true, automatically attached listeners on initialization */
    autoAttach?: boolean;
}

export interface ReconnectTelemetry {
    onReconnectDetected: (source: 'online' | 'focus' | 'visibility') => void;
    onSyncStarted: (source: 'online' | 'focus' | 'visibility') => void;
    onSyncSuccess: (source: 'online' | 'focus' | 'visibility') => void;
    onSyncFailed: (source: 'online' | 'focus' | 'visibility', error: Error) => void;
}

export type SyncCallback = () => Promise<void>;

export class ReconnectSyncOrchestrator {
    private debounceMs: number;
    private throttleMs: number;
    private syncCallback: SyncCallback | null = null;
    private telemetry: ReconnectTelemetry | null = null;

    private isSyncing = false;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private lastSyncTime = 0;
    private lastTriggerSource: 'online' | 'focus' | 'visibility' | null = null;

    private boundOnlineHandler: () => void;
    private boundVisibilityHandler: () => void;
    private boundFocusHandler: () => void;


    constructor(config: ReconnectOrchestratorConfig = {}) {
        this.debounceMs = config.debounceMs ?? 2000;
        this.throttleMs = config.throttleMs ?? 5000;

        this.boundOnlineHandler = () => this.handleEvent('online');
        this.boundVisibilityHandler = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                this.handleEvent('visibility');
            }
        };
        this.boundFocusHandler = () => this.handleEvent('focus');
    }

    /**
     * Initialize and attach listeners
     */
    init(callback: SyncCallback, telemetry?: ReconnectTelemetry): void {
        this.syncCallback = callback;
        this.telemetry = telemetry || null;
        this.attachListeners();
    }

    /**
     * Detach listeners and cleanup
     */
    destroy(): void {
        this.detachListeners();
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
    }

    private attachListeners(): void {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', this.boundOnlineHandler);
            window.addEventListener('focus', this.boundFocusHandler);
        }
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this.boundVisibilityHandler);
        }
    }

    private detachListeners(): void {
        if (typeof window !== 'undefined') {
            window.removeEventListener('online', this.boundOnlineHandler);
            window.removeEventListener('focus', this.boundFocusHandler);
        }
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
        }
    }

    private handleEvent(source: 'online' | 'focus' | 'visibility'): void {
        // If browser report offline, ignore 'focus' or 'visibility' triggers for sync
        // The 'online' event itself is the exception as it signals state change
        if (typeof navigator !== 'undefined' && !navigator.onLine && source !== 'online') {
            return;
        }

        // Telemetry: Detected
        this.telemetry?.onReconnectDetected(source);

        // Cancel pending debounce
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.lastTriggerSource = source;

        // Schedule sync
        this.debounceTimer = setTimeout(() => {
            this.triggerSync();
        }, this.debounceMs);
    }

    private async triggerSync(): Promise<void> {
        const source = this.lastTriggerSource || 'online';

        // Locking check
        if (this.isSyncing) {
            return;
        }

        // Throttle check
        const now = Date.now();
        if (now - this.lastSyncTime < this.throttleMs) {
            return;
        }

        // Checking callback
        if (!this.syncCallback) {
            return;
        }

        try {
            this.isSyncing = true;
            this.telemetry?.onSyncStarted(source);

            await this.syncCallback();

            this.lastSyncTime = Date.now();
            this.telemetry?.onSyncSuccess(source);
        } catch (error) {
            this.telemetry?.onSyncFailed(source, error instanceof Error ? error : new Error(String(error)));
        } finally {
            this.isSyncing = false;
            this.debounceTimer = null;
        }
    }
}
