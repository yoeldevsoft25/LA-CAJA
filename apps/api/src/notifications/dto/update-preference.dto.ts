import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  IsObject,
  Matches,
} from 'class-validator';

export class UpdatePreferenceDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channels?: string[];

  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'quiet_hours_start debe estar en formato HH:MM',
  })
  quiet_hours_start?: string;

  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'quiet_hours_end debe estar en formato HH:MM',
  })
  quiet_hours_end?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

