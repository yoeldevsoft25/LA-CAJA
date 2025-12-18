import {
  IsEnum,
  IsDateString,
  IsOptional,
  IsArray,
  IsString,
} from 'class-validator';

export enum AccountingExportType {
  CSV = 'csv',
  EXCEL = 'excel',
  JSON = 'json',
  VIOTECH_SYNC = 'viotech_sync',
}

export enum AccountingStandard {
  IFRS = 'IFRS',
  NIIF = 'NIIF',
  LOCAL = 'local',
}

export class ExportAccountingDto {
  @IsEnum(AccountingExportType)
  export_type: AccountingExportType;

  @IsOptional()
  @IsEnum(AccountingStandard)
  format_standard?: AccountingStandard;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entry_types?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  account_codes?: string[];
}

