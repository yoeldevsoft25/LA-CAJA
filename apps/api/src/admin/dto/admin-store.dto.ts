import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

const LICENSE_STATUSES = ['active', 'suspended', 'expired', 'trial'] as const;
export type AdminLicenseStatus = (typeof LICENSE_STATUSES)[number];

export class AdminCreateStoreDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsIn(LICENSE_STATUSES as any)
  status?: AdminLicenseStatus;

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
