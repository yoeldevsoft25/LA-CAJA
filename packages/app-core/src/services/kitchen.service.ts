import { api } from '../runtime/api';
import {
    KitchenOrder,
} from '../types/kitchen.types';

export const kitchenService = {
    /**
     * Obtiene todas las órdenes abiertas para la cocina
     */
    async getKitchenOrders(): Promise<KitchenOrder[]> {
        const response = await api.get<KitchenOrder[]>('/kitchen/orders');
        return response.data;
    },

    /**
     * Obtiene una orden específica para la cocina
     */
    async getKitchenOrder(orderId: string): Promise<KitchenOrder | null> {
        const response = await api.get<{ success: boolean; order?: KitchenOrder }>(
            `/kitchen/orders/${orderId}`
        );
        return response.data.order || null;
    },

    /**
     * Actualiza el estado de un item de orden
     */
    async updateOrderItemStatus(
        orderId: string,
        itemId: string,
        status: 'pending' | 'preparing' | 'ready'
    ): Promise<{ success: boolean; item: { id: string; status: string } }> {
        const response = await api.put<{ success: boolean; item: { id: string; status: string } }>(
            `/kitchen/orders/${orderId}/items/${itemId}/status`,
            { status }
        );
        return response.data;
    },

    async getPublicKitchenLink(): Promise<{ token: string; url: string; has_pin: boolean }> {
        const response = await api.get<{ token: string; url: string; has_pin: boolean }>(
            '/kitchen/public-link'
        );
        return response.data;
    },

    async rotatePublicKitchenLink(): Promise<{ token: string; url: string; has_pin: boolean }> {
        const response = await api.post<{ token: string; url: string; has_pin: boolean }>(
            '/kitchen/public-link/rotate'
        );
        return response.data;
    },

    async setPublicKitchenPin(pin?: string): Promise<{ has_pin: boolean }> {
        const response = await api.post<{ has_pin: boolean }>(
            '/kitchen/public-link/pin',
            { pin }
        );
        return response.data;
    },
};
