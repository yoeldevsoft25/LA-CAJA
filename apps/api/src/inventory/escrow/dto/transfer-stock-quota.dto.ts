import { IsNotEmpty, IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class TransferStockQuotaDto {
    @IsNotEmpty()
    @IsUUID()
    product_id: string;

    @IsNotEmpty()
    @IsUUID()
    from_device_id: string;

    @IsNotEmpty()
    @IsUUID()
    to_device_id: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(0.001)
    qty: number;

    @IsNotEmpty()
    @IsUUID()
    request_id: string;
}
