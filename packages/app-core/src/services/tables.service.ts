import { api } from '../runtime/api';
import {
    Table,
    TableStatus,
    CreateTableRequest,
    UpdateTableRequest,
} from '../types/tables.types';

export const tablesService = {
    /**
     * Crea una nueva mesa
     */
    async createTable(data: CreateTableRequest): Promise<Table> {
        const response = await api.post<Table>('/tables', data);
        return response.data;
    },

    /**
     * Obtiene todas las mesas de la tienda
     */
    async getTablesByStore(status?: TableStatus): Promise<Table[]> {
        const params = status ? `?status=${status}` : '';
        const response = await api.get<Table[]>(`/tables${params}`);
        return response.data;
    },

    /**
     * Obtiene una mesa por ID
     */
    async getTableById(id: string): Promise<Table> {
        const response = await api.get<Table>(`/tables/${id}`);
        return response.data;
    },

    /**
     * Actualiza una mesa
     */
    async updateTable(id: string, data: UpdateTableRequest): Promise<Table> {
        const response = await api.put<Table>(`/tables/${id}`, data);
        return response.data;
    },

    /**
     * Actualiza el estado de una mesa
     */
    async updateTableStatus(id: string, status: TableStatus): Promise<Table> {
        const response = await api.put<Table>(`/tables/${id}/status`, { status });
        return response.data;
    },

    /**
     * Elimina una mesa
     */
    async deleteTable(id: string): Promise<void> {
        await api.delete(`/tables/${id}`);
    },
};
