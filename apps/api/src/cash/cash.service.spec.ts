import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CashService } from './cash.service';
import { CashSession } from '../database/entities/cash-session.entity';
import { Sale } from '../database/entities/sale.entity';
import { CashMovement } from '../database/entities/cash-movement.entity';
import { Event } from '../database/entities/event.entity';
import { CashLedgerEntry } from '../database/entities/cash-ledger-entry.entity';
import { AccountingService } from '../accounting/accounting.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { FederationSyncService } from '../sync/federation-sync.service';
import { DataSource } from 'typeorm';

describe('CashService', () => {
  let service: CashService;

  const cashSessionRepository = {
    findOne: jest.fn(),
  };
  const saleRepository = {};
  const cashMovementRepository = {};
  const dataSource = {};
  const accountingService = {
    generateEntryFromCashClose: jest.fn(),
  };
  const securityAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashService,
        {
          provide: getRepositoryToken(CashSession),
          useValue: cashSessionRepository,
        },
        {
          provide: getRepositoryToken(Sale),
          useValue: saleRepository,
        },
        {
          provide: getRepositoryToken(CashMovement),
          useValue: cashMovementRepository,
        },
        {
          provide: AccountingService,
          useValue: accountingService,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: SecurityAuditService,
          useValue: securityAuditService,
        },
        {
          provide: getRepositoryToken(Event),
          useValue: {},
        },
        {
          provide: getRepositoryToken(CashLedgerEntry),
          useValue: {},
        },
        {
          provide: FederationSyncService,
          useValue: {
            queueRelay: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CashService>(CashService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects closing a session by a different user without privileges', async () => {
    cashSessionRepository.findOne.mockResolvedValue({
      id: 'session-1',
      store_id: 'store-1',
      opened_by: 'user-1',
      opened_at: new Date(),
      closed_at: null,
      opening_amount_bs: 0,
      opening_amount_usd: 0,
    });

    await expect(
      service.closeSession(
        'store-1',
        'user-2',
        'session-1',
        { counted_bs: 0, counted_usd: 0 },
        'cashier',
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
