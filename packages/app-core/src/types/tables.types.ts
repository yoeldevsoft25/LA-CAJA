export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'out_of_service';

export interface Table {
    id: string;
    store_id: string;
    table_number: string;
    name: string | null;
    capacity: number | null;
    status: TableStatus;
    current_order_id: string | null;
    zone: string | null;
    coordinates: {
        x: number;
        y: number;
        type?: 'table' | 'bar' | 'corridor' | 'wall' | 'zone';
        w?: number;
        h?: number;
    } | null;
    estimated_dining_time: number | null;
    note: string | null;
    created_at: string;
    updated_at: string;
    currentOrder?: {
        id: string;
        order_number: string;
        status: string;
    } | null;
    qrCode?: {
        id: string;
        qr_code: string;
        public_url: string;
    } | null;
}

export interface CreateTableRequest {
    table_number: string;
    name?: string | null;
    capacity?: number | null;
    status?: TableStatus;
    zone?: string | null;
    coordinates?: {
        x: number;
        y: number;
        type?: 'table' | 'bar' | 'corridor' | 'wall' | 'zone';
        w?: number;
        h?: number;
    } | null;
    estimated_dining_time?: number | null;
    note?: string | null;
}

export interface UpdateTableRequest {
    table_number?: string;
    name?: string | null;
    capacity?: number | null;
    status?: TableStatus;
    zone?: string | null;
    coordinates?: { x: number; y: number } | null;
    estimated_dining_time?: number | null;
    note?: string | null;
}
