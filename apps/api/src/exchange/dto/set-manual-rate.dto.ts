import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SetManualRateDto {
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  rate: number;

  @IsOptional()
  @IsDateString()
  effective_from?: string;

  @IsOptional()
  @IsDateString()
  effective_until?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
