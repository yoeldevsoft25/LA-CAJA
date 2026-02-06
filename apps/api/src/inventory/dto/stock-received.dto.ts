import {
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  IsObject,
  Min,
} from 'class-validator';

export class StockReceivedDto {
  @IsUUID()
  product_id: string;

  @IsNumber()
  @Min(0.001)
  qty: number;

  @IsNumber()
  @Min(0)
  unit_cost_bs: number;

  @IsNumber()
  @Min(0)
  unit_cost_usd: number;

  @IsUUID()
  @IsOptional()
  warehouse_id?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsObject()
  @IsOptional()
  ref?: Record<string, any>;

  @IsString()
  @IsOptional()
  request_id?: string;
}
