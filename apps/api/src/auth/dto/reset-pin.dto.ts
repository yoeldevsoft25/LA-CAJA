import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class ResetPinDto {
  @IsString()
  @IsNotEmpty({ message: 'El token es requerido' })
  token: string;

  @IsString()
  @IsNotEmpty({ message: 'El nuevo PIN es requerido' })
  @Length(6, 8, { message: 'El PIN debe tener entre 6 y 8 caracteres' })
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'El PIN solo puede contener letras y números',
  })
  new_pin: string;
}
