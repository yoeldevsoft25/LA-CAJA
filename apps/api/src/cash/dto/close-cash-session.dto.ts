import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class CloseCashSessionDto {
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto en Bs debe tener máximo 2 decimales' },
  )
  @Min(0, { message: 'El monto en Bs no puede ser negativo' })
  @Max(999999999.99, {
    message: 'El monto en Bs excede el límite máximo permitido',
  })
  counted_bs: number;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto en USD debe tener máximo 2 decimales' },
  )
  @Min(0, { message: 'El monto en USD no puede ser negativo' })
  @Max(999999999.99, {
    message: 'El monto en USD excede el límite máximo permitido',
  })
  counted_usd: number;

  @IsString()
  @IsOptional()
  note?: string;
}
