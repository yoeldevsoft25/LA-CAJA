import { Test, TestingModule } from '@nestjs/testing';
import { ProjectionsService } from './projections.service';
import { SalesProjectionQueueProcessor } from '../sales/queues/sales-projection.queue';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Sale } from '../database/entities/sale.entity';
import { Event } from '../database/entities/event.entity';
import { Product } from '../database/entities/product.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { CashSession } from '../database/entities/cash-session.entity';
import { Customer } from '../database/entities/customer.entity';
import { DebtPayment } from '../database/entities/debt-payment.entity';
import { RecipeIngredient } from '../database/entities/recipe-ingredient.entity';
import { Debt } from '../database/entities/debt.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { SyncMetricsService } from '../observability/services/sync-metrics.service';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WarehousesService } from '../warehouses/warehouses.service';
import { FiscalInvoicesService } from '../fiscal-invoices/fiscal-invoices.service';
import { WhatsAppMessagingService } from '../whatsapp/whatsapp-messaging.service';

// Mock WhatsApp to avoid ESM issues
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

const mockEntityManager = {
    getRepository: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findOne: jest.fn(),
} as unknown as EntityManager;

const mockDataSource = {
    transaction: jest.fn().mockImplementation(async (cb) => cb(mockEntityManager)),
    createEntityManager: jest.fn(),
} as unknown as DataSource;

const mockWarehousesService = {
    updateStockBatch: jest.fn(),
    resolveWarehouseId: jest.fn().mockResolvedValue('warehouse-1'),
    getDefaultOrFirst: jest.fn().mockResolvedValue({ id: 'warehouse-1' }),
    findOne: jest.fn().mockResolvedValue({ id: 'warehouse-1' }),
};

const mockRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        select: jest.fn().mockReturnThis(),
    })),
};

describe('Sprint 6.1A Final Hardening Verification', () => {
    let processor: SalesProjectionQueueProcessor;
    let projectionsService: ProjectionsService;
    let saleRepo: Repository<Sale>;
    let eventRepo: Repository<Event>;
    let debtRepo: Repository<Debt>;
    let movementRepo: Repository<InventoryMovement>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SalesProjectionQueueProcessor,
                ProjectionsService,
                { provide: getRepositoryToken(Sale), useValue: mockRepo },
                { provide: getRepositoryToken(Event), useValue: mockRepo },
                { provide: getRepositoryToken(InventoryMovement), useValue: mockRepo },
                { provide: getRepositoryToken(Debt), useValue: mockRepo },
                { provide: DataSource, useValue: mockDataSource },
                { provide: WarehousesService, useValue: mockWarehousesService },
                { provide: SyncMetricsService, useValue: { trackProjectionRetry: jest.fn(), trackProjectionFailureFatal: jest.fn() } },
                { provide: FiscalInvoicesService, useValue: { hasActiveFiscalConfig: jest.fn().mockResolvedValue(false), findBySale: jest.fn().mockResolvedValue(null) } },
                { provide: WhatsAppMessagingService, useValue: {} },
                // Add other repositories needed by ProjectionsService
                { provide: getRepositoryToken(InventoryMovement), useValue: mockRepo },
                { provide: getRepositoryToken(Debt), useValue: mockRepo },
                // Specific tokens for ProjectionsService
                { provide: getRepositoryToken(Product), useValue: mockRepo },
                { provide: getRepositoryToken(SaleItem), useValue: mockRepo },
                { provide: getRepositoryToken(CashSession), useValue: mockRepo },
                { provide: getRepositoryToken(Customer), useValue: mockRepo },
                { provide: getRepositoryToken(DebtPayment), useValue: mockRepo },
                { provide: getRepositoryToken(RecipeIngredient), useValue: mockRepo },
            ],
        }).compile();

        processor = module.get<SalesProjectionQueueProcessor>(SalesProjectionQueueProcessor);
        projectionsService = module.get<ProjectionsService>(ProjectionsService);
        saleRepo = module.get(getRepositoryToken(Sale));
        eventRepo = module.get(getRepositoryToken(Event));
        debtRepo = module.get(getRepositoryToken(Debt));
        movementRepo = module.get(getRepositoryToken(InventoryMovement));

        jest.spyOn(Logger.prototype, 'log').mockImplementation(() => { });
        jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => { });
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => { });
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should PROCEED to projection if Sale exists but Items missing (Partial Repair)', async () => {
        const payload = { sale_id: 's1', items: [{ product_id: 'p1', qty: 1 }] };
        const event = { type: 'SaleCreated', event_id: 'e1', payload, store_id: 'st1', actor_user_id: 'u1' } as any;
        const job = { data: { event } } as Job;

        // Mock Sale exists
        jest.spyOn(saleRepo, 'findOne').mockResolvedValue({ id: 's1', items: [] } as any); // items empty = Partial

        // Mock projectEvent
        const projectSpy = jest.spyOn(projectionsService, 'projectEvent').mockResolvedValue(undefined);

        await processor.process(job as any);

        expect(saleRepo.findOne).toHaveBeenCalled();
        // Since it's partial, it should NOT return early, thus it calls projectEvent
        expect(projectSpy).toHaveBeenCalledWith(event);
    });

    it('should SKIP projection if Sale + Items exist (Complete)', async () => {
        const payload = { sale_id: 's1', items: [{ product_id: 'p1', qty: 1 }] };
        const event = { type: 'SaleCreated', event_id: 'e1', payload, store_id: 'st1', actor_user_id: 'u1' } as any;
        const job = { data: { event } } as Job;

        // Mock Sale exists AND has items
        jest.spyOn(saleRepo, 'findOne').mockResolvedValue({ id: 's1', items: [{ id: 'i1' }] } as any);
        // Mock Movement count matches (1 item -> 1 movement)
        jest.spyOn(movementRepo, 'createQueryBuilder').mockReturnValue({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getCount: jest.fn().mockResolvedValue(1),
        } as any);

        const projectSpy = jest.spyOn(projectionsService, 'projectEvent');

        await processor.process(job as any);

        // Should return early, marking as processed
        expect(projectSpy).not.toHaveBeenCalled();
        expect(eventRepo.update).toHaveBeenCalledWith('e1', {
            projection_status: 'processed',
            projection_error: null,
        });
    });

    it('should PASS transaction manager to warehousesService.updateStockBatch', async () => {
        const payload = {
            sale_id: 's1',
            warehouse_id: 'w1',
            items: [{ product_id: 'p1', qty: 1, variant_id: null }],
            totals: { total_bs: 100 },
        };
        const event = { type: 'SaleCreated', event_id: 'e1', payload, store_id: 'st1', actor_user_id: 'u1' } as any;

        // Mock dependencies for projectSaleCreated
        (mockEntityManager.getRepository as jest.Mock).mockReturnValue(mockRepo); // Return repo for create/save
        mockRepo.save.mockResolvedValue({ id: 's1', customer_id: null }); // sale saved
        mockRepo.findOne.mockResolvedValue(null); // Sale doesn't exist yet
        mockRepo.createQueryBuilder.mockReturnValue({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getCount: jest.fn().mockResolvedValue(0),
            select: jest.fn().mockReturnThis(),
        });
        jest.spyOn(projectionsService as unknown as { resolveWarehouseId: (storeId: string, candidateWarehouseId?: string | null) => Promise<string | null> }, 'resolveWarehouseId')
            .mockResolvedValue('w1');

        // Spy on updateStockBatch
        const updateStockSpy = mockWarehousesService.updateStockBatch;

        await projectionsService.projectEvent(event);

        expect(mockDataSource.transaction).toHaveBeenCalled();
        expect(updateStockSpy).toHaveBeenCalledWith(
            'w1', // warehouseId
            expect.arrayContaining([{ product_id: 'p1', variant_id: null, qty_delta: -1 }]),
            'st1', // storeId
            mockEntityManager // CRITICAL: Manager passed?
        );
    });

    it('should ROLLBACK transaction if Debt creation fails', async () => {
        const payload = {
            sale_id: 's1',
            items: [],
            payment: { method: 'FIAO' },
            totals: { total_bs: 100 },
            customer_id: 'c1'
        };
        const event = { type: 'SaleCreated', event_id: 'e1', payload, store_id: 'st1', actor_user_id: 'u1' } as any;

        // Force error in Debt creation
        (mockDataSource.transaction as jest.Mock).mockImplementation(async (cb: any) => {
            await cb(mockEntityManager);
        });

        (mockEntityManager.getRepository as jest.Mock).mockImplementation((entity) => {
            if (entity === Sale) return mockRepo;
            if (entity === Debt) throw new Error('Debt Fail'); // Fail here
            return mockRepo;
        });
        mockRepo.save.mockResolvedValue({ id: 's1', customer_id: 'c1' });

        // Assert throws
        await expect(projectionsService.projectEvent(event)).rejects.toThrow('Debt Fail');
        // If it throws inside transaction callback, TypeORM rolls back.
        // We verify that the logic propagated the error.
    });

});
