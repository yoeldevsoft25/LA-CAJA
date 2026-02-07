import { api } from '@/lib/api'
import { RecipeIngredient } from '@la-caja/app-core'

/**
 * Servicio para gestión de recetas en el PWA
 */
export const recipesService = {
    /**
     * Obtiene los ingredientes de una receta
     */
    async getIngredients(productId: string): Promise<RecipeIngredient[]> {
        const response = await api.get<RecipeIngredient[]>(`/recipes/${productId}/ingredients`)
        return response.data
    },

    /**
     * Obtiene el costo calculado de una receta
     */
    async getCalculatedCost(productId: string): Promise<{ cost_bs: number; cost_usd: number }> {
        const response = await api.get<{ cost_bs: number; cost_usd: number }>(`/recipes/${productId}/cost`)
        return response.data
    },

    /**
     * Obtiene la disponibilidad de un plato según stock de ingredientes
     */
    async getAvailability(productId: string, storeId: string, warehouseId?: string): Promise<number> {
        const response = await api.get<number>(`/recipes/${productId}/availability`, {
            params: { store_id: storeId, warehouse_id: warehouseId }
        })
        return response.data
    }
}
