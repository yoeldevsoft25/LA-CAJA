import { createLogger } from '@/lib/logger';
import { api } from '@/lib/api';

const logger = createLogger('ConnectivityService');

type ConnectivityListener = (isOnline: boolean) => void;

class ConnectivityService {
    private static instance: ConnectivityService;
    private isOnline: boolean = navigator.onLine;
    private listeners: ConnectivityListener[] = [];
    private checkInterval: NodeJS.Timeout | null = null;
    private readonly CHECK_INTERVAL_MS = 10000; // Check every 10 seconds
    private readonly CHECK_TIMEOUT_MS = 5000; // Timeout for health check

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
        if (this.checkInterval) clearInterval(this.checkInterval);
        this.checkInterval = setInterval(() => this.checkConnectivity(), this.CHECK_INTERVAL_MS);
        // Initial check
        this.checkConnectivity();
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

            // Use fetch directly to avoid interceptors potentially messing with it
            // Assuming api.defaults.baseURL is set. If not, fallback or use relative.
            const baseURL = api.defaults.baseURL || '';
            // Ensure no double slash if baseURL ends with /
            const url = `${baseURL.replace(/\/$/, '')}/health`;

            const response = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal,
                cache: 'no-store'
            });

            clearTimeout(timeoutId);

            const isReachable = response.ok;
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
            this.notifyListeners();

            // Dispatch global event for other components unaware of this service
            window.dispatchEvent(new CustomEvent('connectivity-changed', {
                detail: { online: newStatus }
            }));
        }
    }
}

export const connectivityService = ConnectivityService.getInstance();
