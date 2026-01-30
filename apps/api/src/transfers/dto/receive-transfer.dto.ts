import {
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiveTransferItemDto {
  @IsString()
  product_id: string;

  @IsInt()
  @Min(0)
  quantity_received: number;
}

export class ReceiveTransferDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveTransferItemDto)
  items: ReceiveTransferItemDto[];

  @IsOptional()
  @IsString()
  note?: string;
}
