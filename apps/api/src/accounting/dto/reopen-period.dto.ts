import { IsString, MinLength } from 'class-validator';

export class ReopenPeriodDto {
  @IsString()
  @MinLength(5, { message: 'La razón debe tener al menos 5 caracteres' })
  reason: string;
}
