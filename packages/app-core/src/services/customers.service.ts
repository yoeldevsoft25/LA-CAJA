import { api } from '../runtime/api';
import { db, LocalCustomer } from '../db/database';
import { createLogger } from '../lib/logger';
import {
    Customer,
    CreateCustomerDto,
    UpdateCustomerDto,
    CustomerPurchaseHistory,
    CreditCheckResult
} from '../types/customer.types';

const logger = createLogger('CustomersService');

// Singleton para el manejo de cache local (si fuera necesario, pero aquí usamos IndexedDB directamente)
// En la PWA original usaba CacheManager de @la-caja/sync.
// Para mantener consistencia con app-core, usaremos los métodos de db centralizados.

/**
 * Guarda un cliente en IndexedDB para acceso offline
 */
async function saveCustomerToLocalDB(customer: Customer): Promise<void> {
    try {
        const localCustomer: LocalCustomer = {
            id: customer.id,
            store_id: customer.store_id,
            name: customer.name,
            document_id: customer.document_id || null,
            phone: customer.phone || null,
            email: customer.email || null,
            credit_limit: customer.credit_limit || null,
            note: customer.note || null,
            debt_cutoff_at: customer.debt_cutoff_at ? new Date(customer.debt_cutoff_at).getTime() : null,
            updated_at: new Date(customer.updated_at).getTime(),
            cached_at: Date.now(),
        };
        await db.customers.put(localCustomer);
    } catch (error) {
        logger.error('Error saving to local DB', error);
    }
}

/**
 * Guarda múltiples clientes en IndexedDB
 */
async function saveCustomersToLocalDB(customers: Customer[]): Promise<void> {
    try {
        const localCustomers: LocalCustomer[] = customers.map((customer) => ({
            id: customer.id,
            store_id: customer.store_id,
            name: customer.name,
            document_id: customer.document_id || null,
            phone: customer.phone || null,
            email: customer.email || null,
            credit_limit: customer.credit_limit || null,
            note: customer.note || null,
            debt_cutoff_at: customer.debt_cutoff_at ? new Date(customer.debt_cutoff_at).getTime() : null,
            updated_at: new Date(customer.updated_at).getTime(),
            cached_at: Date.now(),
        }));
        await db.customers.bulkPut(localCustomers);
    } catch (error) {
        logger.error('Error bulk saving to local DB', error);
    }
}

/**
 * Mapea un cliente de IndexedDB al modelo de dominio
 */
function mapLocalToCustomer(c: LocalCustomer): Customer {
    return {
        id: c.id,
        store_id: c.store_id,
        name: c.name,
        document_id: c.document_id,
        phone: c.phone,
        email: c.email,
        credit_limit: c.credit_limit,
        note: c.note,
        debt_cutoff_at: c.debt_cutoff_at ? new Date(c.debt_cutoff_at).toISOString() : null,
        created_at: new Date(c.cached_at).toISOString(),
        updated_at: new Date(c.updated_at).toISOString(),
    };
}

/**
 * Servicio para gestión de clientes con soporte offline-first
 */
export const customersService = {
    /**
     * Busca clientes por nombre, cédula o teléfono
     */
    async search(search?: string): Promise<Customer[]> {
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;

        if (!isOnline) {
            return this.searchOffline(search);
        }

        try {
            const response = await api.get<Customer[]>('/customers', {
                params: search ? { search } : {},
            });
            const customers = response.data;

            // Guardar en IndexedDB
            await saveCustomersToLocalDB(customers);

            return customers;
        } catch (error) {
            logger.warn('API error, falling back to IndexedDB', { error });
            return this.searchOffline(search);
        }
    },

    /**
     * Obtiene un cliente por su ID
     */
    async getById(id: string): Promise<Customer> {
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;

        if (!isOnline) {
            const localCustomer = await db.customers.get(id);
            if (localCustomer) {
                return mapLocalToCustomer(localCustomer);
            }
            throw new Error(`Cliente ${id} no encontrado en cache local`);
        }

        try {
            const response = await api.get<Customer>(`/customers/${id}`);
            const customer = response.data;

            // Guardar en IndexedDB
            await saveCustomerToLocalDB(customer);

            return customer;
        } catch (error) {
            logger.warn('API error, falling back to IndexedDB', { error });
            const localCustomer = await db.customers.get(id);
            if (localCustomer) {
                return mapLocalToCustomer(localCustomer);
            }
            throw error;
        }
    },

    async create(data: CreateCustomerDto): Promise<Customer> {
        const response = await api.post<Customer>('/customers', data);
        const customer = response.data;

        await saveCustomerToLocalDB(customer);
        return customer;
    },

    async update(id: string, data: UpdateCustomerDto): Promise<Customer> {
        const response = await api.put<Customer>(`/customers/${id}`, data);
        const customer = response.data;

        await saveCustomerToLocalDB(customer);
        return customer;
    },

    /**
     * Obtiene el historial de compras de un cliente
     */
    async getPurchaseHistory(
        customerId: string,
        limit = 10
    ): Promise<CustomerPurchaseHistory> {
        const response = await api.get<CustomerPurchaseHistory>(
            `/customers/${customerId}/purchase-history`,
            { params: { limit: limit.toString() } }
        );
        return response.data;
    },

    /**
     * Verifica el crédito disponible de un cliente
     */
    async checkCredit(
        customerId: string,
        amountUsd: number
    ): Promise<CreditCheckResult> {
        const response = await api.get<CreditCheckResult>(
            `/customers/${customerId}/credit-check`,
            { params: { amount: amountUsd.toString() } }
        );
        return response.data;
    },

    /**
     * Elimina un cliente
     */
    async delete(id: string): Promise<void> {
        await api.delete(`/customers/${id}`);
        await db.customers.delete(id);
    },

    /**
     * Búsqueda offline: busca en IndexedDB local
     */
    async searchOffline(search?: string): Promise<Customer[]> {
        const localCustomers = await db.customers.toArray();

        if (search && search.trim() !== '') {
            const searchLower = search.toLowerCase();
            const filtered = localCustomers.filter(
                (c) =>
                    c.name.toLowerCase().includes(searchLower) ||
                    (c.document_id && c.document_id.toLowerCase().includes(searchLower)) ||
                    (c.phone && c.phone.toLowerCase().includes(searchLower))
            );

            return filtered.slice(0, 50).map(mapLocalToCustomer);
        }

        return localCustomers
            .sort((a, b) => b.updated_at - a.updated_at)
            .slice(0, 50)
            .map(mapLocalToCustomer);
    },

    /**
     * Obtener cliente offline
     */
    async getByIdOffline(id: string): Promise<Customer | null> {
        const localCustomer = await db.customers.get(id);
        if (!localCustomer) {
            return null;
        }

        return mapLocalToCustomer(localCustomer);
    },
};
