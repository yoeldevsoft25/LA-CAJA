import {
  IsNumber,
  IsOptional,
  IsBoolean,
  IsString,
  IsIn,
  Min,
  Max,
} from 'class-validator';

export type AuthorizationRole = 'owner' | 'admin' | 'supervisor' | 'cashier';

/**
 * DTO para crear o actualizar configuración de descuentos
 */
export class CreateDiscountConfigDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  @IsOptional()
  max_percentage?: number;

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
  requires_authorization?: boolean;

  @IsString()
  @IsIn(['owner', 'admin', 'supervisor', 'cashier'])
  @IsOptional()
  authorization_role?: AuthorizationRole | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  @IsOptional()
  auto_approve_below_percentage?: number | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  auto_approve_below_amount_bs?: number | null;
}
