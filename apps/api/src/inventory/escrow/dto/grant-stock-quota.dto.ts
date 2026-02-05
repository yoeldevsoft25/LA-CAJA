import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class GrantStockQuotaDto {
    @IsNotEmpty()
    @IsUUID()
    product_id: string;

    @IsNotEmpty()
    @IsUUID()
    device_id: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(0.001)
    qty: number;

    @IsOptional()
    @IsString() // ISO Date
    expires_at?: string;

    @IsNotEmpty()
    @IsUUID()
    request_id: string;
}
