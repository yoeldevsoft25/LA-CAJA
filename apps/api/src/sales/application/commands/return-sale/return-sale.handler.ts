import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource, EntityManager } from 'typeorm';
import { BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ReturnSaleCommand } from './return-sale.command';
import { Sale } from '../../../../database/entities/sale.entity';
import { SaleItem } from '../../../../database/entities/sale-item.entity';
import { FiscalInvoice } from '../../../../database/entities/fiscal-invoice.entity';
import { Debt, DebtStatus } from '../../../../database/entities/debt.entity';
import { DebtPayment } from '../../../../database/entities/debt-payment.entity';
import { SaleReturn } from '../../../../database/entities/sale-return.entity';
import { SaleReturnItem } from '../../../../database/entities/sale-return-item.entity';
import { InventoryMovement } from '../../../../database/entities/inventory-movement.entity';
import { ProductLot } from '../../../../database/entities/product-lot.entity';
import { LotMovement } from '../../../../database/entities/lot-movement.entity';
import { ProductSerial } from '../../../../database/entities/product-serial.entity';
import { WarehousesService } from '../../../../warehouses/warehouses.service';
import { randomUUID } from 'crypto';

@CommandHandler(ReturnSaleCommand)
export class ReturnSaleHandler implements ICommandHandler<ReturnSaleCommand> {
  private readonly logger = new Logger(ReturnSaleHandler.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly warehousesService: WarehousesService,
  ) { }

  async execute(command: ReturnSaleCommand): Promise<SaleReturn> {
    const { storeId, saleId, userId, reason } = command;

    const roundTwo = (value: number) => Math.round(value * 100) / 100;

    return this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. Fetch sale with items
      const sale = await manager.findOne(Sale, {
        where: { id: saleId, store_id: storeId },
        relations: ['items'],
      });

      if (!sale) {
        throw new NotFoundException('Venta no encontrada');
      }

      if (sale.voided_at) {
        throw new BadRequestException('La venta está anulada');
      }

      // 2. Fiscal validation
      const fiscalInvoices = await manager.find(FiscalInvoice, {
        where: { sale_id: saleId, store_id: storeId },
      });

      const issuedInvoice = fiscalInvoices.find(
        (inv) => inv.invoice_type === 'invoice' && inv.status === 'issued',
      );

      if (issuedInvoice) {
        const issuedCreditNote = fiscalInvoices.find(
          (inv) =>
            inv.invoice_type === 'credit_note' && inv.status === 'issued',
        );

        if (!issuedCreditNote) {
          throw new BadRequestException(
            'La venta tiene una factura fiscal emitida. Debe crear y emitir una nota de crédito antes de realizar la devolución total.',
          );
        }
      }

      // 3. Debt validation
      const debt = await manager.findOne(Debt, {
        where: { sale_id: saleId, store_id: storeId },
      });
      if (debt) {
        const paymentsCount = await manager.count(DebtPayment, {
          where: { debt_id: debt.id },
        });
        if (paymentsCount > 0) {
          throw new BadRequestException(
            'La venta tiene pagos asociados. Debes reversar los pagos antes de la devolución total.',
          );
        }
      }

      // 4. Identify items to return (All items not yet returned)
      const saleItems =
        sale.items?.length > 0
          ? sale.items
          : await manager.find(SaleItem, { where: { sale_id: saleId } });

      const saleItemIds = saleItems.map((item) => item.id);

      // Get already returned quantities to determine what's left
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

      // Get original movements to identify warehouses
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

      const defaultWarehouse =
        await this.warehousesService.getDefaultOrFirst(storeId);
      const returnId = randomUUID();
      const now = new Date();

      let returnSubtotalBs = 0;
      let returnSubtotalUsd = 0;
      let returnDiscountBs = 0;
      let returnDiscountUsd = 0;
      let returnTotalBs = 0;
      let returnTotalUsd = 0;

      const returnItemsList: SaleReturnItem[] = [];

      // 5. Process each item for full return
      for (const saleItem of saleItems) {
        const alreadyReturned = returnedQtyByItem.get(saleItem.id) || 0;
        const returnQty = Number(saleItem.qty) - alreadyReturned;

        // Skip items already fully returned
        if (returnQty <= 0.0001) continue;

        // Process Serials if any
        const serialsForItem = await manager.find(ProductSerial, {
          where: { sale_item_id: saleItem.id, status: 'sold' },
        });

        if (serialsForItem.length > 0) {
          // For a full return of a serialized item, we return all sold serials belonging to this sale item
          for (const serial of serialsForItem) {
            serial.status = 'returned';
            serial.sale_id = null;
            serial.sale_item_id = null;
            serial.sold_at = null;
            serial.updated_at = now;
            await manager.save(ProductSerial, serial);
          }
        }

        // Process Lots if any
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
              note: reason || `Devolución total ${saleId}`,
            });
            await manager.save(LotMovement, lotMovement);
          }
        }

        // Update Inventory Stock
        const key = `${saleItem.product_id}:${saleItem.variant_id || 'null'}`;
        const warehouseId = warehouseByItemKey.get(key) || defaultWarehouse.id;

        const movement = manager.create(InventoryMovement, {
          id: randomUUID(),
          store_id: storeId,
          product_id: saleItem.product_id,
          variant_id: saleItem.variant_id || null,
          movement_type: 'adjust', // Consistent with legacy
          qty_delta: returnQty,
          unit_cost_bs: 0,
          unit_cost_usd: 0,
          warehouse_id: warehouseId,
          note: reason || `Devolución total ${saleId}`,
          ref: {
            sale_id: saleId,
            sale_item_id: saleItem.id,
            return_id: returnId,
            return: true,
            warehouse_id: warehouseId,
          },
          happened_at: now,
          approved: true,
          requested_by: userId,
          approved_by: userId,
          approved_at: now,
        });
        await manager.save(InventoryMovement, movement);

        if (warehouseId) {
          await this.warehousesService.updateStock(
            warehouseId,
            saleItem.product_id,
            saleItem.variant_id || null,
            returnQty,
            storeId,
            manager,
          );
        }

        // Financial calculations
        const unitPriceBs = Number(saleItem.unit_price_bs || 0);
        const unitPriceUsd = Number(saleItem.unit_price_usd || 0);
        const itemQty = Number(saleItem.qty) || 1;
        const perUnitDiscountBs =
          itemQty > 0 ? Number(saleItem.discount_bs || 0) / itemQty : 0;
        const perUnitDiscountUsd =
          itemQty > 0 ? Number(saleItem.discount_usd || 0) / itemQty : 0;

        const lineSubtotalBs = unitPriceBs * returnQty;
        const lineSubtotalUsd = unitPriceUsd * returnQty;
        const lineDiscountBs = perUnitDiscountBs * returnQty;
        const lineDiscountUsd = perUnitDiscountUsd * returnQty;
        const lineTotalBs = lineSubtotalBs - lineDiscountBs;
        const lineTotalUsd = lineSubtotalUsd - lineDiscountUsd;

        returnSubtotalBs += lineSubtotalBs;
        returnSubtotalUsd += lineSubtotalUsd;
        returnDiscountBs += lineDiscountBs;
        returnDiscountUsd += lineDiscountUsd;
        returnTotalBs += lineTotalBs;
        returnTotalUsd += lineTotalUsd;

        const returnItem = manager.create(SaleReturnItem, {
          id: randomUUID(),
          return_id: returnId,
          sale_item_id: saleItem.id,
          product_id: saleItem.product_id,
          variant_id: saleItem.variant_id || null,
          lot_id: saleItem.lot_id || null,
          qty: returnQty,
          unit_price_bs: unitPriceBs,
          unit_price_usd: unitPriceUsd,
          discount_bs: roundTwo(lineDiscountBs),
          discount_usd: roundTwo(lineDiscountUsd),
          total_bs: roundTwo(lineTotalBs),
          total_usd: roundTwo(lineTotalUsd),
          serial_ids: serialsForItem.map((s) => s.id),
          note: null,
        });

        returnItemsList.push(returnItem);
      }

      // If no items were eligible (all already returned), we might want to throw or just proceed
      if (returnItemsList.length === 0) {
        throw new BadRequestException(
          'No hay items disponibles para devolver en esta venta',
        );
      }

      // 6. Update Sale Totals
      const totals = sale.totals || {
        subtotal_bs: 0,
        subtotal_usd: 0,
        discount_bs: 0,
        discount_usd: 0,
        total_bs: 0,
        total_usd: 0,
      };

      const updatedSubtotalBs = Math.max(
        0,
        roundTwo(Number(totals.subtotal_bs || 0) - roundTwo(returnSubtotalBs)),
      );
      const updatedSubtotalUsd = Math.max(
        0,
        roundTwo(
          Number(totals.subtotal_usd || 0) - roundTwo(returnSubtotalUsd),
        ),
      );
      const updatedDiscountBs = Math.max(
        0,
        roundTwo(Number(totals.discount_bs || 0) - roundTwo(returnDiscountBs)),
      );
      const updatedDiscountUsd = Math.max(
        0,
        roundTwo(
          Number(totals.discount_usd || 0) - roundTwo(returnDiscountUsd),
        ),
      );
      const updatedTotalBs = Math.max(
        0,
        roundTwo(updatedSubtotalBs - updatedDiscountBs),
      );
      const updatedTotalUsd = Math.max(
        0,
        roundTwo(updatedSubtotalUsd - updatedDiscountUsd),
      );

      sale.totals = {
        ...totals,
        subtotal_bs: updatedSubtotalBs,
        subtotal_usd: updatedSubtotalUsd,
        discount_bs: updatedDiscountBs,
        discount_usd: updatedDiscountUsd,
        total_bs: updatedTotalBs,
        total_usd: updatedTotalUsd,
      };
      await manager.save(Sale, sale);

      // 7. Update Debt
      if (debt) {
        debt.amount_bs = updatedTotalBs;
        debt.amount_usd = updatedTotalUsd;
        debt.status = updatedTotalUsd <= 0 ? DebtStatus.PAID : DebtStatus.OPEN;
        await manager.save(Debt, debt);
      }

      // 8. Create Sale Return Header
      const saleReturn = manager.create(SaleReturn, {
        id: returnId,
        store_id: storeId,
        sale_id: saleId,
        created_by: userId,
        reason: reason || null,
        total_bs: roundTwo(returnTotalBs),
        total_usd: roundTwo(returnTotalUsd),
      });

      const savedReturn = await manager.save(SaleReturn, saleReturn);
      await manager.save(SaleReturnItem, returnItemsList);
      savedReturn.items = returnItemsList;

      this.logger.log(
        `[FULL_RETURN] ✅ Venta ${saleId} devuelta totalmente. ReturnId: ${returnId}`,
      );

      return savedReturn;
    });
  }
}
