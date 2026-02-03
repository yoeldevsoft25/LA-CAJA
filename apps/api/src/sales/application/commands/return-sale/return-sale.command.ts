export class ReturnSaleCommand {
  constructor(
    public readonly storeId: string,
    public readonly saleId: string,
    public readonly userId: string,
    public readonly reason?: string,
  ) {}
}
