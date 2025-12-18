import { IsDateString, IsOptional } from 'class-validator';

export class GetIncomeStatementDto {
  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;
}

