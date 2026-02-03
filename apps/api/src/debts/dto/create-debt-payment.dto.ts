import {
  IsNumber,
  IsString,
  IsIn,
  Min,
  IsOptional,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  IsUUID,
} from 'class-validator';
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
    message:
      'method debe ser uno de: CASH_BS, CASH_USD, PAGO_MOVIL, TRANSFER, OTHER',
  })
  method: string;

  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return null;
    return String(value);
  })
  @IsOptional()
  @IsString({ message: 'note debe ser una cadena de texto' })
  note?: string | null;

  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return Boolean(value);
  })
  @IsOptional()
  @IsBoolean({ message: 'rollover_remaining debe ser booleano' })
  rollover_remaining?: boolean;

  @IsOptional()
  @IsArray({ message: 'debt_ids debe ser un arreglo' })
  @ArrayMinSize(1, { message: 'debt_ids debe tener al menos un elemento' })
  @IsUUID('4', { each: true, message: 'debt_ids debe contener UUIDs válidos' })
  debt_ids?: string[];

  @IsOptional()
  @IsIn(['SEQUENTIAL', 'PROPORTIONAL'], {
    message: 'distribution debe ser SEQUENTIAL o PROPORTIONAL',
  })
  distribution?: string;
}
