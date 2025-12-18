import { IsOptional, IsDateString } from 'class-validator';

export class GetBalanceSheetDto {
  @IsOptional()
  @IsDateString()
  as_of_date?: string; // Fecha de corte (default: hoy)
}

