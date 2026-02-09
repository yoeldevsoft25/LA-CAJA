import {
    IsArray,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BatchGrantStockQuotaItemDto {
    @IsNotEmpty()
    @IsUUID()
    product_id: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(0.001)
    qty: number;

    @IsOptional()
    @IsString() // ISO Date
    expires_at?: string;
}

export class BatchGrantStockQuotaDto {
    @IsNotEmpty()
    @IsUUID()
    device_id: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BatchGrantStockQuotaItemDto)
    items: BatchGrantStockQuotaItemDto[];

    @IsNotEmpty()
    @IsUUID()
    request_id: string;
}
