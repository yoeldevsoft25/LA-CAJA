import { IsNumber, Min, IsOptional, IsString, IsIn } from 'class-validator';

export class ChangePriceDto {
  @IsNumber()
  @Min(0)
  price_usd: number;

  // price_bs es opcional porque se calcula automáticamente desde price_usd
  @IsNumber()
  @Min(0)
  @IsOptional()
  price_bs?: number;

  @IsString()
  @IsOptional()
  @IsIn(['none', '0.1', '0.5', '1'])
  rounding?: 'none' | '0.1' | '0.5' | '1';
}
