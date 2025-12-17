import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ResolveAnomalyDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  resolution_note?: string;
}
