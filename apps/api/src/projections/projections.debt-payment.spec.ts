import { ProjectionsService } from './projections.service';
import { DebtStatus } from '../database/entities/debt.entity';

jest.mock('../whatsapp/whatsapp-messaging.service');
jest.mock('../whatsapp/whatsapp-bot.service');
jest.mock('@whiskeysockets/baileys', () => ({
  DisconnectReason: {
    multideviceMismatch: 411,
    connectionReplaced: 440,
    loggedOut: 401,
    connectionLost: 408,
    restartRequired: 515,
    timedOut: 408,
  },
  useMultiFileAuthState: jest.fn(),
  makeWASocket: jest.fn(),
}));

type RepoMock = {
  findOne: jest.Mock;
  find: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  createQueryBuilder: jest.Mock;
};

const createRepoMock = (): RepoMock => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn((input) => input),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const createTotalsQueryBuilder = (paidUsd: string, paidBs: string) => ({
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getRawOne: jest.fn().mockResolvedValue({ paid_usd: paidUsd, paid_bs: paidBs }),
});

describe('ProjectionsService DebtPaymentRecorded projection', () => {
  let service: ProjectionsService;
  let debtRepo: RepoMock;
  let debtPaymentRepo: RepoMock;

  beforeEach(() => {
    const productRepo = createRepoMock();
    const movementRepo = createRepoMock();
    const saleRepo = createRepoMock();
    const saleItemRepo = createRepoMock();
    const cashSessionRepo = createRepoMock();
    const customerRepo = createRepoMock();
    debtRepo = createRepoMock();
    debtPaymentRepo = createRepoMock();
    const cashLedgerRepo = createRepoMock();
    const stockEscrowRepo = createRepoMock();

    service = new ProjectionsService(
      productRepo as any,
      movementRepo as any,
      saleRepo as any,
      saleItemRepo as any,
      cashSessionRepo as any,
      customerRepo as any,
      debtRepo as any,
      debtPaymentRepo as any,
      cashLedgerRepo as any,
      stockEscrowRepo as any,
      {} as any, // dataSource
      {} as any, // whatsappMessagingService
      {} as any, // fiscalInvoicesService
      {} as any, // accountingService
      {} as any, // warehousesService
      {} as any, // metricsService
      {} as any, // invoiceSeriesService
    );
  });

  it('updates debt status to PARTIAL when payment is projected and debt remains open', async () => {
    const debt = {
      id: 'debt-1',
      store_id: 'store-1',
      amount_usd: 100,
      amount_bs: 0,
      status: DebtStatus.OPEN,
    };

    debtPaymentRepo.findOne.mockResolvedValue(null);
    debtRepo.findOne.mockResolvedValue(debt);
    debtPaymentRepo.createQueryBuilder.mockReturnValue(
      createTotalsQueryBuilder('40', '0'),
    );

    await (service as any).projectDebtPaymentRecorded({
      event_id: 'evt-1',
      store_id: 'store-1',
      created_at: new Date('2026-02-11T21:20:00.000Z'),
      payload: {
        payment_id: 'payment-1',
        debt_id: 'debt-1',
        amount_usd: 40,
        amount_bs: 0,
        method: 'cash',
      },
    });

    expect(debtRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'debt-1',
        status: DebtStatus.PARTIAL,
      }),
    );
  });

  it('updates debt status to PAID when projected payments reach total debt amount', async () => {
    const debt = {
      id: 'debt-1',
      store_id: 'store-1',
      amount_usd: 100,
      amount_bs: 0,
      status: DebtStatus.OPEN,
    };

    debtPaymentRepo.findOne.mockResolvedValue(null);
    debtRepo.findOne.mockResolvedValue(debt);
    debtPaymentRepo.createQueryBuilder.mockReturnValue(
      createTotalsQueryBuilder('100', '0'),
    );

    await (service as any).projectDebtPaymentRecorded({
      event_id: 'evt-2',
      store_id: 'store-1',
      created_at: new Date('2026-02-11T21:20:00.000Z'),
      payload: {
        payment_id: 'payment-2',
        debt_id: 'debt-1',
        amount_usd: 60,
        amount_bs: 0,
        method: 'cash',
      },
    });

    expect(debtRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'debt-1',
        status: DebtStatus.PAID,
      }),
    );
  });

  it('recalculates debt status even when payment already exists (idempotent healing)', async () => {
    const debt = {
      id: 'debt-1',
      store_id: 'store-1',
      amount_usd: 100,
      amount_bs: 0,
      status: DebtStatus.OPEN,
    };

    debtPaymentRepo.findOne.mockResolvedValue({ id: 'payment-existing' });
    debtRepo.findOne.mockResolvedValue(debt);
    debtPaymentRepo.createQueryBuilder.mockReturnValue(
      createTotalsQueryBuilder('100', '0'),
    );

    await (service as any).projectDebtPaymentRecorded({
      event_id: 'evt-3',
      store_id: 'store-1',
      created_at: new Date('2026-02-11T21:20:00.000Z'),
      payload: {
        payment_id: 'payment-existing',
        debt_id: 'debt-1',
        amount_usd: 0,
        amount_bs: 0,
        method: 'cash',
      },
    });

    expect(debtRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'debt-1',
        status: DebtStatus.PAID,
      }),
    );
  });
});
