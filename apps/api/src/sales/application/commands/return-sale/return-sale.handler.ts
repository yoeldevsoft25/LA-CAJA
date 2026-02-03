import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource, EntityManager } from 'typeorm';
import { BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ReturnSaleCommand } from './return-sale.command';
import { Sale } from '../../../../database/entities/sale.entity';
import { SaleItem } from '../../../../database/entities/sale-item.entity';
import { SaleReturn } from '../../../../database/entities/sale-return.entity';
import { SaleReturnItem } from '../../../../database/entities/sale-return-item.entity';
import { ProductSerial } from '../../../../database/entities/product-serial.entity';
import { SalesReturnDomainService, ReturnItemInput } from '../../../domain/services/sales-return-domain.service';

@CommandHandler(ReturnSaleCommand)
export class ReturnSaleHandler implements ICommandHandler<ReturnSaleCommand> {
  private readonly logger = new Logger(ReturnSaleHandler.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly salesReturnDomainService: SalesReturnDomainService,
  ) { }

  async execute(command: ReturnSaleCommand): Promise<SaleReturn> {
    const { storeId, saleId, userId, reason } = command;

    return this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. Fetch sale with items
      const sale = await manager.findOne(Sale, {
        where: { id: saleId, store_id: storeId },
        relations: ['items'],
      });

      if (!sale) {
        throw new NotFoundException('Venta no encontrada');
      }

      // 2. Identify items to return (All items not yet returned)
      const saleItems =
        sale.items?.length > 0
          ? sale.items
          : await manager.find(SaleItem, { where: { sale_id: saleId } });

      const saleItemIds = saleItems.map((item) => item.id);

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

      const itemsToReturn: ReturnItemInput[] = [];

      for (const saleItem of saleItems) {
        const alreadyReturned = returnedQtyByItem.get(saleItem.id) || 0;
        const returnQty = Number(saleItem.qty) - alreadyReturned;

        if (returnQty <= 0.0001) continue;

        // For serials, we need to find the currently sold ones
        const serialsForItem = await manager.find(ProductSerial, {
          where: { sale_item_id: saleItem.id, status: 'sold' },
        });

        itemsToReturn.push({
          sale_item_id: saleItem.id,
          qty: returnQty,
          serial_ids: serialsForItem.map(s => s.id),
        });
      }

      if (itemsToReturn.length === 0) {
        throw new BadRequestException('No hay items disponibles para devolver en esta venta');
      }

      // 3. Delegate to Domain Service
      const result = await this.salesReturnDomainService.processReturn(
        manager,
        storeId,
        saleId,
        userId,
        itemsToReturn,
        reason || `Devolución total ${saleId}`,
      );

      this.logger.log(`[FULL_RETURN] ✅ Venta ${saleId} devuelta totalmente a través del dominio.`);

      return result;
    });
  }
}
