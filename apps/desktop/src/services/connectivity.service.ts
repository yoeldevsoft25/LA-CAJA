import { createLogger } from '@/lib/logger';
import { api } from '@/lib/api';

const logger = createLogger('ConnectivityService');
const PRIMARY_API_URL = import.meta.env.VITE_PRIMARY_API_URL as string | undefined;
const FALLBACK_API_URL = import.meta.env.VITE_FALLBACK_API_URL as string | undefined;
const TERTIARY_API_URL = import.meta.env.VITE_TERTIARY_API_URL as string | undefined;

type ConnectivityListener = (isOnline: boolean) => void;

class ConnectivityService {
    private static instance: ConnectivityService;
    private isOnline: boolean = navigator.onLine;
    private listeners: ConnectivityListener[] = [];
    private checkInterval: NodeJS.Timeout | null = null;
    private readonly ONLINE_INTERVAL_MS = 30000;   // Check every 30s when online
    private readonly OFFLINE_INTERVAL_MS = 5000;   // Check every 5s when offline (to detect recovery faster)
    private readonly CHECK_TIMEOUT_MS = 5000;
    private currentIntervalMs: number = this.ONLINE_INTERVAL_MS;

    private constructor() {
        this.setupWindowListeners();
        this.startActiveCheck();
    }

    public static getInstance(): ConnectivityService {
        if (!ConnectivityService.instance) {
            ConnectivityService.instance = new ConnectivityService();
        }
        return ConnectivityService.instance;
    }

    public get online(): boolean {
        return this.isOnline;
    }

    public addListener(listener: ConnectivityListener): () => void {
        this.listeners.push(listener);
        listener(this.isOnline); // Immediate callback
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener(this.isOnline));
    }

    private setupWindowListeners() {
        window.addEventListener('online', () => {
            logger.debug('Window event: online - triggering immediate check');
            this.checkConnectivity();
        });

        window.addEventListener('offline', () => {
            logger.debug('Window event: offline');
            this.setOnlineStatus(false);
        });
    }

    private startActiveCheck() {
        this.scheduleNextCheck();
    }

    private scheduleNextCheck() {
        if (this.checkInterval) clearTimeout(this.checkInterval);

        // Adaptive interval: if offline, check more frequently to recover.
        // If online, check less frequently to save resources.
        // Override: if navigator.onLine is false, allow frequent checks but they will fast-fail anyway
        // unless operating system reports online.

        this.currentIntervalMs = this.isOnline ? this.ONLINE_INTERVAL_MS : this.OFFLINE_INTERVAL_MS;

        this.checkInterval = setTimeout(() => {
            this.checkConnectivity().then(() => this.scheduleNextCheck());
        }, this.currentIntervalMs);
    }

    public async checkConnectivity(): Promise<boolean> {
        // If navigator says offline, we are definitely offline
        if (!navigator.onLine) {
            this.setOnlineStatus(false);
            return false;
        }

        try {
            // Try explicit health check
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.CHECK_TIMEOUT_MS);

            // Probe active base first, then configured failovers (never hardcode localhost:3000).
            const candidates = [
                api.defaults.baseURL,
                PRIMARY_API_URL,
                FALLBACK_API_URL,
                TERTIARY_API_URL,
                import.meta.env.VITE_API_URL as string | undefined,
            ]
                .filter((v): v is string => Boolean(v))
                .map((v) => v.replace(/\/$/, ''));

            const uniqueCandidates = [...new Set(candidates)];
            if (uniqueCandidates.length === 0) {
                logger.warn('No API base candidates configured for connectivity checks');
                this.setOnlineStatus(false);
                return false;
            }

            let isReachable = false;
            for (const base of uniqueCandidates) {
                const url = `${base}/health`;
                try {
                    const response = await fetch(url, {
                        method: 'HEAD',
                        signal: controller.signal,
                        cache: 'no-store'
                    });
                    if (response.ok) {
                        isReachable = true;
                        break;
                    }
                } catch {
                    // try next candidate
                }
            }

            clearTimeout(timeoutId);
            this.setOnlineStatus(isReachable);
            return isReachable;

        } catch (error) {
            // Check if it was just a logic error or network error
            logger.warn('Connectivity check failed:', error);
            this.setOnlineStatus(false);
            return false;
        }
    }

    private setOnlineStatus(newStatus: boolean) {
        if (this.isOnline !== newStatus) {
            logger.info(`Connectivity changed: ${this.isOnline} -> ${newStatus}`);
            this.isOnline = newStatus;

            // Re-schedule check with new interval immediately
            this.scheduleNextCheck();

            this.notifyListeners();

            // Dispatch global event for other components unaware of this service
            window.dispatchEvent(new CustomEvent('connectivity-changed', {
                detail: { online: newStatus }
            }));
        }
    }
}

export const connectivityService = ConnectivityService.getInstance();
