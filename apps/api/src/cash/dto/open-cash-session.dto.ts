import { IsNumber, Min, IsOptional, IsString } from 'class-validator';

export class OpenCashSessionDto {
  @IsNumber()
  @Min(0)
  cash_bs: number;

  @IsNumber()
  @Min(0)
  cash_usd: number;

  @IsString()
  @IsOptional()
  note?: string;
}
