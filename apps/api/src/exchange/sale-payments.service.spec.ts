import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SalePaymentsService } from './sale-payments.service';
import { ExchangeService } from './exchange.service';
import { SalePayment, SaleChange } from '../database/entities';
import { SecurityAuditService } from '../security/security-audit.service';

describe('SalePaymentsService', () => {
  let service: SalePaymentsService;
  let securityAuditService: { log: jest.Mock };

  const salePaymentRepository = {};
  const saleChangeRepository = {};
  const exchangeService = {
    getRateForPaymentMethod: jest.fn().mockResolvedValue({
      rate: 1,
      rateType: 'BCV',
    }),
    getStoreRateConfig: jest.fn(),
    getBCVRate: jest.fn(),
  };

  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn(async (data: unknown) => data),
    },
  };

  const dataSource = {
    createQueryRunner: jest.fn().mockReturnValue(queryRunner),
  } as unknown as DataSource;

  beforeEach(async () => {
    securityAuditService = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalePaymentsService,
        {
          provide: getRepositoryToken(SalePayment),
          useValue: salePaymentRepository,
        },
        {
          provide: getRepositoryToken(SaleChange),
          useValue: saleChangeRepository,
        },
        {
          provide: ExchangeService,
          useValue: exchangeService,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: SecurityAuditService,
          useValue: securityAuditService,
        },
      ],
    }).compile();

    service = module.get<SalePaymentsService>(SalePaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects duplicate payment references', async () => {
    await expect(
      service.processPayments('sale-1', 'store-1', 10, [
        { method: 'PAGO_MOVIL', amount_usd: 5, reference: 'ABC' },
        { method: 'PAGO_MOVIL', amount_usd: 5, reference: 'ABC' },
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when total paid does not match total due', async () => {
    await expect(
      service.processPayments('sale-1', 'store-1', 10, [
        { method: 'CASH_USD', amount_usd: 5 },
      ]),
    ).rejects.toThrow('Los pagos no coinciden con el total');

    expect(securityAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'payment_mismatch',
      }),
    );
  });
});
