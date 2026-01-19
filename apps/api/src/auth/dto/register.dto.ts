import {
  IsString,
  IsNotEmpty,
  MinLength,
  Length,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'El nombre de la tienda debe tener al menos 2 caracteres' })
  store_name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'El nombre del dueño debe tener al menos 2 caracteres' })
  owner_name: string;

  @IsString()
  @IsNotEmpty()
  @Length(4, 6, { message: 'El PIN del administrador debe tener entre 4 y 6 dígitos' })
  @Matches(/^\d+$/, { message: 'El PIN solo puede contener números' })
  owner_pin: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'El nombre del cajero debe tener al menos 2 caracteres' })
  cashier_name: string;

  @IsString()
  @IsNotEmpty()
  @Length(4, 6, { message: 'El PIN del cajero debe tener entre 4 y 6 dígitos' })
  @Matches(/^\d+$/, { message: 'El PIN solo puede contener números' })
  cashier_pin: string;
}
