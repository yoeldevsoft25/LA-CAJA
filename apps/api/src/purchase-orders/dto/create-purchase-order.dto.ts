import {
  IsArray,
  ValidateNested,
  IsUUID,
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePurchaseOrderItemDto {
  @IsUUID()
  product_id: string;

  @IsOptional()
  @IsUUID()
  variant_id?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unit_cost_bs: number;

  @IsNumber()
  @Min(0)
  unit_cost_usd: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  supplier_id: string;

  @IsOptional()
  @IsUUID()
  warehouse_id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];

  @IsOptional()
  @IsDateString()
  expected_delivery_date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
