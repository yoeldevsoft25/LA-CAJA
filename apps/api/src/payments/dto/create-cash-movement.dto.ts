import {
  IsString,
  IsIn,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';

/**
 * DTO para registrar entrada o salida de efectivo
 */
export class CreateCashMovementDto {
  @IsString()
  @IsIn(['entry', 'exit'])
  movement_type: 'entry' | 'exit';

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El monto en Bs no puede ser negativo' })
  amount_bs: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El monto en USD no puede ser negativo' })
  amount_usd: number;

  @IsString()
  @MaxLength(100, { message: 'La razón no puede exceder 100 caracteres' })
  reason: string;

  @IsUUID()
  @IsOptional()
  shift_id?: string | null;

  @IsUUID()
  @IsOptional()
  cash_session_id?: string | null;

  @IsString()
  @IsOptional()
  note?: string | null;
}
