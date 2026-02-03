import { CreateSaleDto } from '../../../dto/create-sale.dto';

export class CreateSaleCommand {
  constructor(
    public readonly storeId: string,
    public readonly dto: CreateSaleDto,
    public readonly userId: string,
    public readonly userRole: string,
    public readonly returnMode: 'full' | 'minimal' = 'full',
  ) {}
}
