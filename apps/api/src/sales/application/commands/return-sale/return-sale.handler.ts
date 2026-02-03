import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource, EntityManager } from 'typeorm';
import { BadRequestException, Logger } from '@nestjs/common';
import { ReturnSaleCommand } from './return-sale.command';
import { SaleReturn } from '../../../../database/entities/sale-return.entity';
import { SalesReturnDomainService } from '../../../domain/services/sales-return-domain.service';

@CommandHandler(ReturnSaleCommand)
export class ReturnSaleHandler implements ICommandHandler<ReturnSaleCommand> {
  private readonly logger = new Logger(ReturnSaleHandler.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly salesReturnDomainService: SalesReturnDomainService,
  ) {}

  async execute(command: ReturnSaleCommand): Promise<SaleReturn> {
    const { storeId, saleId, userId, reason } = command;

    return this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. Build the list of items for a full return
      const itemsToReturn =
        await this.salesReturnDomainService.buildFullReturnItems(
          manager,
          storeId,
          saleId,
        );

      if (itemsToReturn.length === 0) {
        throw new BadRequestException(
          'No hay items disponibles para devolver en esta venta',
        );
      }

      // 2. Delegate the return process to the domain service
      const result = await this.salesReturnDomainService.processReturn(
        manager,
        storeId,
        saleId,
        userId,
        itemsToReturn,
        reason || `Devolución total ${saleId}`,
      );

      this.logger.log(`[FULL_RETURN] ✅ Venta ${saleId} devuelta totalmente.`);

      return result;
    });
  }
}
