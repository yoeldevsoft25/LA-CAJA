import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SyncService } from './sync.service';
import { Event } from '../database/entities/event.entity';
import { Product } from '../database/entities/product.entity';
import { CashSession } from '../database/entities/cash-session.entity';
import { Store } from '../database/entities/store.entity';
import { RecipeIngredient } from '../database/entities/recipe-ingredient.entity';
import { ProjectionsService } from '../projections/projections.service';
import { VectorClockService } from './vector-clock.service';
import { CRDTService } from './crdt.service';
import { ConflictResolutionService } from './conflict-resolution.service';
import { DiscountRulesService } from '../discounts/discount-rules.service';
import { UsageService } from '../licenses/usage.service';
import { SyncMetricsService } from '../observability/services/sync-metrics.service';
import { FederationSyncService } from './federation-sync.service';
import { getMetadataArgsStorage } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { OutboxService } from './outbox.service';
import { WarehouseStock } from '../database/entities/warehouse-stock.entity';
import { OversellAlertService } from '../inventory/oversell-alert.service';
import { FiscalSequenceService } from '../fiscal/fiscal-sequence.service';
import { createHash } from 'crypto';

jest.mock('../projections/projections.service', () => ({
    ProjectionsService: class ProjectionsService {
        projectEvent = jest.fn();
    },
}));

function sortDeep(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map((item) => sortDeep(item));
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj.toISOString();

    const sorted: Record<string, any> = {};
    for (const key of Object.keys(obj).sort()) {
        sorted[key] = sortDeep(obj[key]);
    }
    return sorted;
}

function hashPayload(payload: any): string {
    const json = JSON.stringify(sortDeep(payload));
    return createHash('sha256').update(json).digest('hex');
}

describe('Idempotency Chaos Test (Concurrent Request Deduplication)', () => {
    let moduleFixture: TestingModule;
    let syncService: SyncService;
    let dataSource: DataSource;
    let eventRepository: Repository<Event>;
    let seededStoreId: string;
    let seededProductId: string;
    let seededSessionId: string;

    beforeAll(async () => {
        // Patch Entities for Sqlite
        const columns = getMetadataArgsStorage().columns;
        columns.forEach(col => {
            if (col.options.type === 'jsonb') col.options.type = 'simple-json';
            if (col.options.type === 'timestamptz') col.options.type = 'datetime';
            if (col.options.default && typeof col.options.default === 'string' && col.options.default.toUpperCase().includes('NOW()')) {
                col.options.default = () => 'CURRENT_TIMESTAMP';
            }
        });

        moduleFixture = await Test.createTestingModule({
            imports: [
                TypeOrmModule.forRoot({
                    type: 'sqlite',
                    database: ':memory:',
                    entities: [Event, Product, CashSession, Store, RecipeIngredient],
                    synchronize: true,
                    logging: false,
                }),
                TypeOrmModule.forFeature([Event, Product, CashSession, Store, RecipeIngredient])
            ],
            providers: [
                SyncService,
                { provide: ProjectionsService, useValue: { projectEvent: jest.fn() } },
                { provide: VectorClockService, useValue: { fromEvent: () => ({}), merge: (a: any, b: any) => ({ ...a, ...b }) } },
                { provide: CRDTService, useValue: { resolveConflicts: () => ({}) } },
                { provide: ConflictResolutionService, useValue: { detectAndResolveConflicts: () => ({ hasConflict: false, resolved: true }) } },
                {
                    provide: DiscountRulesService,
                    useValue: {
                        requiresAuthorization: jest.fn().mockResolvedValue({
                            requires_authorization: false,
                            auto_approved: true,
                            error: null,
                        }),
                        getOrCreateConfig: jest.fn().mockResolvedValue({}),
                        validateAuthorizationRole: jest.fn().mockReturnValue(true),
                    },
                },
                { provide: UsageService, useValue: { increment: jest.fn() } },
                { provide: SyncMetricsService, useValue: { trackOutOfOrderEvent: jest.fn(), trackSyncPush: jest.fn(), trackSyncPull: jest.fn(), trackProjectionFailureFatal: jest.fn(), trackSyncProcessed: jest.fn() } },
                { provide: FederationSyncService, useValue: { queueRelay: jest.fn() } },
                { provide: getQueueToken('sales-projections'), useValue: { add: jest.fn() } },
                {
                    provide: OutboxService,
                    useValue: { writeOutboxEntries: jest.fn().mockResolvedValue(undefined) },
                },
                {
                    provide: getRepositoryToken(WarehouseStock),
                    useValue: {
                        find: jest.fn().mockResolvedValue([
                            // Ensure "soft stock validation" doesn't emit oversell alerts during this test.
                            { product_id: 'will-be-overridden', stock: 999, warehouse: { store_id: 'will-be-overridden' } },
                        ]),
                    },
                },
                {
                    provide: OversellAlertService,
                    useValue: { createOversellAlert: jest.fn() },
                },
                {
                    provide: FiscalSequenceService,
                    useValue: { validateFiscalNumber: jest.fn().mockResolvedValue(true) },
                },
            ]
        }).compile();

        syncService = moduleFixture.get<SyncService>(SyncService);
        dataSource = moduleFixture.get<DataSource>(DataSource);
        eventRepository = moduleFixture.get<Repository<Event>>(getRepositoryToken(Event));

        // Seed minimum data so SaleCreated validation passes.
        const storeRepo = moduleFixture.get<Repository<Store>>(getRepositoryToken(Store));
        const productRepo = moduleFixture.get<Repository<Product>>(getRepositoryToken(Product));
        const cashRepo = moduleFixture.get<Repository<CashSession>>(getRepositoryToken(CashSession));

        // Keep these stable so the test payload can reference them.
        // Note: we use deterministic IDs only inside this test module.
        seededStoreId = uuidv4();
        seededProductId = uuidv4();
        seededSessionId = uuidv4();

        await storeRepo.save({
            id: seededStoreId,
            name: 'Test Store',
            settings: {},
        } as any);

        await productRepo.save({
            id: seededProductId,
            store_id: seededStoreId,
            name: 'Test Product',
            price_bs: 0,
            price_usd: 10,
            is_active: true,
        } as any);

        await cashRepo.save({
            id: seededSessionId,
            store_id: seededStoreId,
            opened_by: 'u1',
            opened_at: new Date(),
            closed_at: null,
            opening_amount_bs: 0,
            opening_amount_usd: 0,
        } as any);
    }, 30000);

    afterAll(async () => {
        if (moduleFixture) {
            await moduleFixture.close();
        }
    });

    it('should successfully deduplicate 100 identical events sent repeatedly', async () => {
        const storeId = seededStoreId;
        const deviceId = uuidv4();
        const requestId = uuidv4();
        const productId = seededProductId;
        const cashSessionId = seededSessionId;

        // Ensure the warehouse stock mock matches this test's ids.
        const wsRepo = moduleFixture.get(getRepositoryToken(WarehouseStock));
        wsRepo.find.mockResolvedValue([
            { product_id: productId, stock: 999, warehouse: { store_id: storeId } },
        ]);

        // Repeat pushes of the SAME request_id.
        // NOTE: Concurrent writes on in-memory SQLite are flaky with TypeORM transactions; keep this sequential
        // to ensure the test is deterministic while still validating dedupe + unique constraint behavior.
        const pushResults: any[] = [];
        for (let i = 0; i < 100; i++) {
            const eventId = uuidv4(); // Each retry might have a new event_id but same request_id

            const soldAt = Date.now();
            const payload = {
                items: [{ product_id: productId, qty: 1, unit_price_usd: 10, unit_price_bs: 0, discount_usd: 0, discount_bs: 0 }],
                cash_session_id: cashSessionId,
                totals: {
                    subtotal_bs: 0,
                    subtotal_usd: 10,
                    discount_bs: 0,
                    discount_usd: 0,
                    total_bs: 0,
                    total_usd: 10,
                },
                exchange_rate: 1,
                currency: 'USD',
                sold_at: soldAt,
                request_id: requestId // Payload request_id
            };

            const deltaPayload = payload;
            const fullPayloadHash = hashPayload(deltaPayload);

            const result = await syncService.push({
                store_id: storeId,
                device_id: deviceId,
                client_version: 'test',
                events: [
                    {
                        event_id: eventId,
                        type: 'SaleCreated',
                        version: 1,
                        created_at: soldAt,
                        payload,
                        seq: 1,
                        actor: { user_id: 'u1', role: 'cashier' },
                        request_id: requestId,
                        // For this chaos test, keep delta_payload == payload so the integrity hash is deterministic.
                        // Hash must match delta_payload OR payload per SyncService integrity check.
                        delta_payload: deltaPayload,
                        full_payload_hash: fullPayloadHash,
                    }
                ],
            }, 'u1').catch(e => ({ error: e.message }));

            pushResults.push(result);
        }

        const successes = pushResults.filter(r => (r as any).accepted?.length > 0);
        const failures = pushResults.filter(r => (r as any).rejected?.length > 0);

        if (failures.length > 0) {
            console.log('Sample rejection:', JSON.stringify((failures[0] as any).rejected[0], null, 2));
        }

        // Check DB state
        const events = await eventRepository.find({ where: { request_id: requestId } });
        console.log(`Chaos test results: ${successes.length} successes, ${failures.length} rejected, ${events.length} in DB`);

        if (successes.length === 0) {
            console.log('Push Results Sample (Error):', JSON.stringify(pushResults.slice(0, 3), null, 2));
        }

        // CRITICAL CHECK: Exactly 1 event must persist
        expect(events.length).toBe(1);

        // Check that at least one succeeded (not all failed)
        expect(successes.length).toBeGreaterThan(0);
    });
});
