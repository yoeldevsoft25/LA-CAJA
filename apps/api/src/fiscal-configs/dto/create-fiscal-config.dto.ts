import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateFiscalConfigDto {
  @IsString()
  @MaxLength(50)
  tax_id: string;

  @IsString()
  @MaxLength(200)
  business_name: string;

  @IsString()
  business_address: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  business_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  business_email?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  default_tax_rate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  fiscal_authorization_number?: string;

  @IsOptional()
  @IsDateString()
  fiscal_authorization_date?: string;

  @IsOptional()
  @IsDateString()
  fiscal_authorization_expiry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  fiscal_control_system?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
