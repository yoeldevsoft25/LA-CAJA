import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource, EntityManager } from 'typeorm';
import { BadRequestException, Logger } from '@nestjs/common';
import { ReturnItemsCommand } from './return-items.command';
import { SaleReturn } from '../../../../database/entities/sale-return.entity';
import {
  SalesReturnDomainService,
  ReturnItemInput,
} from '../../../domain/services/sales-return-domain.service';

@CommandHandler(ReturnItemsCommand)
export class ReturnItemsHandler implements ICommandHandler<ReturnItemsCommand> {
  private readonly logger = new Logger(ReturnItemsHandler.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly salesReturnDomainService: SalesReturnDomainService,
  ) {}

  async execute(command: ReturnItemsCommand): Promise<SaleReturn> {
    const { storeId, saleId, userId, dto } = command;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Debes especificar items a devolver');
    }

    const itemsToProcess: ReturnItemInput[] = dto.items.map((item) => ({
      sale_item_id: item.sale_item_id,
      qty: item.qty,
      serial_ids: item.serial_ids,
      note: item.note,
    }));

    return this.dataSource.transaction(async (manager: EntityManager) => {
      return this.salesReturnDomainService.processReturn(
        manager,
        storeId,
        saleId,
        userId,
        itemsToProcess,
        dto.reason,
      );
    });
  }
}
