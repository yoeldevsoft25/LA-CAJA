import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SyncService } from './sync.service';
import { Event } from '../database/entities/event.entity';
import { Product } from '../database/entities/product.entity';
import { CashSession } from '../database/entities/cash-session.entity';
import { ProjectionsService } from '../projections/projections.service';
import { VectorClockService } from './vector-clock.service';
import { CRDTService } from './crdt.service';
import { ConflictResolutionService } from './conflict-resolution.service';
import { DiscountRulesService } from '../discounts/discount-rules.service';
import { PushSyncDto } from './dto/push-sync.dto';

jest.mock('../projections/projections.service', () => ({
  ProjectionsService: class ProjectionsService {},
}));

describe('SyncService', () => {
  let service: SyncService;

  const eventRepository = {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
    create: jest.fn(),
  };
  const productRepository = {
    find: jest.fn(),
  };
  const cashSessionRepository = {
    findOne: jest.fn(),
  };
  const projectionsService = {
    projectEvent: jest.fn(),
  };
  const vectorClockService = {
    fromEvent: jest.fn().mockReturnValue({}),
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
});
