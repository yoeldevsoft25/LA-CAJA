import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Product } from '../database/entities/product.entity';
import { RecipeIngredient } from '../database/entities/recipe-ingredient.entity';
import { WarehouseStock } from '../database/entities/warehouse-stock.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { WarehousesService } from '../warehouses/warehouses.service';
import { randomUUID } from 'crypto';

@Injectable()
export class RecipesService {
    private readonly logger = new Logger(RecipesService.name);

    constructor(
        @InjectRepository(Product)
        private productRepository: Repository<Product>,
        @InjectRepository(RecipeIngredient)
        private recipeIngredientRepository: Repository<RecipeIngredient>,
        @InjectRepository(WarehouseStock)
        private warehouseStockRepository: Repository<WarehouseStock>,
        private dataSource: DataSource,
        private warehousesService: WarehousesService,
    ) { }

    /**
     * Obtiene los ingredientes de una receta
     */
    async getIngredients(productId: string): Promise<RecipeIngredient[]> {
        return this.recipeIngredientRepository.find({
            where: { recipe_product_id: productId },
            relations: ['ingredient_product'],
        });
    }

    /**
     * Calcula el costo total de un plato basado en sus ingredientes
     */
    async calculateRecipeCost(productId: string): Promise<{ cost_bs: number; cost_usd: number }> {
        const ingredients = await this.getIngredients(productId);
        let totalBs = 0;
        let totalUsd = 0;

        for (const ingredient of ingredients) {
            const item = ingredient.ingredient_product;
            const qty = Number(ingredient.qty);

            // Si el ingrediente se mide en peso, usamos el costo por peso
            if (item.is_weight_product && item.cost_per_weight_usd) {
                totalUsd += Number(item.cost_per_weight_usd) * qty;
                totalBs += Number(item.cost_per_weight_bs) * qty;
            } else {
                totalUsd += Number(item.cost_usd) * qty;
                totalBs += Number(item.cost_bs) * qty;
            }
        }

        return {
            cost_bs: Math.round(totalBs * 100) / 100,
            cost_usd: Math.round(totalUsd * 100) / 100,
        };
    }

    /**
     * Descuenta stock de ingredientes cuando se prepara un plato
     */
    async consumeIngredients(
        storeId: string,
        productId: string,
        quantity: number = 1,
        warehouseId?: string,
    ): Promise<void> {
        const ingredients = await this.getIngredients(productId);
        if (ingredients.length === 0) return;

        await this.dataSource.transaction(async (manager) => {
            // Determinar bodega (cocina por defecto o primera disponible)
            let targetWarehouseId = warehouseId;
            if (!targetWarehouseId) {
                const defaultWarehouse = await this.warehousesService.getDefaultOrFirst(storeId, manager);
                targetWarehouseId = defaultWarehouse.id;
            }

            for (const ingredient of ingredients) {
                const qtyToConsume = Number(ingredient.qty) * quantity;

                // 1. Actualizar stock en bodega
                await this.warehousesService.updateStock(
                    targetWarehouseId,
                    ingredient.ingredient_product_id,
                    null, // Sin variante por ahora en ingredientes base
                    -qtyToConsume,
                    storeId,
                    manager,
                );

                // 2. Registrar movimiento de inventario
                const movement = manager.create(InventoryMovement, {
                    id: randomUUID(),
                    store_id: storeId,
                    product_id: ingredient.ingredient_product_id,
                    movement_type: 'adjust',
                    qty_delta: -qtyToConsume,
                    unit_cost_bs: ingredient.ingredient_product.cost_bs,
                    unit_cost_usd: ingredient.ingredient_product.cost_usd,
                    warehouse_id: targetWarehouseId,
                    note: `Consumo por preparación de receta: ${productId}`,
                    happened_at: new Date(),
                    approved: true,
                });

                await manager.save(InventoryMovement, movement);
            }
        });
    }

    /**
     * Calcula cuántas porciones de un plato se pueden preparar con el stock actual
     */
    async calculateAvailability(storeId: string, productId: string, warehouseId?: string): Promise<number> {
        const ingredients = await this.getIngredients(productId);
        if (ingredients.length === 0) return 999; // Si no tiene receta, asumimos infinito o controlado por stock directo

        // Obtener stock de todos los ingredientes en la bodega seleccionada
        let targetWarehouseId = warehouseId;
        if (!targetWarehouseId) {
            const defaultWarehouse = await this.warehousesService.getDefaultOrFirst(storeId);
            targetWarehouseId = defaultWarehouse.id;
        }

        let minPortions = Infinity;

        for (const ingredient of ingredients) {
            const stock = await this.warehouseStockRepository.findOne({
                where: {
                    warehouse_id: targetWarehouseId,
                    product_id: ingredient.ingredient_product_id,
                },
            });

            const currentStock = Number(stock?.stock || 0);
            const qtyPerPortion = Number(ingredient.qty);

            const possiblePortions = Math.floor(currentStock / qtyPerPortion);
            if (possiblePortions < minPortions) {
                minPortions = possiblePortions;
            }
        }

        return minPortions === Infinity ? 0 : minPortions;
    }
}
