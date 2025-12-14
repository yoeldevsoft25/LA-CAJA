import { IsUUID, IsArray, IsString, ValidateNested, IsNumber, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

class EventActorDto {
  @IsUUID()
  user_id: string;

  @IsString()
  role: 'owner' | 'cashier';
}

class EventDto {
  @IsUUID()
  event_id: string;

  @IsNumber()
  seq: number;

  @IsString()
  type: string;

  @IsNumber()
  version: number;

  @IsNumber()
  created_at: number;

  @ValidateNested()
  @Type(() => EventActorDto)
  actor: EventActorDto;

  @IsObject()
  payload: Record<string, any>;
}

export class PushSyncDto {
  @IsUUID()
  store_id: string;

  @IsUUID()
  device_id: string;

  @IsString()
  client_version: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventDto)
  events: EventDto[];
}

export class AcceptedEventDto {
  event_id: string;
  seq: number;
}

export class RejectedEventDto {
  event_id: string;
  seq: number;
  code: string;
  message: string;
}

export class PushSyncResponseDto {
  accepted: AcceptedEventDto[];
  rejected: RejectedEventDto[];
  server_time: number;
  last_processed_seq: number;
}


