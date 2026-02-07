export interface KitchenOrderItem {
    id: string;
    product_name: string;
    qty: number;
    note: string | null;
    status: 'pending' | 'preparing' | 'ready';
    added_at: string;
}

export interface KitchenOrder {
    id: string;
    order_number: string;
    table_number: string;
    table_name: string | null;
    items: KitchenOrderItem[];
    created_at: string;
    elapsed_time: number;
}
