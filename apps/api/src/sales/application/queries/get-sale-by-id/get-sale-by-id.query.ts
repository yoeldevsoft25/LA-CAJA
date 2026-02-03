export class GetSaleByIdQuery {
  constructor(
    public readonly storeId: string,
    public readonly saleId: string,
  ) {}
}
