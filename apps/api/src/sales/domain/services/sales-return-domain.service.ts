import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Sale } from '../../../database/entities/sale.entity';
import { SaleItem } from '../../../database/entities/sale-item.entity';
import { SaleReturn } from '../../../database/entities/sale-return.entity';
import { SaleReturnItem } from '../../../database/entities/sale-return-item.entity';
import { ProductSerial } from '../../../database/entities/product-serial.entity';
import { randomUUID } from 'crypto';
import { SalesReturnValidationService } from './sales-return-validation.service';
import { SalesReturnInventoryService } from './sales-return-inventory.service';
import { SalesReturnFinancialService } from './sales-return-financial.service';

export interface ReturnItemInput {
  sale_item_id: string;
  qty: number;
  serial_ids?: string[];
  note?: string;
}

@Injectable()
export class SalesReturnDomainService {
  private readonly logger = new Logger(SalesReturnDomainService.name);

  constructor(
    private readonly validationService: SalesReturnValidationService,
    private readonly inventoryService: SalesReturnInventoryService,
    private readonly financialService: SalesReturnFinancialService,
  ) { }

  private async getReturnedQtyMap(
    manager: EntityManager,
    saleItemIds: string[],
  ): Promise<Map<string, number>> {
    const existingReturns = saleItemIds.length
      ? await manager
        .createQueryBuilder(SaleReturnItem, 'return_item')
        .select('return_item.sale_item_id', 'sale_item_id')
        .addSelect('SUM(return_item.qty)', 'returned_qty')
        .where('return_item.sale_item_id IN (:...saleItemIds)', {
          saleItemIds,
        })
        .groupBy('return_item.sale_item_id')
        .getRawMany()
      : [];

    const returnedQtyByItem = new Map<string, number>();
    for (const row of existingReturns) {
      returnedQtyByItem.set(
        row.sale_item_id,
        parseFloat(row.returned_qty) || 0,
      );
    }
    return returnedQtyByItem;
  }

  async buildFullReturnItems(
    manager: EntityManager,
    storeId: string,
    saleId: string,
  ): Promise<ReturnItemInput[]> {
    const sale = await manager.findOne(Sale, {
      where: { id: saleId, store_id: storeId },
      relations: ['items'],
    });

    if (!sale) return [];

    const saleItems =
      sale.items?.length > 0
        ? sale.items
        : await manager.find(SaleItem, { where: { sale_id: saleId } });

    const saleItemIds = saleItems.map((item) => item.id);
    const returnedQtyByItem = await this.getReturnedQtyMap(
      manager,
      saleItemIds,
    );

    const itemsToReturn: ReturnItemInput[] = [];

    for (const saleItem of saleItems) {
      const alreadyReturned = returnedQtyByItem.get(saleItem.id) || 0;
      const returnQty = Number(saleItem.qty) - alreadyReturned;

      if (returnQty <= 0.0001) continue;

      const serialsForItem = await manager.find(ProductSerial, {
        where: { sale_item_id: saleItem.id, status: 'sold' },
      });

      itemsToReturn.push({
        sale_item_id: saleItem.id,
        qty: returnQty,
        serial_ids:
          serialsForItem.length > 0
            ? serialsForItem.map((s) => s.id)
            : undefined,
      });
    }

    return itemsToReturn;
  }

  async processReturn(
    manager: EntityManager,
    storeId: string,
    saleId: string,
    userId: string,
    items: ReturnItemInput[],
    reason?: string,
  ): Promise<SaleReturn> {
    const sale = await manager.findOne(Sale, {
      where: { id: saleId, store_id: storeId },
      relations: ['items'],
    });

    if (!sale) throw new Error('Venta no encontrada');

    // 1. Validations
    await this.validationService.validateSaleForReturn(manager, sale, storeId);

    const saleItems =
      sale.items?.length > 0
        ? sale.items
        : await manager.find(SaleItem, { where: { sale_id: saleId } });

    const saleItemById = new Map(saleItems.map((item) => [item.id, item]));
    const saleItemIds = saleItems.map((i) => i.id);
    const existingReturns = await this.getReturnedQtyMap(manager, saleItemIds);

    // 2. Resolve Warehouses for items
    const warehouseByItemKey =
      await this.inventoryService.resolveWarehousesFromMovements(
        manager,
        storeId,
        saleId,
      );

    const returnId = randomUUID();
    const returnItemsList: SaleReturnItem[] = [];

    const totals = {
      returnSubtotalBs: 0,
      returnSubtotalUsd: 0,
      returnDiscountBs: 0,
      returnDiscountUsd: 0,
      returnTotalBs: 0,
      returnTotalUsd: 0,
    };

    // 3. Process each item
    for (const inputItem of items) {
      const saleItem = saleItemById.get(inputItem.sale_item_id);
      if (!saleItem) throw new Error('Item no pertenece a la venta');

      await this.validationService.validateItemForReturn(
        manager,
        saleItem,
        inputItem,
        existingReturns.get(saleItem.id) || 0,
      );

      const warehouseId = warehouseByItemKey.get(
        `${saleItem.product_id}:${saleItem.variant_id || 'null'}`,
      );

      // Stock & Inventory
      await this.inventoryService.processItemStock(
        manager,
        storeId,
        saleId,
        userId,
        returnId,
        saleItem,
        inputItem.qty,
        inputItem.serial_ids,
        warehouseId,
        reason,
        inputItem.note,
      );

      // Financials
      const itemFin = this.financialService.calculateItemFinancials(
        saleItem,
        inputItem.qty,
      );

      totals.returnSubtotalBs += itemFin.lineSubtotalBs;
      totals.returnSubtotalUsd += itemFin.lineSubtotalUsd;
      totals.returnDiscountBs += itemFin.lineDiscountBs;
      totals.returnDiscountUsd += itemFin.lineDiscountUsd;
      totals.returnTotalBs += itemFin.lineTotalBs;
      totals.returnTotalUsd += itemFin.lineTotalUsd;

      returnItemsList.push(
        manager.create(SaleReturnItem, {
          id: randomUUID(),
          return_id: returnId,
          sale_item_id: saleItem.id,
          product_id: saleItem.product_id,
          variant_id: saleItem.variant_id || null,
          lot_id: saleItem.lot_id || null,
          qty: inputItem.qty,
          unit_price_bs: itemFin.unitPriceBs,
          unit_price_usd: itemFin.unitPriceUsd,
          discount_bs: this.financialService.roundTwo(itemFin.lineDiscountBs),
          discount_usd: this.financialService.roundTwo(itemFin.lineDiscountUsd),
          total_bs: this.financialService.roundTwo(itemFin.lineTotalBs),
          total_usd: this.financialService.roundTwo(itemFin.lineTotalUsd),
          serial_ids: inputItem.serial_ids || null,
          note: inputItem.note || null,
        }),
      );
    }

    // 4. Finalize Financials
    await this.financialService.updateSaleAndDebt(manager, sale, totals);

    // 5. Build and save Return header
    const saleReturn = manager.create(SaleReturn, {
      id: returnId,
      store_id: storeId,
      sale_id: saleId,
      created_by: userId,
      reason: reason || null,
      total_bs: this.financialService.roundTwo(totals.returnTotalBs),
      total_usd: this.financialService.roundTwo(totals.returnTotalUsd),
    });

    const savedReturn = await manager.save(SaleReturn, saleReturn);
    await manager.save(SaleReturnItem, returnItemsList);
    savedReturn.items = returnItemsList;

    return savedReturn;
  }
}
