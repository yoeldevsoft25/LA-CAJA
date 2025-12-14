import Dexie, { Table } from 'dexie';
import { BaseEvent } from '@la-caja/domain';

/**
 * Base de datos IndexedDB usando Dexie
 * Para PWA - Offline-First
 */
export interface LocalEvent extends BaseEvent {
  id?: number; // Auto-increment para Dexie
  sync_status: 'pending' | 'synced' | 'failed';
  sync_attempts: number;
  synced_at?: number;
}

export class LaCajaDB extends Dexie {
  localEvents!: Table<LocalEvent, number>;
  kv!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('LaCajaDB');
    
    // Versión 1: Schema original (mantener para compatibilidad)
    this.version(1).stores({
      localEvents: '++id, event_id, store_id, device_id, seq, type, sync_status, created_at',
      kv: 'key',
    });
    
    // Versión 2: Índices optimizados (migración automática de Dexie)
    this.version(2).stores({
      localEvents: '++id, event_id, store_id, device_id, seq, type, sync_status, created_at, [sync_status+created_at], [store_id+device_id+sync_status]',
      kv: 'key',
    }).upgrade(async (tx) => {
      // Migración automática - Dexie maneja esto sin pérdida de datos
    });
  }
  
  /**
   * Query optimizada para obtener eventos pendientes de sincronización
   */
  async getPendingEvents(limit: number = 50): Promise<LocalEvent[]> {
    return this.localEvents
      .where('sync_status')
      .equals('pending')
      .orderBy('created_at')
      .limit(limit)
      .toArray();
  }
  
  /**
   * Query optimizada para obtener eventos por dispositivo y estado
   */
  async getEventsByDeviceAndStatus(
    storeId: string,
    deviceId: string,
    status: LocalEvent['sync_status'],
    limit: number = 50
  ): Promise<LocalEvent[]> {
    return this.localEvents
      .where('[store_id+device_id+sync_status]')
      .equals([storeId, deviceId, status])
      .orderBy('created_at')
      .limit(limit)
      .toArray();
  }
}

export const db = new LaCajaDB();


