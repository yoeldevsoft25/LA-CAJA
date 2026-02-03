import { Injectable, BadRequestException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { ProductSerial } from '../../../database/entities/product-serial.entity';
import { ProductLot } from '../../../database/entities/product-lot.entity';
import { LotMovement } from '../../../database/entities/lot-movement.entity';
import { InventoryMovement } from '../../../database/entities/inventory-movement.entity';
import { WarehousesService } from '../../../warehouses/warehouses.service';
import { randomUUID } from 'crypto';
import { SaleItem } from '../../../database/entities/sale-item.entity';

@Injectable()
export class SalesReturnInventoryService {
  constructor(private readonly warehousesService: WarehousesService) {}

  async resolveWarehousesFromMovements(
    manager: EntityManager,
    storeId: string,
    saleId: string,
  ): Promise<Map<string, string | null>> {
    const saleMovements = await manager
      .createQueryBuilder(InventoryMovement, 'movement')
      .where('movement.store_id = :storeId', { storeId })
      .andWhere("movement.ref ->> 'sale_id' = :saleId", { saleId })
      .getMany();

    const warehouseByItemKey = new Map<string, string | null>();
    for (const movement of saleMovements) {
      const key = `${movement.product_id}:${movement.variant_id || 'null'}`;
      if (!warehouseByItemKey.has(key)) {
        warehouseByItemKey.set(key, movement.warehouse_id || null);
      }
    }
    return warehouseByItemKey;
  }

  async processItemStock(
    manager: EntityManager,
    storeId: string,
    saleId: string,
    userId: string,
    returnId: string,
    saleItem: SaleItem,
    returnQty: number,
    serialIds?: string[],
    warehouseId?: string | null,
    reason?: string,
    note?: string,
  ): Promise<void> {
    const now = new Date();

    // 1. Process Serials
    if (serialIds && serialIds.length > 0) {
      const serialsToReturn = await manager.find(ProductSerial, {
        where: { id: In(serialIds) },
      });

      if (serialsToReturn.length !== serialIds.length) {
        throw new BadRequestException(
          'No se encontraron todos los seriales especificados',
        );
      }

      for (const serial of serialsToReturn) {
        if (serial.sale_item_id !== saleItem.id || serial.status !== 'sold') {
          throw new BadRequestException(
            `El serial ${serial.id} no pertenece a esta venta o no está vendido`,
          );
        }

        serial.status = 'returned';
        serial.sale_id = null;
        serial.sale_item_id = null;
        serial.sold_at = null;
        serial.updated_at = now;
        await manager.save(ProductSerial, serial);
      }
    }

    // 2. Process Lots
    if (saleItem.lot_id) {
      const lot = await manager.findOne(ProductLot, {
        where: { id: saleItem.lot_id },
      });
      if (lot) {
        lot.remaining_quantity =
          Number(lot.remaining_quantity) + Number(returnQty);
        lot.updated_at = now;
        await manager.save(ProductLot, lot);

        const lotMovement = manager.create(LotMovement, {
          id: randomUUID(),
          lot_id: lot.id,
          movement_type: 'adjusted',
          qty_delta: returnQty,
          happened_at: now,
          sale_id: saleId,
          note: note || reason || `Devolución ${saleId}`,
        });
        await manager.save(LotMovement, lotMovement);
      }
    }

    // 3. Inventory Stock Movement
    const finalWarehouseId =
      warehouseId ||
      (await this.warehousesService.getDefaultOrFirst(storeId)).id;

    const movement = manager.create(InventoryMovement, {
      id: randomUUID(),
      store_id: storeId,
      product_id: saleItem.product_id,
      variant_id: saleItem.variant_id || null,
      movement_type: 'adjust',
      qty_delta: returnQty,
      unit_cost_bs: 0,
      unit_cost_usd: 0,
      warehouse_id: finalWarehouseId,
      note: note || reason || `Devolución ${saleId}`,
      ref: {
        sale_id: saleId,
        sale_item_id: saleItem.id,
        return_id: returnId,
        return: true,
        warehouse_id: finalWarehouseId,
      },
      happened_at: now,
      approved: true,
      requested_by: userId,
      approved_by: userId,
      approved_at: now,
    });
    await manager.save(InventoryMovement, movement);

    if (finalWarehouseId) {
      await this.warehousesService.updateStock(
        finalWarehouseId,
        saleItem.product_id,
        saleItem.variant_id || null,
        returnQty,
        storeId,
        manager,
      );
    }
  }
}
