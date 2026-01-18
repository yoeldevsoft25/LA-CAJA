import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApprovePaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RejectPaymentDto {
  @IsString()
  @MaxLength(500)
  rejection_reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
