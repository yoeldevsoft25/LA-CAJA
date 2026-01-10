import { IsOptional, IsString, MinLength } from 'class-validator';

export class VoidSaleDto {
  @IsString()
  @IsOptional()
  @MinLength(3)
  reason?: string;
}
