import { Test, TestingModule } from '@nestjs/testing';
import { AccountingReportingService } from './accounting-reporting.service';
import { AccountingSharedService } from './accounting-shared.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JournalEntry } from '../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../database/entities/journal-entry-line.entity';
import { ChartOfAccount } from '../database/entities/chart-of-accounts.entity';
import { Debt } from '../database/entities/debt.entity';
import { PurchaseOrder } from '../database/entities/purchase-order.entity';
import { FiscalInvoice } from '../database/entities/fiscal-invoice.entity';

describe('AccountingReportingService', () => {
    let service: AccountingReportingService;
    let accountRepository: any;
    let journalEntryRepository: any;
    let journalEntryLineRepository: any;
    let sharedService: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AccountingReportingService,
                {
                    provide: AccountingSharedService,
                    useValue: {
                        calculateAccountBalancesBatch: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(JournalEntry),
                    useValue: {
                        find: jest.fn(),
                        count: jest.fn(),
                        createQueryBuilder: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(JournalEntryLine),
                    useValue: {
                        createQueryBuilder: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(ChartOfAccount),
                    useValue: {
                        find: jest.fn(),
                        findOne: jest.fn(),
                        createQueryBuilder: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(Debt),
                    useValue: {
                        find: jest.fn(),
                        findOne: jest.fn(),
                        createQueryBuilder: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(PurchaseOrder),
                    useValue: {
                        find: jest.fn(),
                        findOne: jest.fn(),
                        createQueryBuilder: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(FiscalInvoice),
                    useValue: {
                        find: jest.fn(),
                        findOne: jest.fn(),
                        createQueryBuilder: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<AccountingReportingService>(
            AccountingReportingService,
        );
        accountRepository = module.get(getRepositoryToken(ChartOfAccount));
        journalEntryRepository = module.get(getRepositoryToken(JournalEntry));
        journalEntryLineRepository = module.get(
            getRepositoryToken(JournalEntryLine),
        );
        sharedService = module.get<AccountingSharedService>(
            AccountingSharedService,
        );
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getBalanceSheet', () => {
        it('should return balance sheet with assets, liabilities, and equity', async () => {
            const storeId = 'store-123';
            const asOfDate = new Date('2024-12-31');

            const mockAccounts = [
                {
                    id: 'acc-1',
                    account_code: '1.01.01',
                    account_name: 'Caja',
                    account_type: 'asset',
                },
                {
                    id: 'acc-2',
                    account_code: '2.01.01',
                    account_name: 'Cuentas por Pagar',
                    account_type: 'liability',
                },
                {
                    id: 'acc-3',
                    account_code: '3.01.01',
                    account_name: 'Capital',
                    account_type: 'equity',
                },
            ];

            const mockBalances = new Map([
                ['acc-1', { balance_bs: 10000, balance_usd: 1000 }],
                ['acc-2', { balance_bs: 5000, balance_usd: 500 }],
                ['acc-3', { balance_bs: 5000, balance_usd: 500 }],
            ]);

            const queryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockAccounts),
            };

            accountRepository.createQueryBuilder.mockReturnValue(queryBuilder);
            sharedService.calculateAccountBalancesBatch.mockResolvedValue(
                mockBalances,
            );

            const result = await service.getBalanceSheet(storeId, asOfDate);

            expect(result.assets).toHaveLength(1);
            expect(result.liabilities).toHaveLength(1);
            expect(result.equity).toHaveLength(1);
            expect(result.totals.total_assets_bs).toBe(10000);
            expect(result.totals.total_liabilities_bs).toBe(5000);
            expect(result.totals.total_equity_bs).toBe(5000);
        });

        it('should exclude accounts with zero balance', async () => {
            const storeId = 'store-123';
            const asOfDate = new Date('2024-12-31');

            const mockAccounts = [
                {
                    id: 'acc-1',
                    account_code: '1.01.01',
                    account_name: 'Caja',
                    account_type: 'asset',
                },
                {
                    id: 'acc-2',
                    account_code: '1.01.02',
                    account_name: 'Banco',
                    account_type: 'asset',
                },
            ];

            const mockBalances = new Map([
                ['acc-1', { balance_bs: 10000, balance_usd: 1000 }],
                ['acc-2', { balance_bs: 0, balance_usd: 0 }],
            ]);

            const queryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockAccounts),
            };

            accountRepository.createQueryBuilder.mockReturnValue(queryBuilder);
            sharedService.calculateAccountBalancesBatch.mockResolvedValue(
                mockBalances,
            );

            const result = await service.getBalanceSheet(storeId, asOfDate);

            expect(result.assets).toHaveLength(1);
            expect(result.assets[0].account_code).toBe('1.01.01');
        });
    });

    describe('getIncomeStatement', () => {
        it('should return income statement with revenues and expenses', async () => {
            const storeId = 'store-123';
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            const mockAccounts = [
                {
                    id: 'acc-1',
                    account_code: '4.01.01',
                    account_name: 'Ventas',
                    account_type: 'revenue',
                },
                {
                    id: 'acc-2',
                    account_code: '5.01.01',
                    account_name: 'Costo de Ventas',
                    account_type: 'expense',
                },
            ];

            const accountQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockAccounts),
            };

            accountRepository.createQueryBuilder.mockReturnValue(
                accountQueryBuilder,
            );

            const entryQueryBuilder = {
                innerJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                getRawOne: jest.fn(),
            };

            entryQueryBuilder.getRawOne
                .mockResolvedValueOnce({
                    total_debit_bs: 1000,
                    total_credit_bs: 11000,
                    total_debit_usd: 100,
                    total_credit_usd: 1100,
                })
                .mockResolvedValueOnce({
                    total_debit_bs: 6000,
                    total_credit_bs: 0,
                    total_debit_usd: 600,
                    total_credit_usd: 0,
                });

            journalEntryRepository.createQueryBuilder.mockReturnValue(
                entryQueryBuilder,
            );

            const result = await service.getIncomeStatement(
                storeId,
                startDate,
                endDate,
            );

            expect(result.revenues).toHaveLength(1);
            expect(result.expenses).toHaveLength(1);
            expect(result.totals.total_revenue_bs).toBe(10000);
            expect(result.totals.total_expenses_bs).toBe(6000);
            expect(result.totals.net_income_bs).toBe(4000);
        });
    });

    describe('getCashFlowStatement', () => {
        it('should return cash flow statement', async () => {
            const storeId = 'store-123';
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            const mockGetIncomeStatement = jest.fn().mockResolvedValue({
                totals: {
                    net_income_bs: 5000,
                    net_income_usd: 500,
                },
            });

            const mockCashAccounts = [
                {
                    id: 'cash-1',
                    account_code: '1.01.01',
                    account_name: 'Caja',
                },
            ];

            accountRepository.find.mockResolvedValue(mockCashAccounts);
            accountRepository.findOne.mockResolvedValue(null);

            const mockBalances = new Map([
                ['cash-1', { balance_bs: 10000, balance_usd: 1000 }],
            ]);

            sharedService.calculateAccountBalancesBatch.mockResolvedValue(
                mockBalances,
            );

            const result = await service.getCashFlowStatement(
                storeId,
                startDate,
                endDate,
                mockGetIncomeStatement,
            );

            expect(result.operating_activities.net_income_bs).toBe(5000);
            expect(result.cash_at_beginning_bs).toBe(10000);
            expect(result.cash_at_end_bs).toBe(10000);
        });
    });
});
