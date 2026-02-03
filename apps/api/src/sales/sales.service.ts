import { Injectable, Logger } from '@nestjs/common';
import { Sale } from '../database/entities/sale.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ReturnSaleDto } from './dto/return-sale.dto';
import { GetSalesListQuery } from './application/queries/get-sales-list/get-sales-list.query';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import { GetSaleByIdQuery } from './application/queries/get-sale-by-id/get-sale-by-id.query';
import { CreateSaleCommand } from './application/commands/create-sale/create-sale.command';
import { VoidSaleCommand } from './application/commands/void-sale/void-sale.command';
import { ReturnItemsCommand } from './application/commands/return-items/return-items.command';
import { ReturnSaleCommand } from './application/commands/return-sale/return-sale.command';
import { SaleReturn } from '../database/entities/sale-return.entity';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  async create(
    storeId: string,
    dto: CreateSaleDto,
    userId?: string,
    userRole?: string,
    returnMode: 'full' | 'minimal' = 'full',
  ): Promise<Sale> {
    const command = new CreateSaleCommand(
      storeId,
      dto,
      userId || '',
      userRole || '',
      returnMode,
    );
    return this.commandBus.execute(command);
  }

  async findOne(storeId: string, saleId: string): Promise<Sale> {
    return this.queryBus.execute(new GetSaleByIdQuery(storeId, saleId));
  }

  async findAll(
    storeId: string,
    limit: number = 50,
    offset: number = 0,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<{ sales: Sale[]; total: number }> {
    return this.queryBus.execute(
      new GetSalesListQuery(storeId, limit, offset, dateFrom, dateTo),
    );
  }

  async voidSale(
    storeId: string,
    saleId: string,
    userId: string,
    reason?: string,
  ): Promise<Sale> {
    return this.commandBus.execute(
      new VoidSaleCommand(storeId, saleId, userId, reason),
    );
  }

  async returnItems(
    storeId: string,
    saleId: string,
    dto: ReturnSaleDto,
    userId: string,
  ): Promise<SaleReturn> {
    return this.commandBus.execute(
      new ReturnItemsCommand(storeId, saleId, userId, dto),
    );
  }

  async returnSale(
    storeId: string,
    saleId: string,
    userId: string,
    reason?: string,
  ): Promise<SaleReturn> {
    return this.commandBus.execute(
      new ReturnSaleCommand(storeId, saleId, userId, reason),
    );
  }
}
