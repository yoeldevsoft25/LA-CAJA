import {
  IsArray,
  ValidateNested,
  IsUUID,
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTransferItemDto {
  @IsUUID()
  product_id: string;

  @IsOptional()
  @IsUUID()
  variant_id?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber()
  unit_cost_bs?: number;

  @IsOptional()
  @IsNumber()
  unit_cost_usd?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateTransferDto {
  @IsUUID()
  from_warehouse_id: string;

  @IsUUID()
  to_warehouse_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransferItemDto)
  items: CreateTransferItemDto[];

  @IsOptional()
  @IsString()
  note?: string;
}
