import { IsOptional, IsDateString, IsArray, IsUUID } from 'class-validator';

export class ValidateAccountingDto {
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}

export class ReconcileAccountsDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  account_ids?: string[];

  @IsOptional()
  @IsDateString()
  as_of_date?: string;
}
