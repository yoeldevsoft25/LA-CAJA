import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateLegacyDebtDto {
  @IsNotEmpty()
  customer_id: string;

  @IsNumber()
  @Min(0.01)
  amount_usd: number;

  @IsString()
  @IsOptional()
  note?: string;

  @IsDateString()
  @IsOptional()
  created_at?: string; // Para ponerle la fecha original de cuando se fió
}
