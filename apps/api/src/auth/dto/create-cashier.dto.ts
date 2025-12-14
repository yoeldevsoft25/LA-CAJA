import { IsUUID, IsString, IsNotEmpty, MinLength, Length } from 'class-validator';

export class CreateCashierDto {
  @IsUUID()
  store_id: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  full_name: string;

  @IsString()
  @Length(4, 6)
  pin: string;
}

