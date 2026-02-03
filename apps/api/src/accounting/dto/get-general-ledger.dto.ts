import { IsOptional, IsDateString, IsArray } from 'class-validator';

export class GetGeneralLedgerDto {
  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsOptional()
  @IsArray()
  account_ids?: string[]; // Opcional: filtrar por cuentas específicas
}
