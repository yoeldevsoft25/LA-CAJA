import { IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReconcileItemDto {
  @IsString()
  product_id: string;

  @IsNumber()
  quantity: number; // The physical count

  @IsString()
  counted_at: string; // ISO Date of the count
}

export class ReconcileStockDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReconcileItemDto)
  items: ReconcileItemDto[];
}
