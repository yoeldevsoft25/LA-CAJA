import { AccountingService } from './accounting.service';

describe('AccountingService - FX / FIAO', () => {
  const makeService = () => {
    const journalEntryRepository: any = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => data),
    };

    const journalEntryLineRepository: any = {
      create: jest.fn((data) => data),
      save: jest.fn(async (lines) => lines),
    };

    const sharedService: any = {
      generateEntryNumber: jest.fn(async () => 'AS-TEST'),
      updateAccountBalances: jest.fn(async () => undefined),
    };

    const service = new AccountingService(
      journalEntryRepository,
      journalEntryLineRepository,
      {} as any, // accountRepository
      {} as any, // mappingRepository
      {} as any, // balanceRepository
      {} as any, // saleRepository
      {} as any, // purchaseOrderRepository
      {} as any, // fiscalInvoiceRepository
      {} as any, // saleItemRepository
      {} as any, // inventoryMovementRepository
      {} as any, // productLotRepository
      {} as any, // productRepository
      {
        findOne: jest.fn(),
      } as any, // debtRepository
      {} as any, // periodRepository
      {} as any, // fiscalConfigRepository
      sharedService,
      {} as any, // reportingService
      {} as any, // exchangeService
      {} as any, // periodService
      {} as any, // auditService
    );

    return {
      service,
      journalEntryRepository,
      journalEntryLineRepository,
    };
  };

  it('posts realized FX gain on debt collection (credits A/R at book value)', async () => {
    const { service, journalEntryRepository, journalEntryLineRepository } =
      makeService();

    // Stub internal mapping resolution
    (service as any).getAccountMapping = jest.fn(
      async (_storeId: string, transactionType: string) => {
        switch (transactionType) {
          case 'accounts_receivable':
            return {
              account_id: 'ar',
              account_code: '1.01.03',
              account: { account_name: 'CxC' },
            };
          case 'cash_asset':
            return {
              account_id: 'cash',
              account_code: '1.01.02.04',
              account: { account_name: 'Zelle' },
            };
          case 'fx_gain_realized':
            return {
              account_id: 'fx_gain',
              account_code: '4.02.02.01',
              account: { account_name: 'Ganancia cambiaria realizada' },
            };
          case 'income':
            return {
              account_id: 'income',
              account_code: '4.02.01',
              account: { account_name: 'Ingresos' },
            };
          default:
            return null;
        }
      },
    );

    journalEntryRepository.findOne
      .mockResolvedValueOnce(null) // no existing entry
      .mockResolvedValueOnce({
        id: 'entry-1',
        lines: [],
      }); // return entry

    const entry = await service.generateEntryFromDebtPayment(
      'store-1',
      { id: 'debt-1', sale_id: null, customer_id: 'cust-1' },
      {
        id: 'pay-1',
        paid_at: new Date('2026-02-10T00:00:00.000Z'),
        amount_usd: 100,
        amount_bs: 4000,
        book_rate_bcv: 36,
        method: 'ZELLE',
      },
    );

    expect(entry).toBeTruthy();
    expect(journalEntryLineRepository.save).toHaveBeenCalledTimes(1);

    const savedLines = (journalEntryLineRepository.save as jest.Mock).mock
      .calls[0][0];

    // Debit asset 4000 / Credit A/R 3600 / Credit FX gain 400
    const debitBs = savedLines.reduce(
      (sum: number, l: any) => sum + Number(l.debit_amount_bs || 0),
      0,
    );
    const creditBs = savedLines.reduce(
      (sum: number, l: any) => sum + Number(l.credit_amount_bs || 0),
      0,
    );
    const debitUsd = savedLines.reduce(
      (sum: number, l: any) => sum + Number(l.debit_amount_usd || 0),
      0,
    );
    const creditUsd = savedLines.reduce(
      (sum: number, l: any) => sum + Number(l.credit_amount_usd || 0),
      0,
    );

    expect(debitBs).toBeCloseTo(4000, 2);
    expect(creditBs).toBeCloseTo(4000, 2);
    expect(debitUsd).toBeCloseTo(100, 2);
    expect(creditUsd).toBeCloseTo(100, 2);
  });

  it('posts realized FX loss on debt collection (credits A/R at book value)', async () => {
    const { service, journalEntryRepository, journalEntryLineRepository } =
      makeService();

    (service as any).getAccountMapping = jest.fn(
      async (_storeId: string, transactionType: string) => {
        switch (transactionType) {
          case 'accounts_receivable':
            return {
              account_id: 'ar',
              account_code: '1.01.03',
              account: { account_name: 'CxC' },
            };
          case 'cash_asset':
            return {
              account_id: 'cash',
              account_code: '1.01.02.01',
              account: { account_name: 'Transfer' },
            };
          case 'fx_loss_realized':
            return {
              account_id: 'fx_loss',
              account_code: '5.04.01.01',
              account: { account_name: 'Perdida cambiaria realizada' },
            };
          case 'expense':
            return {
              account_id: 'expense',
              account_code: '5.02.01',
              account: { account_name: 'Gastos' },
            };
          default:
            return null;
        }
      },
    );

    journalEntryRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'entry-2', lines: [] });

    const entry = await service.generateEntryFromDebtPayment(
      'store-1',
      { id: 'debt-2', sale_id: null, customer_id: 'cust-1' },
      {
        id: 'pay-2',
        paid_at: new Date('2026-02-10T00:00:00.000Z'),
        amount_usd: 100,
        amount_bs: 3300,
        book_rate_bcv: 36,
        method: 'TRANSFER',
      },
    );

    expect(entry).toBeTruthy();

    const savedLines = (journalEntryLineRepository.save as jest.Mock).mock
      .calls[0][0];

    const debitBs = savedLines.reduce(
      (sum: number, l: any) => sum + Number(l.debit_amount_bs || 0),
      0,
    );
    const creditBs = savedLines.reduce(
      (sum: number, l: any) => sum + Number(l.credit_amount_bs || 0),
      0,
    );

    // Debit asset 3300 + Debit FX loss 300 = 3600 / Credit A/R 3600
    expect(debitBs).toBeCloseTo(3600, 2);
    expect(creditBs).toBeCloseTo(3600, 2);
  });
});

