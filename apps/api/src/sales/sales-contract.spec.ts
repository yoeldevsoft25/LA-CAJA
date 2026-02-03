
import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from './sales.service';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Sale } from '../database/entities/sale.entity';
import { Debt } from '../database/entities/debt.entity';
import { DataSource } from 'typeorm';
import { PaymentRulesService } from '../payments/payment-rules.service';
import { DiscountRulesService } from '../discounts/discount-rules.service';
import { PriceListsService } from '../price-lists/price-lists.service';
import { PromotionsService } from '../promotions/promotions.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { FiscalInvoicesService } from '../fiscal-invoices/fiscal-invoices.service';
import { AccountingService } from '../accounting/accounting.service';
import { ConfigValidationService } from '../config/config-validation.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { UsageService } from '../licenses/usage.service';
import { getQueueToken } from '@nestjs/bullmq';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreateSaleCommand } from './application/commands/create-sale/create-sale.command';
import { GetSaleByIdQuery } from './application/queries/get-sale-by-id/get-sale-by-id.query';
import { GetSalesListQuery } from './application/queries/get-sales-list/get-sales-list.query';
import { VoidSaleCommand } from './application/commands/void-sale/void-sale.command';
import { ReturnItemsCommand } from './application/commands/return-items/return-items.command';
import { ReturnSaleCommand } from './application/commands/return-sale/return-sale.command';
import { ReturnSaleDto } from './dto/return-sale.dto';

import { FastCheckoutRulesService } from '../fast-checkout/fast-checkout-rules.service';
import { ProductVariantsService } from '../product-variants/product-variants.service';
import { ProductLotsService } from '../product-lots/product-lots.service';
import { InventoryRulesService } from '../product-lots/inventory-rules.service';
import { ProductSerialsService } from '../product-serials/product-serials.service';
import { InvoiceSeriesService } from '../invoice-series/invoice-series.service';
import { Customer } from '../database/entities/customer.entity';
import { DebtPayment } from '../database/entities/debt-payment.entity';
import { SaleReturn } from '../database/entities/sale-return.entity';
import { SaleReturnItem } from '../database/entities/sale-return-item.entity';
import { CashSession } from '../database/entities/cash-session.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { Product } from '../database/entities/product.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';

describe('SalesService Contract Tests', () => {
    let service: SalesService;
    let commandBus: CommandBus;
    let queryBus: QueryBus;

    const mockCommandBus = {
        execute: jest.fn(),
    };

    const mockQueryBus = {
        execute: jest.fn(),
    };

    const mockRepo = {
        find: jest.fn(),
        findOne: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SalesService,
                { provide: CommandBus, useValue: mockCommandBus },
                { provide: QueryBus, useValue: mockQueryBus },
                { provide: getRepositoryToken(Sale), useValue: mockRepo },
                { provide: getRepositoryToken(Debt), useValue: mockRepo },
                { provide: getRepositoryToken(SaleItem), useValue: mockRepo },
                { provide: getQueueToken('sales-post-processing'), useValue: { add: jest.fn() } },
                { provide: getRepositoryToken(Product), useValue: mockRepo },
                { provide: getRepositoryToken(InventoryMovement), useValue: mockRepo },
                { provide: getRepositoryToken(Customer), useValue: mockRepo },
                { provide: getRepositoryToken(DebtPayment), useValue: mockRepo },
                { provide: getRepositoryToken(SaleReturn), useValue: mockRepo },
                { provide: getRepositoryToken(SaleReturnItem), useValue: mockRepo },
                { provide: getRepositoryToken(CashSession), useValue: mockRepo },
                { provide: DataSource, useValue: {} },
                { provide: PaymentRulesService, useValue: {} },
                { provide: DiscountRulesService, useValue: {} },
                { provide: PriceListsService, useValue: {} },
                { provide: PromotionsService, useValue: {} },
                { provide: WarehousesService, useValue: {} },
                { provide: FiscalInvoicesService, useValue: {} },
                { provide: AccountingService, useValue: {} },
                { provide: ConfigValidationService, useValue: {} },
                { provide: SecurityAuditService, useValue: {} },
                { provide: UsageService, useValue: {} },
                { provide: FastCheckoutRulesService, useValue: {} },
                { provide: ProductVariantsService, useValue: {} },
                { provide: ProductLotsService, useValue: {} },
                { provide: InventoryRulesService, useValue: {} },
                { provide: ProductSerialsService, useValue: {} },
                { provide: InvoiceSeriesService, useValue: {} },
            ],
        }).compile();

        service = module.get<SalesService>(SalesService);
        commandBus = module.get<CommandBus>(CommandBus);
        queryBus = module.get<QueryBus>(QueryBus);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should dispatch CreateSaleCommand with correct returnMode', async () => {
            const storeId = 'store-1';
            const dto = {
                items: [],
                payment: { method: 'CASH' },
                sold_at: new Date(),
            } as unknown as CreateSaleDto;
            const userId = 'user-1';
            const userRole = 'cashier';

            mockCommandBus.execute.mockResolvedValue({ id: 'sale-1' });

            const result = await service.create(storeId, dto, userId, userRole, 'minimal');

            expect(commandBus.execute).toHaveBeenCalledTimes(1);
            expect(commandBus.execute).toHaveBeenCalledWith(
                expect.any(CreateSaleCommand)
            );

            const command = (commandBus.execute as jest.Mock).mock.calls[0][0] as CreateSaleCommand;
            expect(command.storeId).toBe(storeId);
            expect(command.dto).toBe(dto);
            expect(command.userId).toBe(userId);
            expect(command.userRole).toBe(userRole);
            expect(command.returnMode).toBe('minimal');

            expect(result).toEqual({ id: 'sale-1' });
        });

        it('should default returnMode to full if not provided', async () => {
            const storeId = 'store-1';
            const dto = { items: [], payment_method: 'CASH' } as unknown as CreateSaleDto;
            const userId = 'user-1';

            mockCommandBus.execute.mockResolvedValue({ id: 'sale-1' });

            await service.create(storeId, dto, userId);

            const command = (commandBus.execute as jest.Mock).mock.calls[0][0] as CreateSaleCommand;
            expect(command.returnMode).toBe('full');
        });

        it('should propagate error from command bus', async () => {
            const storeId = 'store-error';
            const dto = { items: [], payment_method: 'CASH' } as unknown as CreateSaleDto;
            const userId = 'user-error';

            mockCommandBus.execute.mockRejectedValue(new Error('Validation failed'));

            await expect(service.create(storeId, dto, userId)).rejects.toThrow('Validation failed');
        });
    });

    describe('findOne', () => {
        it('should dispatch GetSaleByIdQuery', async () => {
            const storeId = 'store-2';
            const saleId = 'sale-2';

            mockQueryBus.execute.mockResolvedValue({ id: saleId });

            const result = await service.findOne(storeId, saleId);

            expect(queryBus.execute).toHaveBeenCalledTimes(1);
            expect(queryBus.execute).toHaveBeenCalledWith(
                expect.any(GetSaleByIdQuery)
            );

            const query = (queryBus.execute as jest.Mock).mock.calls[0][0] as GetSaleByIdQuery;
            expect(query.storeId).toBe(storeId);
            expect(query.saleId).toBe(saleId);

            expect(result).toEqual({ id: saleId });
        });
    });

    describe('findAll', () => {
        it('should dispatch GetSalesListQuery with correct parameters', async () => {
            const storeId = 'store-3';
            const limit = 20;
            const offset = 10;
            const dateFrom = new Date('2024-01-01');
            const dateTo = new Date('2024-01-31');

            mockQueryBus.execute.mockResolvedValue({ sales: [], total: 0 });

            const result = await service.findAll(storeId, limit, offset, dateFrom, dateTo);

            expect(queryBus.execute).toHaveBeenCalledTimes(1);
            expect(queryBus.execute).toHaveBeenCalledWith(
                expect.any(GetSalesListQuery)
            );

            const query = (queryBus.execute as jest.Mock).mock.calls[0][0] as GetSalesListQuery;
            expect(query.storeId).toBe(storeId);
            expect(query.limit).toBe(limit);
            expect(query.offset).toBe(offset);
            expect(query.dateFrom).toBe(dateFrom);
            expect(query.dateTo).toBe(dateTo);

            expect(result).toEqual({ sales: [], total: 0 });
        });

        it('should propagate error from query bus', async () => {
            const storeId = 'store-error-list';
            mockQueryBus.execute.mockRejectedValue(new Error('Database error'));

            await expect(service.findAll(storeId)).rejects.toThrow('Database error');
        });
    });

    describe('voidSale', () => {
        it('should dispatch VoidSaleCommand with correct parameters', async () => {
            const storeId = 'store-4';
            const saleId = 'sale-4';
            const userId = 'user-4';
            const reason = 'Reason for voiding';

            mockCommandBus.execute.mockResolvedValue({ id: saleId, voided_at: new Date() });

            const result = await service.voidSale(storeId, saleId, userId, reason);

            expect(commandBus.execute).toHaveBeenCalledTimes(1);
            expect(commandBus.execute).toHaveBeenCalledWith(
                expect.any(VoidSaleCommand)
            );

            const command = (commandBus.execute as jest.Mock).mock.calls[0][0] as VoidSaleCommand;
            expect(command.storeId).toBe(storeId);
            expect(command.saleId).toBe(saleId);
            expect(command.userId).toBe(userId);
            expect(command.reason).toBe(reason);

            expect(result.id).toBe(saleId);
            expect(result.voided_at).toBeDefined();
        });

        it('should propagate error from command bus (voidSale)', async () => {
            const storeId = 'store-error-void';
            mockCommandBus.execute.mockRejectedValue(new Error('Voiding failed'));

            await expect(service.voidSale(storeId, 'sale-X', 'user-Y')).rejects.toThrow('Voiding failed');
        });
    });

    describe('returnItems', () => {
        it('should dispatch ReturnItemsCommand with correct parameters', async () => {
            const storeId = 'store-5';
            const saleId = 'sale-5';
            const userId = 'user-5';
            const dto: ReturnSaleDto = { items: [{ sale_item_id: 'item-1', qty: 1 }] };

            mockCommandBus.execute.mockResolvedValue({ id: 'return-1' });

            const result = await service.returnItems(storeId, saleId, dto, userId);

            expect(commandBus.execute).toHaveBeenCalledTimes(1);
            expect(commandBus.execute).toHaveBeenCalledWith(
                expect.any(ReturnItemsCommand)
            );

            const command = (commandBus.execute as jest.Mock).mock.calls[0][0] as ReturnItemsCommand;
            expect(command.storeId).toBe(storeId);
            expect(command.saleId).toBe(saleId);
            expect(command.userId).toBe(userId);
            expect(command.dto).toBe(dto);

            expect(result).toEqual({ id: 'return-1' });
        });

        it('should propagate error from command bus (returnItems)', async () => {
            const storeId = 'store-error-return';
            mockCommandBus.execute.mockRejectedValue(new Error('Return failed'));

            await expect(service.returnItems(storeId, 'sale-R', {} as ReturnSaleDto, 'user-R')).rejects.toThrow('Return failed');
        });
    });

    describe('returnSale', () => {
        it('should dispatch ReturnSaleCommand with correct parameters', async () => {
            const storeId = 'store-6';
            const saleId = 'sale-6';
            const userId = 'user-6';
            const reason = 'Reason for full return';

            mockCommandBus.execute.mockResolvedValue({ id: 'return-total-1' });

            const result = await service.returnSale(storeId, saleId, userId, reason);

            expect(commandBus.execute).toHaveBeenCalledTimes(1);
            expect(commandBus.execute).toHaveBeenCalledWith(
                expect.any(ReturnSaleCommand)
            );

            const command = (commandBus.execute as jest.Mock).mock.calls[0][0] as ReturnSaleCommand;
            expect(command.storeId).toBe(storeId);
            expect(command.saleId).toBe(saleId);
            expect(command.userId).toBe(userId);
            expect(command.reason).toBe(reason);

            expect(result).toEqual({ id: 'return-total-1' });
        });

        it('should propagate error from command bus (returnSale)', async () => {
            const storeId = 'store-error-return-sale';
            mockCommandBus.execute.mockRejectedValue(new Error('Total return failed'));

            await expect(service.returnSale(storeId, 'sale-T', 'user-T')).rejects.toThrow('Total return failed');
        });
    });
});
