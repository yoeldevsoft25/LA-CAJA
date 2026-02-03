import { IsOptional, IsDateString } from 'class-validator';

export class GetTrialBalanceDto {
  @IsOptional()
  @IsDateString()
  as_of_date?: string; // Fecha de corte (default: hoy)

  @IsOptional()
  include_zero_balance?: boolean; // Incluir cuentas con saldo cero (default: false)
}
