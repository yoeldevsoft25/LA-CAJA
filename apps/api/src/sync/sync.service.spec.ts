import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { SyncService } from './sync.service';
import { Event } from '../database/entities/event.entity';
import { Product } from '../database/entities/product.entity';
import { CashSession } from '../database/entities/cash-session.entity';
import { Store } from '../database/entities/store.entity';
import { ProjectionsService } from '../projections/projections.service';
import { VectorClockService } from './vector-clock.service';
import { CRDTService } from './crdt.service';
import { ConflictResolutionService } from './conflict-resolution.service';
import { DiscountRulesService } from '../discounts/discount-rules.service';
import { UsageService } from '../licenses/usage.service';
import { PushSyncDto } from './dto/push-sync.dto';
import { SyncMetricsService } from '../observability/services/sync-metrics.service';
import { FederationSyncService } from './federation-sync.service';
import { OutboxService } from './outbox.service';
import { WarehouseStock } from '../database/entities/warehouse-stock.entity';
import { OversellAlertService } from '../inventory/oversell-alert.service';
import { FiscalSequenceService } from '../fiscal/fiscal-sequence.service';
import * as crypto from 'crypto';

jest.mock('../projections/projections.service', () => ({
  ProjectionsService: class ProjectionsService { },
}));

describe('SyncService', () => {
  let service: SyncService;

  const sortDeep = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map((item) => sortDeep(item));
    if (typeof obj !== 'object') return obj;
    const sorted: Record<string, any> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortDeep(obj[key]);
    }
    return sorted;
  };

  const hashPayload = (payload: any): string => {
    const json = JSON.stringify(sortDeep(payload));
    return crypto.createHash('sha256').update(json).digest('hex');
  };

  const eventRepository = {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
    create: jest.fn().mockImplementation((event) => event),
    manager: {
      transaction: jest.fn().mockImplementation(async (cb) => {
        const queryBuilder = {
          insert: jest.fn().mockReturnThis(),
          into: jest.fn().mockReturnThis(),
          values: jest.fn().mockReturnThis(),
          orIgnore: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue(undefined),
        };
        return cb({
          createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
          getRepository: () => ({
            save: jest.fn().mockResolvedValue(undefined),
          }),
        });
      }),
    },
  };
  const productRepository = {
    find: jest.fn(),
  };
  const cashSessionRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
  };
  const projectionsService = {
    projectEvent: jest.fn(),
  };
  const vectorClockService = {
    fromEvent: jest.fn().mockReturnValue({}),
    merge: jest.fn().mockImplementation((a, b) => ({ ...(a || {}), ...(b || {}) })),
  };
  const usageService = {
    increment: jest.fn(),
  };
  const salesProjectionQueue = {
    add: jest.fn(),
    addBulk: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        {
          provide: getRepositoryToken(Event),
          useValue: eventRepository,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: productRepository,
        },
        {
          provide: getRepositoryToken(CashSession),
          useValue: cashSessionRepository,
        },
        {
          provide: getRepositoryToken(Store),
          useValue: { findOne: jest.fn(), find: jest.fn() },
        },
        {
          provide: ProjectionsService,
          useValue: projectionsService,
        },
        {
          provide: VectorClockService,
          useValue: vectorClockService,
        },
        {
          provide: CRDTService,
          useValue: {},
        },
        {
          provide: ConflictResolutionService,
          useValue: {},
        },
        {
          provide: DiscountRulesService,
          useValue: {},
        },
        {
          provide: UsageService,
          useValue: usageService,
        },
        {
          provide: getQueueToken('sales-projections'),
          useValue: salesProjectionQueue,
        },
        {
          provide: SyncMetricsService,
          useValue: {
            trackOutOfOrderEvent: jest.fn(),
            trackSyncPush: jest.fn(),
            trackSyncPull: jest.fn(),
            trackProjectionFailureFatal: jest.fn(),
            trackSyncProcessed: jest.fn() // Added missing method
          },
        },
        {
          provide: FederationSyncService,
          useValue: {
            replicateEvent: jest.fn(),
          },
        },
        {
          provide: OutboxService,
          useValue: {
            writeOutboxEntries: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WarehouseStock),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: OversellAlertService,
          useValue: {
            createOversellAlert: jest.fn(),
          },
        },
        {
          provide: FiscalSequenceService,
          useValue: {
            validateFiscalNumber: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects SaleCreated events when actor user does not match authenticated user', async () => {
    const dto: PushSyncDto = {
      store_id: 'store-1',
      device_id: 'device-1',
      client_version: 'test',
      events: [
        {
          event_id: 'event-1',
          seq: 1,
          type: 'SaleCreated',
          version: 1,
          created_at: Date.now(),
          actor: { user_id: 'user-1', role: 'cashier' },
          payload: {
            sale_id: 'sale-1',
            cash_session_id: 'session-1',
            sold_at: Date.now(),
            exchange_rate: 1,
            currency: 'USD',
            items: [],
            totals: {
              subtotal_bs: 0,
              subtotal_usd: 0,
              discount_bs: 0,
              discount_usd: 0,
              total_bs: 0,
              total_usd: 0,
            },
            payment: {
              method: 'CASH_USD',
            },
          },
        },
      ],
    };

    const result = await service.push(dto, 'user-2');

    expect(result.accepted).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].code).toBe('SECURITY_ERROR');
  });

  it('soft-accepts offline SaleCreated events when actor differs from authenticated user', async () => {
    productRepository.find.mockResolvedValue([
      {
        id: 'product-1',
        price_bs: 0,
        price_usd: 10,
        is_weight_product: false,
      },
    ]);

    cashSessionRepository.find.mockResolvedValue([
      {
        id: 'session-1',
        store_id: 'store-1',
        closed_at: null,
        opened_by: 'user-1',
      },
    ]);

    const payload = {
      sale_id: 'sale-2',
      request_id: '4f52c1e8-44e2-4d4d-a4d3-01311c546f6c',
      cash_session_id: 'session-1',
      sold_at: Date.now(),
      exchange_rate: 1,
      currency: 'USD',
      items: [
        {
          product_id: 'product-1',
          qty: 1,
          unit_price_bs: 0,
          unit_price_usd: 10,
          discount_bs: 0,
          discount_usd: 0,
        },
      ],
      totals: {
        subtotal_bs: 0,
        subtotal_usd: 10,
        discount_bs: 0,
        discount_usd: 0,
        total_bs: 0,
        total_usd: 10,
      },
      payment: {
        method: 'CASH_USD',
      },
      metadata: {
        offline_created: true,
      },
    };

    const dto: PushSyncDto = {
      store_id: 'store-1',
      device_id: 'device-1',
      client_version: 'pwa-sw-1.1.0',
      events: [
        {
          event_id: 'event-2',
          seq: 2,
          type: 'SaleCreated',
          version: 1,
          created_at: Date.now(),
          actor: { user_id: 'user-1', role: 'cashier' },
          payload,
          delta_payload: payload,
          full_payload_hash: hashPayload(payload),
        } as any,
      ],
    };

    const result = await service.push(dto, 'user-2');

    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
    expect(eventRepository.create).toHaveBeenCalled();
  });
});
