import { IsUUID } from 'class-validator';

export class MarkAlertReadDto {
  @IsUUID()
  alert_id: string;
}
