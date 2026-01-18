import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { VerificationMethod } from '../../database/entities/license-payment-verification.entity';

export class VerifyPaymentDto {
  @IsOptional()
  @IsEnum(VerificationMethod)
  method?: VerificationMethod; // Si no se especifica, se usa manual

  @IsOptional()
  @IsBoolean()
  auto_verify?: boolean; // Si true, intenta verificación automática

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
