import { IsUUID, IsNumber, IsString, IsOptional, IsObject, Min } from 'class-validator';

export class StockReceivedDto {
  @IsUUID()
  product_id: string;

  @IsNumber()
  @Min(1)
  qty: number;

  @IsNumber()
  @Min(0)
  unit_cost_bs: number;

  @IsNumber()
  @Min(0)
  unit_cost_usd: number;

  @IsString()
  @IsOptional()
  note?: string;

  @IsObject()
  @IsOptional()
  ref?: {
    supplier?: string;
    invoice?: string;
  };
}

