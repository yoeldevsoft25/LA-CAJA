import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SubscribePushDto {
  @IsString()
  @IsNotEmpty()
  device_id: string;

  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @IsString()
  @IsNotEmpty()
  p256dh_key: string;

  @IsString()
  @IsNotEmpty()
  auth_key: string;

  @IsString()
  @IsOptional()
  user_agent?: string;
}
