import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateWhatsAppConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^58\d{10}$/, {
    message:
      'El número de WhatsApp debe estar en formato internacional (ej: 584121234567)',
  })
  whatsapp_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  thank_you_message?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  debt_notifications_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  debt_reminders_enabled?: boolean;
}
