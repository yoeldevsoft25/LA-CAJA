import { Request } from 'express';

export interface RequestWithUser extends Request {
    user: {
        sub: string;
        user_id: string; // Alias de sub
        id: string; // Alias de sub
        store_id: string;
        storeId: string; // Alias de store_id
        role: string;
    };
}
