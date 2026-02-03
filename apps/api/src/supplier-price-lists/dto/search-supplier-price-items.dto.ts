import {
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  IsInt,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchSupplierPriceItemsDto {
  @IsUUID()
  @IsOptional()
  supplier_id?: string;

  @IsUUID()
  @IsOptional()
  list_id?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  search?: string;

  @Transform(({ value }) =>
    value !== undefined ? parseInt(value, 10) : undefined,
  )
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @Transform(({ value }) =>
    value !== undefined ? parseInt(value, 10) : undefined,
  )
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number;
}
