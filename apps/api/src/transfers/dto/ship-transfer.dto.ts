import {
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ShipTransferItemDto {
  @IsInt()
  @Min(0)
  quantity_shipped: number;
}

export class ShipTransferDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShipTransferItemDto)
  items: ShipTransferItemDto[];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  driver_name?: string;

  @IsOptional()
  @IsString()
  vehicle_plate?: string;

  @IsOptional()
  @IsString()
  tracking_number?: string;

  @IsOptional()
  @Min(0)
  shipping_cost?: number;
}
