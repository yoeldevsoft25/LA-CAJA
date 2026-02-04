import { LocalProduct, LocalSale, LocalCustomer } from '@/db/database';
import { BaseEvent } from '@la-caja/domain';
import { LocalEvent } from '../database';

export interface ICustomerRepository extends IRepository<LocalCustomer, string> {
    search(options: { storeId: string, search?: string, limit?: number }): Promise<LocalCustomer[]>;
}

export interface IEventRepository {
    add(event: LocalEvent): Promise<void>;
    addBatch(events: LocalEvent[]): Promise<void>;
    getPending(limit: number): Promise<LocalEvent[]>;
    findByEventId(eventId: string): Promise<LocalEvent | undefined>;
    markAsSynced(eventIds: string[]): Promise<void>;
    markAsFailed(eventId: string, error: string, nextRetryAt?: number, isTerminal?: boolean): Promise<void>;
    resetFailedToPending(): Promise<void>;
    getLastSeq(storeId: string, deviceId: string): Promise<number>;
    countPending(): Promise<number>;
    pruneSynced(maxAge: number): Promise<number>;
}

export interface IRepository<T, ID> {
    findById(id: ID): Promise<T | undefined>;
    findAll(): Promise<T[]>;
    save(entity: T): Promise<void>;
    saveAll(entities: T[]): Promise<void>;
    delete(id: ID): Promise<void>;
    count(): Promise<number>;
}

export interface ProductFilterOptions {
    search?: string;
    category?: string;
    is_active?: boolean;
    is_visible_public?: boolean;
    product_type?: 'sale_item' | 'ingredient' | 'prepared';
    limit?: number;
}

export interface IProductRepository extends IRepository<LocalProduct, string> {
    search(options: ProductFilterOptions): Promise<LocalProduct[]>;
}
export interface ISaleRepository extends IRepository<LocalSale, string> {
    findByStoreId(storeId: string, limit?: number): Promise<LocalSale[]>;
}
