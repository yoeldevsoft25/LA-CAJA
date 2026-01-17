import {
  IsString,
  IsOptional,
  IsEmail,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCustomerDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  document_id?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  /**
   * Maximum credit limit for FIAO purchases in USD.
   * NULL or undefined means no credit allowed.
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Transform(({ value }) => (value === '' ? null : Number(value)))
  credit_limit?: number | null;

  @IsString()
  @IsOptional()
  note?: string;
}
