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

jest.mock('../projections/projections.service', () => ({
    ProjectionsService: class ProjectionsService {
        projectEvent = jest.fn();
    },
}));

describe('Idempotency Chaos Test (Concurrent Request Deduplication)', () => {
    let moduleFixture: TestingModule;
    let syncService: SyncService;
    let dataSource: DataSource;
    let eventRepository: Repository<Event>;

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
                { provide: DiscountRulesService, useValue: {} },
                { provide: UsageService, useValue: { increment: jest.fn() } },
                { provide: SyncMetricsService, useValue: { trackOutOfOrderEvent: jest.fn(), trackSyncPush: jest.fn(), trackSyncPull: jest.fn(), trackProjectionFailureFatal: jest.fn(), trackSyncProcessed: jest.fn() } },
                { provide: FederationSyncService, useValue: { queueRelay: jest.fn() } },
                { provide: getQueueToken('sales-projections'), useValue: { add: jest.fn() } },
            ]
        }).compile();

        syncService = moduleFixture.get<SyncService>(SyncService);
        dataSource = moduleFixture.get<DataSource>(DataSource);
        eventRepository = moduleFixture.get<Repository<Event>>(getRepositoryToken(Event));
    }, 30000);

    afterAll(async () => {
        await moduleFixture.close();
    });

    it('should successfully deduplicate 100 identical events sent concurrently', async () => {
        const storeId = uuidv4();
        const deviceId = uuidv4();
        const requestId = uuidv4();

        // Simulate 100 concurrent pushes of the SAME request_id
        // NOTE: In a real environment, the DB unique constraint IDX_events_request_id_unique 
        // will prevent duplicate inserts even if the application-level check misses due to race conditions.

        const pushResults = await Promise.all(
            Array.from({ length: 100 }).map(async (_, idx) => {
                const eventId = uuidv4(); // Each retry might have a new event_id but same request_id

                // Add small random jitter to avoid SQLite transaction locks (cannot start transaction within transaction)
                // in-memory SQLite is very sensitive to concurrent transaction starts.
                await new Promise(resolve => setTimeout(resolve, Math.random() * 200));

                return syncService.push({
                    store_id: storeId,
                    device_id: deviceId,
                    client_version: 'test',
                    events: [
                        {
                            event_id: eventId,
                            type: 'SaleCreated',
                            version: 1,
                            created_at: Date.now(),
                            payload: {
                                items: [{ product_id: 'p1', qty: 1 }],
                                cash_session_id: 's1',
                                request_id: requestId // Payload request_id
                            },
                            seq: 1,
                            actor: { user_id: 'u1', role: 'cashier' },
                            request_id: requestId,
                            delta_payload: { items: [{ product_id: 'p1', qty: 1 }] },
                            full_payload_hash: '22ac0b5357cd36771f02ce58be4c3ff80fa954bdf24fc1b9aac130afd5307745' // Matching server expected hash
                        }
                    ],
                }, 'u1').catch(e => {
                    // We expect some to fail with "UNIQUE constraint failed" if the app-level check 
                    // doesn't catch them in time (parallel processing), but the DB will.
                    return { error: e.message };
                });
            })
        );

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
