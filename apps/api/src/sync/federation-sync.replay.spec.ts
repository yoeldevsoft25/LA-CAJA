import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import axios from 'axios';
import { Event } from '../database/entities/event.entity';
import { FederationSyncService } from './federation-sync.service';
import { ConflictAuditService } from './conflict-audit.service';
import { DistributedLockService } from '../common/distributed-lock.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FederationSyncService synthetic replay', () => {
  let service: FederationSyncService;
  let dataSource: { query: jest.Mock };

  const eventRepository = {
    findOne: jest.fn(),
  };

  const queue = {
    add: jest.fn(),
    getFailed: jest.fn().mockResolvedValue([]),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
  };

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'REMOTE_SYNC_URL') return 'https://remote.example';
      if (key === 'ADMIN_SECRET') return 'secret';
      return null;
    }),
  };

  beforeEach(async () => {
    dataSource = { query: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FederationSyncService,
        { provide: getRepositoryToken(Event), useValue: eventRepository },
        { provide: getQueueToken('federation-sync'), useValue: queue },
        { provide: ConfigService, useValue: configService },
        { provide: DataSource, useValue: dataSource },
        { provide: ConflictAuditService, useValue: {} },
        {
          provide: DistributedLockService,
          useValue: { acquireWithOwnership: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(FederationSyncService);
    jest.clearAllMocks();
  });

  it('replays missing debts using synthetic events from debts table', async () => {
    const storeId = '11111111-1111-1111-1111-111111111111';
    const debtId = '22222222-2222-2222-2222-222222222222';

    dataSource.query
      .mockResolvedValueOnce([]) // No DebtCreated events found
      .mockResolvedValueOnce([
        {
          id: debtId,
          sale_id: '33333333-3333-3333-3333-333333333333',
          customer_id: '44444444-4444-4444-4444-444444444444',
          created_at: '2026-02-11T20:00:00.000Z',
          amount_bs: '100',
          amount_usd: '10',
          note: null,
        },
      ]);

    const syntheticEventId = (service as any).deterministicUuid(
      `federation:synthetic:debt-created:${storeId}:${debtId}`,
    );
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        accepted: [{ event_id: syntheticEventId, seq: 1 }],
        rejected: [],
        conflicted: [],
      },
    } as any);

    const result = await service.replayDebtsByIds(storeId, [debtId]);

    expect(result).toEqual({
      requested: 1,
      found: 0,
      queued: 1,
      missingIds: [],
    });
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://remote.example/sync/push',
      expect.objectContaining({
        store_id: storeId,
        events: [
          expect.objectContaining({
            event_id: syntheticEventId,
            type: 'DebtCreated',
          }),
        ],
      }),
      expect.any(Object),
    );
  });

  it('replays missing debt payments using synthetic events from debt_payments table', async () => {
    const storeId = '11111111-1111-1111-1111-111111111111';
    const paymentId = '55555555-5555-5555-5555-555555555555';
    const debtId = '66666666-6666-6666-6666-666666666666';

    dataSource.query
      .mockResolvedValueOnce([]) // No DebtPaymentRecorded events found
      .mockResolvedValueOnce([
        {
          id: paymentId,
          debt_id: debtId,
          amount_bs: '60',
          amount_usd: '6',
          method: 'cash',
          paid_at: '2026-02-11T20:01:00.000Z',
          note: 'offline',
        },
      ]);

    const syntheticEventId = (service as any).deterministicUuid(
      `federation:synthetic:debt-payment:${storeId}:${paymentId}`,
    );
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        accepted: [{ event_id: syntheticEventId, seq: 1 }],
        rejected: [],
        conflicted: [],
      },
    } as any);

    const result = await service.replayDebtPaymentsByIds(storeId, [paymentId]);

    expect(result).toEqual({
      requested: 1,
      found: 0,
      queued: 1,
      missingIds: [],
    });
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://remote.example/sync/push',
      expect.objectContaining({
        store_id: storeId,
        events: [
          expect.objectContaining({
            event_id: syntheticEventId,
            type: 'DebtPaymentRecorded',
          }),
        ],
      }),
      expect.any(Object),
    );
  });
});
