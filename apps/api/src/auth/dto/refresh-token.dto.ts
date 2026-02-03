import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refresh_token: string;

  @IsUUID()
  @IsOptional()
  device_id?: string;
}

export class RefreshTokenResponseDto {
  access_token: string;
  refresh_token: string;
  expires_in: number; // Tiempo de expiración del access token en segundos
}
