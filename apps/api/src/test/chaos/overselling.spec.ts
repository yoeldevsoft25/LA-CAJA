
jest.mock('p-queue', () => {
    return class MockQueue {
        add(fn: any) { return fn(); }
        on() { }
        start() { }
    };
});
jest.mock('@whiskeysockets/baileys', () => {
    return {
        default: jest.fn(),
        DisconnectReason: {},
        useMultiFileAuthState: jest.fn().mockReturnValue({ state: {}, saveCreds: jest.fn() }),
    };
});

import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from '../../sync/sync.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Event } from '../../database/entities/event.entity';
import { Product } from '../../database/entities/product.entity';
import { CashSession } from '../../database/entities/cash-session.entity';
import { Store } from '../../database/entities/store.entity';
import { WarehouseStock } from '../../database/entities/warehouse-stock.entity';
import { InventoryEscrowService } from '../../inventory/escrow/inventory-escrow.service';
import { OversellAlertService } from '../../inventory/oversell-alert.service';
import { ProjectionsService } from '../../projections/projections.service';
import { VectorClockService } from '../../sync/vector-clock.service';
import { CRDTService } from '../../sync/crdt.service';
import { ConflictResolutionService } from '../../sync/conflict-resolution.service';
import { DiscountRulesService } from '../../discounts/discount-rules.service';
import { UsageService } from '../../licenses/usage.service';
import { SyncMetricsService } from '../../observability/services/sync-metrics.service';
import { FederationSyncService } from '../../sync/federation-sync.service';
import { OutboxService } from '../../sync/outbox.service';
import { FiscalSequenceService } from '../../fiscal/fiscal-sequence.service';

jest.mock('../../projections/projections.service');
jest.mock('../../sync/federation-sync.service');
jest.mock('../../sync/outbox.service');

// Mocks
const mockRepository = () => ({
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    manager: {
        transaction: jest.fn((cb) => cb({
            createQueryBuilder: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            into: jest.fn().mockReturnThis(),
            values: jest.fn().mockReturnThis(),
            orIgnore: jest.fn().mockReturnThis(),
            execute: jest.fn(),
            save: jest.fn(),
            query: jest.fn().mockResolvedValue([]),
        })),
    },
});

const mockProjectionsService = () => ({});
const mockVectorClockService = () => ({
    fromEvent: jest.fn().mockReturnValue({}),
    merge: jest.fn().mockReturnValue({}),
});
const mockCrdtService = () => ({});
const mockConflictService = () => ({
    detectAndResolveConflicts: jest.fn().mockResolvedValue({ hasConflict: false, resolved: true }),
});
const mockDiscountRulesService = () => ({});
const mockUsageService = () => ({ increment: jest.fn() });
const mockSyncMetricsService = () => ({ trackSyncProcessed: jest.fn() });
const mockFederationSyncService = () => ({});
const mockOutboxService = () => ({ writeOutboxEntries: jest.fn() });
const mockFiscalSequenceService = () => ({});
const mockInventoryEscrowService = () => ({
    requestQuota: jest.fn(),
});
const mockOversellAlertService = () => ({
    createOversellAlert: jest.fn(),
});

describe('Chaos: Overselling Prevention', () => {
    let syncService: SyncService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SyncService,
                { provide: getRepositoryToken(Event), useFactory: mockRepository },
                { provide: getRepositoryToken(Product), useFactory: mockRepository },
                { provide: getRepositoryToken(CashSession), useFactory: mockRepository },
                { provide: getRepositoryToken(Store), useFactory: mockRepository },
                { provide: getRepositoryToken(WarehouseStock), useFactory: mockRepository },
                { provide: ProjectionsService, useFactory: mockProjectionsService },
                { provide: VectorClockService, useFactory: mockVectorClockService },
                { provide: CRDTService, useFactory: mockCrdtService },
                { provide: ConflictResolutionService, useFactory: mockConflictService },
                { provide: DiscountRulesService, useFactory: mockDiscountRulesService },
                { provide: UsageService, useFactory: mockUsageService },
                { provide: SyncMetricsService, useFactory: mockSyncMetricsService },
                { provide: FederationSyncService, useFactory: mockFederationSyncService },
                { provide: OutboxService, useFactory: mockOutboxService },
                { provide: FiscalSequenceService, useFactory: mockFiscalSequenceService },
                { provide: InventoryEscrowService, useFactory: mockInventoryEscrowService },
                { provide: OversellAlertService, useFactory: mockOversellAlertService },
                { provide: getQueueToken('sales-projections'), useValue: { add: jest.fn() } },
            ],
        }).compile();

        syncService = module.get<SyncService>(SyncService);
    });

    describe('Scenario: Two offline POS sell more than available stock', () => {
        it('should pass test shell', async () => {
            expect(syncService).toBeDefined();
        });
    });
});
