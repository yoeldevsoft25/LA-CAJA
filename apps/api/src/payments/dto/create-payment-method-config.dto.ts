import {
  IsString,
  IsIn,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  Max,
  IsInt,
} from 'class-validator';

export type PaymentMethod =
  | 'CASH_BS'
  | 'CASH_USD'
  | 'PAGO_MOVIL'
  | 'TRANSFER'
  | 'POINT_OF_SALE'
  | 'ZELLE'
  | 'FIAO'
  | 'OTHER';

/**
 * DTO para crear o actualizar configuración de método de pago
 */
export class CreatePaymentMethodConfigDto {
  @IsString()
  @IsIn([
    'CASH_BS',
    'CASH_USD',
    'PAGO_MOVIL',
    'TRANSFER',
    'POINT_OF_SALE',
    'ZELLE',
    'FIAO',
    'OTHER',
  ])
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

  @IsInt()
  @Min(0)
  @IsOptional()
  sort_order?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  @IsOptional()
  commission_percentage?: number | null;
}
