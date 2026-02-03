export class GetSalesListQuery {
  constructor(
    public readonly storeId: string,
    public readonly limit: number = 50,
    public readonly offset: number = 0,
    public readonly dateFrom?: Date,
    public readonly dateTo?: Date,
  ) {}
}
