import { IsNotEmpty, IsNumber, IsOptional, IsString, IsEnum, Min, IsUUID } from 'class-validator';

export enum CashMovementTypeDto {
    INCOME = 'income',
    EXPENSE = 'expense',
}

export class RegisterCashMovementDto {
    @IsNotEmpty()
    @IsEnum(CashMovementTypeDto)
    type: CashMovementTypeDto;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    amount: number;

    @IsNotEmpty()
    @IsString()
    currency: 'BS' | 'USD';

    @IsNotEmpty()
    @IsString()
    reason: string;

    @IsOptional()
    @IsString()
    reference?: string;

    @IsOptional()
    @IsString()
    category?: string;

    @IsOptional()
    @IsUUID()
    request_id?: string;
}
