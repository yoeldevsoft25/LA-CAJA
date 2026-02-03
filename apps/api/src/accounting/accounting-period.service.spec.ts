import { Test, TestingModule } from '@nestjs/testing';
import { AccountingPeriodService } from './accounting-period.service';
import { AccountingReportingService } from './accounting-reporting.service';
import { AccountingSharedService } from './accounting-shared.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
    AccountingPeriod,
    AccountingPeriodStatus,
} from '../database/entities/accounting-period.entity';
import { JournalEntry } from '../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../database/entities/journal-entry-line.entity';
import { ChartOfAccount } from '../database/entities/chart-of-accounts.entity';
import { BadRequestException } from '@nestjs/common';

const mockRepository = () => ({
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
});

const mockAccountingReportingService = () => ({
    getIncomeStatement: jest.fn(),
});

const mockAccountingSharedService = () => ({
    generateEntryNumber: jest.fn(),
    calculateAccountBalancesBatch: jest.fn(),
    updateAccountBalances: jest.fn(),
});

describe('AccountingPeriodService', () => {
    let service: AccountingPeriodService;
    let periodRepository: any;
    let journalEntryRepository: any;
    let accountRepository: any;
    let accountingReportingService: { getIncomeStatement: jest.Mock };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AccountingPeriodService,
                {
                    provide: AccountingReportingService,
                    useFactory: mockAccountingReportingService,
                },
                {
                    provide: AccountingSharedService,
                    useFactory: mockAccountingSharedService,
                },
                {
                    provide: getRepositoryToken(AccountingPeriod),
                    useFactory: mockRepository,
                },
                {
                    provide: getRepositoryToken(JournalEntry),
                    useFactory: mockRepository,
                },
                {
                    provide: getRepositoryToken(JournalEntryLine),
                    useFactory: mockRepository,
                },
                {
                    provide: getRepositoryToken(ChartOfAccount),
                    useFactory: mockRepository,
                },
            ],
        }).compile();

        service = module.get<AccountingPeriodService>(AccountingPeriodService);
        periodRepository = module.get(getRepositoryToken(AccountingPeriod));
        journalEntryRepository = module.get(getRepositoryToken(JournalEntry));
        accountRepository = module.get(getRepositoryToken(ChartOfAccount));
        accountingReportingService = module.get(AccountingReportingService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getOrCreatePeriod', () => {
        it('should return existing period', async () => {
            const period = { id: '1', period_code: '2023-01' };
            periodRepository.findOne.mockResolvedValue(period);

            const result = await service.getOrCreatePeriod('store1', new Date(), new Date());
            expect(result).toBe(period);
        });

        it('should create new period if not exists', async () => {
            periodRepository.findOne.mockResolvedValue(null);
            periodRepository.create.mockReturnValue({ id: 'new' });
            periodRepository.save.mockResolvedValue({ id: 'new' });

            const result = await service.getOrCreatePeriod('store1', new Date(), new Date());
            expect(result).toEqual({ id: 'new' });
            expect(periodRepository.create).toHaveBeenCalled();
        });
    });

    describe('validatePeriodOpen', () => {
        it('should throw if period is closed', async () => {
            periodRepository.findOne.mockResolvedValue({ status: AccountingPeriodStatus.CLOSED });
            await expect(service.validatePeriodOpen('store1', new Date())).rejects.toThrow(BadRequestException);
        });

        it('should not throw if period is open', async () => {
            periodRepository.findOne.mockResolvedValue({ status: AccountingPeriodStatus.OPEN });
            await expect(service.validatePeriodOpen('store1', new Date())).resolves.not.toThrow();
        });
    });

    describe('closePeriod', () => {
        const storeId = 'store1';
        const periodStart = new Date('2023-01-01');
        const periodEnd = new Date('2023-01-31');
        const userId = 'user1';

        it('should throw if already closed', async () => {
            periodRepository.findOne.mockResolvedValue({ status: AccountingPeriodStatus.CLOSED });
            await expect(service.closePeriod(storeId, periodStart, periodEnd, userId)).rejects.toThrow(BadRequestException);
        });

        it('should close period without entry if no income', async () => {
            periodRepository.findOne.mockResolvedValue({ status: AccountingPeriodStatus.OPEN });
            accountingReportingService.getIncomeStatement.mockResolvedValue({
                totals: { net_income_bs: 0, net_income_usd: 0 },
            });

            const result = await service.closePeriod(storeId, periodStart, periodEnd, userId);
            expect(result.closingEntry).toBeNull();
            expect(periodRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: AccountingPeriodStatus.CLOSED }));
        });
    });
});
