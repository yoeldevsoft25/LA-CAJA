import { IsUUID, IsNumber, IsString, IsOptional, IsIn } from 'class-validator';

export class StockAdjustedDto {
  @IsUUID()
  product_id: string;

  @IsNumber()
  qty_delta: number; // Puede ser positivo o negativo

  @IsString()
  @IsIn(['loss', 'damage', 'count', 'other'])
  reason: 'loss' | 'damage' | 'count' | 'other';

  @IsString()
  @IsOptional()
  note?: string;
}

