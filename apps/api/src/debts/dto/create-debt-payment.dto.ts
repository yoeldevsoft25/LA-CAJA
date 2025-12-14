import { IsNumber, IsString, IsIn, Min, IsOptional, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateDebtPaymentDto {
  @Transform(({ value }) => {
    if (value === null || value === undefined) return 0;
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? 0 : num;
  })
  @IsNumber({}, { message: 'amount_bs debe ser un número' })
  @Min(0, { message: 'amount_bs debe ser mayor o igual a 0' })
  amount_bs: number;

  @Transform(({ value }) => {
    if (value === null || value === undefined) return 0;
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? 0 : num;
  })
  @IsNumber({}, { message: 'amount_usd debe ser un número' })
  @Min(0, { message: 'amount_usd debe ser mayor o igual a 0' })
  amount_usd: number;

  @IsString({ message: 'method debe ser una cadena de texto' })
  @IsIn(['CASH_BS', 'CASH_USD', 'PAGO_MOVIL', 'TRANSFER', 'OTHER'], {
    message: 'method debe ser uno de: CASH_BS, CASH_USD, PAGO_MOVIL, TRANSFER, OTHER',
  })
  method: string;

  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return null;
    return String(value);
  })
  @IsOptional()
  @IsString({ message: 'note debe ser una cadena de texto' })
  note?: string | null;
}

