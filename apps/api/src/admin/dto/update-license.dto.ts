import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

const LICENSE_STATUSES = ['active', 'suspended', 'expired', 'trial'] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export class UpdateLicenseDto {
  @IsOptional()
  @IsIn(LICENSE_STATUSES as any)
  status?: LicenseStatus;

  @IsOptional()
  @IsDateString()
  expires_at?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  grace_days?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  plan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateTrialDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  days?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  grace_days?: number;
}
