import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource, EntityManager } from 'typeorm';
import { BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { VoidSaleCommand } from './void-sale.command';
import { Sale } from '../../../../database/entities/sale.entity';
import { FiscalInvoice } from '../../../../database/entities/fiscal-invoice.entity';
import { Debt } from '../../../../database/entities/debt.entity';
import { DebtPayment } from '../../../../database/entities/debt-payment.entity';
import { SaleItem } from '../../../../database/entities/sale-item.entity';
import { InventoryMovement } from '../../../../database/entities/inventory-movement.entity';
import { ProductLot } from '../../../../database/entities/product-lot.entity';
import { LotMovement } from '../../../../database/entities/lot-movement.entity';
import { ProductSerial } from '../../../../database/entities/product-serial.entity';
import { WarehousesService } from '../../../../warehouses/warehouses.service';
import { randomUUID } from 'crypto';

@CommandHandler(VoidSaleCommand)
export class VoidSaleHandler implements ICommandHandler<VoidSaleCommand> {
  private readonly logger = new Logger(VoidSaleHandler.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly warehousesService: WarehousesService,
  ) {}

  async execute(command: VoidSaleCommand): Promise<Sale> {
    const { storeId, saleId, userId, reason } = command;

    return this.dataSource.transaction(async (manager: EntityManager) => {
      const sale = await manager.findOne(Sale, {
        where: { id: saleId, store_id: storeId },
        relations: ['items'],
      });

      if (!sale) {
        throw new NotFoundException('Venta no encontrada');
      }

      if (sale.voided_at) {
        throw new BadRequestException('La venta ya fue anulada');
      }

      // Verificar facturas fiscales asociadas a la venta
      const fiscalInvoices = await manager.find(FiscalInvoice, {
        where: { sale_id: saleId, store_id: storeId },
      });

      // Buscar si hay una factura emitida (no nota de crédito)
      const issuedInvoice = fiscalInvoices.find(
        (inv) => inv.invoice_type === 'invoice' && inv.status === 'issued',
      );

      if (issuedInvoice) {
        // Si hay factura emitida, verificar si existe una nota de crédito emitida que la anule
        const issuedCreditNote = fiscalInvoices.find(
          (inv) =>
            inv.invoice_type === 'credit_note' && inv.status === 'issued',
        );

        if (!issuedCreditNote) {
          throw new BadRequestException(
            'La venta tiene una factura fiscal emitida. Debe crear y emitir una nota de crédito antes de anular la venta.',
          );
        }
      }

      const debt = await manager.findOne(Debt, {
        where: { sale_id: saleId, store_id: storeId },
      });
      if (debt) {
        const paymentsCount = await manager.count(DebtPayment, {
          where: { debt_id: debt.id },
        });
        if (paymentsCount > 0) {
          throw new BadRequestException(
            'La venta tiene pagos asociados. Debes reversar los pagos antes de anular.',
          );
        }
        await manager.delete(DebtPayment, { debt_id: debt.id });
        await manager.delete(Debt, { id: debt.id });
      }

      const saleItems =
        sale.items?.length > 0
          ? sale.items
          : await manager.find(SaleItem, { where: { sale_id: saleId } });

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

      const now = new Date();
      const reasonNote = reason
        ? `Devolución venta ${saleId}: ${reason}`
        : `Devolución venta ${saleId}`;

      for (const item of saleItems) {
        if (item.lot_id) {
          const lot = await manager.findOne(ProductLot, {
            where: { id: item.lot_id },
          });
          if (lot) {
            lot.remaining_quantity =
              Number(lot.remaining_quantity) + Number(item.qty);
            lot.updated_at = now;
            await manager.save(ProductLot, lot);

            const lotMovement = manager.create(LotMovement, {
              id: randomUUID(),
              lot_id: lot.id,
              movement_type: 'adjusted',
              qty_delta: item.qty,
              happened_at: now,
              sale_id: saleId,
              note: reasonNote,
            });
            await manager.save(LotMovement, lotMovement);
          }
        }

        const key = `${item.product_id}:${item.variant_id || 'null'}`;
        const warehouseId = warehouseByItemKey.get(key) || null;

        const movement = manager.create(InventoryMovement, {
          id: randomUUID(),
          store_id: storeId,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          movement_type: 'adjust',
          qty_delta: item.qty,
          unit_cost_bs: 0,
          unit_cost_usd: 0,
          warehouse_id: warehouseId,
          note: reasonNote,
          ref: { sale_id: saleId, reversal: true, warehouse_id: warehouseId },
          happened_at: now,
          approved: true,
        });
        await manager.save(InventoryMovement, movement);

        if (warehouseId) {
          await this.warehousesService.updateStock(
            warehouseId,
            item.product_id,
            item.variant_id || null,
            item.qty,
            storeId,
          );
        }
      }

      await manager.getRepository(ProductSerial).update(
        { sale_id: saleId },
        {
          status: 'returned',
          sale_id: null,
          sale_item_id: null,
          sold_at: null,
          updated_at: now,
        },
      );

      sale.voided_at = now;
      sale.voided_by_user_id = userId;
      sale.void_reason = reason || null;

      return manager.save(Sale, sale);
    });
  }
}
