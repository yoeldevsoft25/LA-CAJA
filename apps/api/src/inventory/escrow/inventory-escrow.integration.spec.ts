import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ProjectionsService } from '../../projections/projections.service';
import { InventoryEscrowService } from './inventory-escrow.service';
import { Event } from '../../database/entities/event.entity';
import { Product } from '../../database/entities/product.entity';
import { ProductVariant } from '../../database/entities/product-variant.entity';
import { Warehouse } from '../../database/entities/warehouse.entity';
import { WarehouseStock } from '../../database/entities/warehouse-stock.entity';
import { StockEscrow } from '../../database/entities/stock-escrow.entity';
import { InventoryMovement } from '../../database/entities/inventory-movement.entity';
import { Sale } from '../../database/entities/sale.entity';
import { SaleItem } from '../../database/entities/sale-item.entity';
import { Store } from '../../database/entities/store.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Debt } from '../../database/entities/debt.entity';
import { DebtPayment } from '../../database/entities/debt-payment.entity';
import { CashSession } from '../../database/entities/cash-session.entity';
import { CashLedgerEntry } from '../../database/entities/cash-ledger-entry.entity';
import { WarehousesService } from '../../warehouses/warehouses.service';
import { SyncMetricsService } from '../../observability/services/sync-metrics.service';
import { WhatsAppMessagingService } from '../../whatsapp/whatsapp-messaging.service';
import { FiscalInvoicesService } from '../../fiscal-invoices/fiscal-invoices.service';
import { InvoiceSeriesService } from '../../invoice-series/invoice-series.service';
import { FederationSyncService } from '../../sync/federation-sync.service';
import { getMetadataArgsStorage } from 'typeorm';

// Mock WhatsApp to avoid ESM issues in Jest
jest.mock('../../whatsapp/whatsapp-messaging.service');
jest.mock('../../whatsapp/whatsapp-bot.service');
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

describe('Stock Convergence Integration (Offline -> Sync -> Projections)', () => {
    let moduleFixture: TestingModule;
    let projectionsService: ProjectionsService;
    let dataSource: DataSource;
    let storeId: string;
    let productId: string;
    let deviceId: string;

    const mockEntityManager = {
        getRepository: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        findOne: jest.fn(),
        query: jest.fn().mockResolvedValue([{ current_number: 100 }]),
    } as unknown as EntityManager;

    const mockDataSource = {
        transaction: jest.fn().mockImplementation(async (cb) => cb(mockEntityManager)),
        manager: mockEntityManager,
    } as unknown as DataSource;

    const mockRepo = {
        findOne: jest.fn(),
        find: jest.fn(),
        save: jest.fn().mockImplementation(item => Promise.resolve(item as any)),
        create: jest.fn().mockImplementation(item => item as any),
        update: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getCount: jest.fn().mockResolvedValue(0),
            select: jest.fn().mockReturnThis(),
            getOne: jest.fn(),
            getMany: jest.fn(),
        })),
    };

    beforeAll(async () => {
        moduleFixture = await Test.createTestingModule({
            providers: [
                ProjectionsService,
                { provide: DataSource, useValue: mockDataSource },
                { provide: getRepositoryToken(Event), useValue: mockRepo },
                { provide: getRepositoryToken(Product), useValue: mockRepo },
                { provide: getRepositoryToken(ProductVariant), useValue: mockRepo },
                { provide: getRepositoryToken(Warehouse), useValue: mockRepo },
                { provide: getRepositoryToken(WarehouseStock), useValue: mockRepo },
                { provide: getRepositoryToken(StockEscrow), useValue: mockRepo },
                { provide: getRepositoryToken(InventoryMovement), useValue: mockRepo },
                { provide: getRepositoryToken(Sale), useValue: mockRepo },
                { provide: getRepositoryToken(SaleItem), useValue: mockRepo },
                { provide: getRepositoryToken(Store), useValue: mockRepo },
                { provide: getRepositoryToken(CashSession), useValue: mockRepo },
                { provide: getRepositoryToken(CashLedgerEntry), useValue: mockRepo },
                { provide: getRepositoryToken(Customer), useValue: mockRepo },
                { provide: getRepositoryToken(Debt), useValue: mockRepo },
                { provide: getRepositoryToken(DebtPayment), useValue: mockRepo },
                { provide: WarehousesService, useValue: { updateStock: jest.fn().mockResolvedValue(true), updateStockBatch: jest.fn().mockResolvedValue(true), getDefaultOrFirst: jest.fn().mockResolvedValue({ id: 'w1' }), findOne: jest.fn().mockResolvedValue({ id: 'w1' }) } },
                { provide: FederationSyncService, useValue: { queueRelay: jest.fn().mockResolvedValue(true) } },
                { provide: SyncMetricsService, useValue: { trackOutOfOrderEvent: jest.fn(), trackProjectionRetry: jest.fn(), trackProjectionFailureFatal: jest.fn() } },
                { provide: WhatsAppMessagingService, useValue: { sendSaleNotification: jest.fn() } },
                { provide: FiscalInvoicesService, useValue: { hasActiveFiscalConfig: jest.fn().mockResolvedValue(false), createFromSale: jest.fn() } },
                { provide: InvoiceSeriesService, useValue: { generateNextInvoiceNumber: jest.fn().mockResolvedValue({ series: { id: 's1' }, invoice_number: '1', invoice_full_number: 'F1' }) } },
            ]
        }).compile();

        projectionsService = moduleFixture.get<ProjectionsService>(ProjectionsService);
        dataSource = moduleFixture.get<DataSource>(DataSource);

        storeId = uuidv4();
        productId = uuidv4();
        deviceId = uuidv4();
    });

    afterAll(async () => {
        if (moduleFixture) {
            await moduleFixture.close();
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();
        (mockEntityManager.getRepository as jest.Mock).mockReturnValue(mockRepo);
    });

    it('should correctly balance stock between warehouse and escrow after multiple sales', async () => {
        // 1. Grant Escrow Quota (10 units)
        await projectionsService.projectEvent({
            type: 'StockQuotaGranted',
            store_id: storeId,
            payload: {
                product_id: productId,
                device_id: deviceId,
                qty_granted: 10,
                quota_id: uuidv4(),
                request_id: uuidv4()
            },
            created_at: new Date()
        } as any);

        // Verify state: save was called for StockEscrow via the repository (not in a transaction)
        expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            product_id: productId,
            device_id: deviceId,
            qty_granted: 10
        }));

        // 2. Simulate Sale (5 units) using the escrow
        const saleId = uuidv4();
        // Mock existing escrow
        const currentEscrow = { product_id: productId, device_id: deviceId, qty_granted: 10, expires_at: new Date(Date.now() + 1000000) };

        // Setup mocks for this specific operation
        mockRepo.find.mockResolvedValue([currentEscrow]);
        mockRepo.findOne.mockImplementation((entity) => {
            if (entity === Sale) return Promise.resolve(null);
            return Promise.resolve(null);
        });

        await projectionsService.projectEvent({
            type: 'SaleCreated',
            store_id: storeId,
            device_id: deviceId,
            actor_user_id: 'test-user',
            payload: {
                sale_id: saleId,
                device_id: deviceId,
                sold_at: new Date(),
                items: [{
                    product_id: productId,
                    qty: 5,
                    unit_price_usd: 10
                }],
                totals: { total_usd: 50 },
                payment: { method: 'CASH_USD' }
            },
            created_at: new Date()
        } as any);

        // Verify state: Escrow was updated (10 -> 5)
        expect(currentEscrow.qty_granted).toBe(5);
        expect(mockEntityManager.save).toHaveBeenCalledWith(currentEscrow);

        // 3. Simulate another Sale (10 units) - Consumes rest of escrow (5) and touches warehouse (5)
        const saleId2 = uuidv4();
        await projectionsService.projectEvent({
            type: 'SaleCreated',
            store_id: storeId,
            device_id: deviceId,
            actor_user_id: 'test-user',
            payload: {
                sale_id: saleId2,
                device_id: deviceId,
                sold_at: new Date(),
                items: [{
                    product_id: productId,
                    qty: 10,
                    unit_price_usd: 10
                }],
                totals: { total_usd: 100 }
            },
            created_at: new Date()
        } as any);

        // Verify state: Escrow is now 0
        expect(currentEscrow.qty_granted).toBe(0);

        // Verify WarehousesService was called for the remaining 5 units
        const warehousesService = moduleFixture.get<WarehousesService>(WarehousesService);
        expect(warehousesService.updateStockBatch).toHaveBeenCalledWith(
            expect.anything(),
            expect.arrayContaining([expect.objectContaining({ product_id: productId, qty_delta: -5 })]),
            expect.anything(),
            expect.anything()
        );
    });
});
