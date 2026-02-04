// Feature Flag: Use SQLite for Read Models
// In the future this could be dynamic or env-based
const USE_SQLITE = true;
import Dexie from 'dexie';

import { productRepository as dexieProductRepo } from './dexie/product.repository';
import { sqliteProductRepository } from './sqlite/product.repository';

import { saleRepository as dexieSaleRepo } from './dexie/sale.repository';
import { sqliteSaleRepository } from './sqlite/sale.repository';

import { sqliteCustomerRepository } from './sqlite/customer.repository';
import { sqliteEventRepository } from './sqlite/event.repository';
import { db } from '../database';

// Helper for Dexie Event Repos (Using raw db for now as we didn't implement adapter yet, 
// or I can quickly inline a simple adapter here if needed for fallback)
const dexieEventRepoFallback: any = {
    add: (evt: any) => db.localEvents.add(evt),
    addBatch: (evts: any[]) => db.localEvents.bulkAdd(evts),
    getPending: (limit: number) => db.getPendingEvents(limit),
    findByEventId: (id: string) => db.localEvents.where('event_id').equals(id).first(),
    markAsSynced: (ids: string[]) => db.localEvents.where('event_id').anyOf(ids).modify({ sync_status: 'synced', synced_at: Date.now() }),
    markAsFailed: (id: string, err: string, nextRetryAt?: number, isTerminal?: boolean) => {
        const status = isTerminal ? 'dead' : (nextRetryAt ? 'retrying' : 'failed');
        return db.localEvents.where('event_id').equals(id).modify({
            sync_status: status as any,
            last_error: err,
            next_retry_at: nextRetryAt
        });
    },
    resetFailedToPending: () => db.resetFailedEventsToPending(),
    getLastSeq: async (storeId: string, deviceId: string) => {
        const evt = await db.localEvents.where('[store_id+device_id+seq]').between([storeId, deviceId, Dexie.minKey], [storeId, deviceId, Dexie.maxKey]).last();
        return evt?.seq || 0;
    },
    countPending: () => db.localEvents.where('sync_status').equals('pending').count(),
    pruneSynced: (maxAge: number) => {
        const cutoff = Date.now() - maxAge;
        return db.localEvents.where('sync_status').equals('synced').and(e => (e.synced_at || 0) < cutoff).delete();
    }
};

export const productRepository = USE_SQLITE ? sqliteProductRepository : dexieProductRepo;
export const saleRepository = USE_SQLITE ? sqliteSaleRepository : dexieSaleRepo;
export const customerRepository = sqliteCustomerRepository;
export const eventRepository = USE_SQLITE ? sqliteEventRepository : dexieEventRepoFallback;


// Re-export repository types
export * from './types';
