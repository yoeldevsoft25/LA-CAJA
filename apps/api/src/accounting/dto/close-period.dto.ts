import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ClosePeriodDto {
  @IsDateString()
  period_start: string;

  @IsDateString()
  period_end: string;

  @IsOptional()
  @IsString()
  note?: string;
}
