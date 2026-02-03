import { IsDateString, IsOptional, IsIn } from 'class-validator';

export class GetCashFlowDto {
  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsOptional()
  @IsIn(['direct', 'indirect'], {
    message: 'method must be either "direct" or "indirect"',
  })
  method?: 'direct' | 'indirect'; // Método directo o indirecto (default: indirect)
}
