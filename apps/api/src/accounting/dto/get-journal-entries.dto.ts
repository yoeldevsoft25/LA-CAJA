import { IsOptional, IsEnum, IsDateString, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { JournalEntryType } from './create-journal-entry.dto';

export enum JournalEntryStatus {
  DRAFT = 'draft',
  POSTED = 'posted',
  CANCELLED = 'cancelled',
}

export class GetJournalEntriesDto {
  @IsOptional()
  @IsEnum(JournalEntryType)
  entry_type?: JournalEntryType;

  @IsOptional()
  @IsEnum(JournalEntryStatus)
  status?: JournalEntryStatus;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsString()
  source_type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}


