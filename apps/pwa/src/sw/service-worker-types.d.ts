/**
 * Tipos para Service Worker
 */

interface ServiceWorkerGlobalScope extends WorkerGlobalScope {
  registration: ServiceWorkerRegistration;
  skipWaiting(): Promise<void>;
  clients: Clients;
}

interface ServiceWorkerGlobalScopeEventMap extends WorkerGlobalScopeEventMap {
  sync: SyncEvent;
}

interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
  readonly lastChance: boolean;
}

interface ExtendableEvent extends Event {
  waitUntil(f: Promise<any>): void;
}

interface Clients {
  claim(): Promise<void>;
  get(id: string): Promise<Client | null>;
  matchAll(options?: ClientQueryOptions): Promise<Client[]>;
  openWindow(url: string): Promise<WindowClient | null>;
}

interface Client {
  readonly id: string;
  readonly type: ClientType;
  readonly url: string;
  postMessage(message: any, transfer?: Transferable[]): void;
}

interface WindowClient extends Client {
  readonly focused: boolean;
  readonly visibilityState: VisibilityState;
  focus(): Promise<WindowClient>;
  navigate(url: string): Promise<WindowClient | null>;
}

type ClientType = 'window' | 'worker' | 'sharedworker' | 'all';

interface ClientQueryOptions {
  includeUncontrolled?: boolean;
  type?: ClientType;
}
