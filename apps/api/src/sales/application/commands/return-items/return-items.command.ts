import { ReturnSaleDto } from '../../../dto/return-sale.dto';

export class ReturnItemsCommand {
  constructor(
    public readonly storeId: string,
    public readonly saleId: string,
    public readonly userId: string,
    public readonly dto: ReturnSaleDto,
  ) {}
}
