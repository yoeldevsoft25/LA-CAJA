import { IsUUID, IsString, Length } from 'class-validator';

export class LoginDto {
  @IsUUID()
  store_id: string;

  @IsString()
  @Length(4, 6)
  pin: string;
}

