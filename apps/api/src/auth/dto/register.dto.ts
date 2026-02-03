import {
  IsString,
  IsNotEmpty,
  MinLength,
  Length,
  Matches,
  IsEmail,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2, {
    message: 'El nombre de la tienda debe tener al menos 2 caracteres',
  })
  store_name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2, {
    message: 'El nombre del dueño debe tener al menos 2 caracteres',
  })
  owner_name: string;

  @IsEmail({}, { message: 'El email debe ser válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  owner_email: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 8, {
    message: 'El PIN del administrador debe tener entre 6 y 8 caracteres',
  })
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'El PIN solo puede contener letras y números',
  })
  owner_pin: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2, {
    message: 'El nombre del cajero debe tener al menos 2 caracteres',
  })
  cashier_name: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 8, {
    message: 'El PIN del cajero debe tener entre 6 y 8 caracteres',
  })
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'El PIN solo puede contener letras y números',
  })
  cashier_pin: string;
}
