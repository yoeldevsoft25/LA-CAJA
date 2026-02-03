import {
  IsString,
  Length,
  IsNotEmpty,
  MinLength,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  store_id: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(4) // Compatibilidad con PINs antiguos (4-6)
  @MaxLength(8) // Soporte para PINs nuevos (6-8)
  pin: string;
}
