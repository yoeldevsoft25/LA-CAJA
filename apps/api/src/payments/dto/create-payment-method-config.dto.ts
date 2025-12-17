import {
  IsString,
  IsIn,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';

export type PaymentMethod =
  | 'CASH_BS'
  | 'CASH_USD'
  | 'PAGO_MOVIL'
  | 'TRANSFER'
  | 'OTHER';

/**
 * DTO para crear o actualizar configuración de método de pago
 */
export class CreatePaymentMethodConfigDto {
  @IsString()
  @IsIn(['CASH_BS', 'CASH_USD', 'PAGO_MOVIL', 'TRANSFER', 'OTHER'])
  method: PaymentMethod;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  min_amount_bs?: number | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  min_amount_usd?: number | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  max_amount_bs?: number | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  max_amount_usd?: number | null;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  requires_authorization?: boolean;
}
