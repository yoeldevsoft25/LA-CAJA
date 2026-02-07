import { api } from '../runtime/api';
import {
    Order,
    OrderItem,
    OrderPayment,
    CreateOrderRequest,
    AddOrderItemRequest,
    CreatePartialPaymentRequest,
    MoveOrderRequest,
    MergeOrdersRequest,
} from '../types/orders.types';
import type { CreateSaleRequest } from '../types/orders.types';

export const ordersService = {
    /**
     * Crea una nueva orden
     */
    async createOrder(data: CreateOrderRequest): Promise<Order> {
        const response = await api.post<Order>('/orders', data);
        return response.data;
    },

    /**
     * Obtiene todas las órdenes abiertas
     */
    async getOpenOrders(): Promise<Order[]> {
        const response = await api.get<Order[]>('/orders/open');
        return response.data;
    },

    /**
     * Obtiene una orden por ID
     */
    async getOrderById(id: string): Promise<Order> {
        const response = await api.get<Order>(`/orders/${id}`);
        return response.data;
    },

    /**
     * Agrega un item a una orden
     */
    async addOrderItem(orderId: string, data: AddOrderItemRequest): Promise<OrderItem> {
        const response = await api.post<OrderItem>(`/orders/${orderId}/items`, data);
        return response.data;
    },

    /**
     * Actualiza la cantidad de un item de una orden
     */
    async updateOrderItemQuantity(orderId: string, itemId: string, qty: number): Promise<OrderItem> {
        const response = await api.patch<OrderItem>(`/orders/${orderId}/items/${itemId}`, { qty });
        return response.data;
    },

    /**
     * Elimina un item de una orden
     */
    async removeOrderItem(orderId: string, itemId: string): Promise<void> {
        await api.put(`/orders/${orderId}/items/${itemId}`, {});
    },

    /**
     * Pausa una orden
     */
    async pauseOrder(orderId: string): Promise<Order> {
        const response = await api.put<Order>(`/orders/${orderId}/pause`, {});
        return response.data;
    },

    /**
     * Reanuda una orden pausada
     */
    async resumeOrder(orderId: string): Promise<Order> {
        const response = await api.put<Order>(`/orders/${orderId}/resume`, {});
        return response.data;
    },

    /**
     * Mueve una orden a otra mesa
     */
    async moveOrder(orderId: string, data: MoveOrderRequest): Promise<Order> {
        const response = await api.put<Order>(`/orders/${orderId}/move`, data);
        return response.data;
    },

    /**
     * Fusiona múltiples órdenes
     */
    async mergeOrders(data: MergeOrdersRequest): Promise<Order> {
        const response = await api.post<Order>('/orders/merge', data);
        return response.data;
    },

    /**
     * Crea un pago parcial (recibo parcial)
     */
    async createPartialPayment(
        orderId: string,
        data: CreatePartialPaymentRequest
    ): Promise<OrderPayment> {
        const response = await api.post<OrderPayment>(`/orders/${orderId}/payments/partial`, data);
        return response.data;
    },

    /**
     * Cierra una orden completa (genera venta final)
     */
    async closeOrder(orderId: string, saleData: CreateSaleRequest): Promise<any> {
        const response = await api.post(`/orders/${orderId}/close`, saleData);
        return response.data;
    },

    /**
     * Cancela una orden
     */
    async cancelOrder(orderId: string): Promise<Order> {
        const response = await api.put<Order>(`/orders/${orderId}/cancel`, {});
        return response.data;
    },
};
