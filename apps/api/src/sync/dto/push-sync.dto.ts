import {
  IsArray,
  IsString,
  ValidateNested,
  IsNumber,
  IsObject,
  Matches,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

// UUID permisivo (acepta placeholders v1/v4/etc.)
const RELAXED_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class EventActorDto {
  @Matches(RELAXED_UUID_REGEX, { message: 'actor.user_id must be a UUID' })
  user_id: string;

  @IsString()
  role: 'owner' | 'cashier';
}

class EventDto {
  @Matches(RELAXED_UUID_REGEX, { message: 'event_id must be a UUID' })
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

  // ===== OFFLINE-FIRST WORLD-CLASS FIELDS =====

  @IsObject()
  @IsOptional()
  vector_clock?: Record<string, number>;

  @IsArray()
  @IsOptional()
  causal_dependencies?: string[];

  @IsObject()
  @IsOptional()
  delta_payload?: Record<string, any>;

  @IsString()
  @IsOptional()
  full_payload_hash?: string;

  @IsString()
  @IsOptional()
  request_id?: string;

  @IsString()
  @IsOptional()
  causal_digest?: string;
}

export class PushSyncDto {
  @Matches(RELAXED_UUID_REGEX, { message: 'store_id must be a UUID' })
  store_id: string;

  @Matches(RELAXED_UUID_REGEX, { message: 'device_id must be a UUID' })
  device_id: string;

  @IsString()
  client_version: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventDto)
  events: EventDto[];

  @IsString()
  @IsOptional()
  causal_digest?: string;
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

export class ConflictedEventDto {
  event_id: string;
  seq: number;
  conflict_id: string;
  reason: string;
  requires_manual_review: boolean;
  conflicting_with?: string[];
}

export class PushSyncResponseDto {
  accepted: AcceptedEventDto[];
  rejected: RejectedEventDto[];
  conflicted: ConflictedEventDto[];
  server_time: number;
  last_processed_seq: number;
  server_vector_clock?: Record<string, number>;
  causal_digest?: string;
}
