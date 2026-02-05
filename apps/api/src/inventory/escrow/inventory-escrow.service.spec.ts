import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InventoryEscrowService } from './inventory-escrow.service';
import { Event } from '../../database/entities/event.entity';
import { Product } from '../../database/entities/product.entity';
import { StockEscrow } from '../../database/entities/stock-escrow.entity';
import { FederationSyncService } from '../../sync/federation-sync.service';
import { DataSource, QueryFailedError } from 'typeorm';

describe('InventoryEscrowService Unit Tests (Idempotency)', () => {
    let service: InventoryEscrowService;
    let mockManager: any;

    const mockEventRepository = {
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn().mockImplementation((d) => d),
    };

    const mockProductRepository = {
        findOne: jest.fn(),
    };

    const mockStockEscrowRepository = {
        find: jest.fn(),
    };

    const mockFederationSyncService = {
        queueRelay: jest.fn(),
    };

    const mockDataSource = {
        transaction: jest.fn().mockImplementation(cb => cb(mockManager)),
    };

    beforeEach(async () => {
        mockManager = {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn().mockImplementation((entity, data) => data),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InventoryEscrowService,
                { provide: getRepositoryToken(Event), useValue: mockEventRepository },
                { provide: getRepositoryToken(Product), useValue: mockProductRepository },
                { provide: getRepositoryToken(StockEscrow), useValue: mockStockEscrowRepository },
                { provide: FederationSyncService, useValue: mockFederationSyncService },
                { provide: DataSource, useValue: mockDataSource },
            ],
        }).compile();

        service = module.get<InventoryEscrowService>(InventoryEscrowService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should grant quota and emit event', async () => {
        const dto = {
            product_id: 'prod-1',
            device_id: 'dev-1',
            qty: 10,
            request_id: 'req-1',
        };

        mockManager.findOne.mockResolvedValue({ id: 'prod-1', store_id: 'store-1' });
        mockManager.save.mockResolvedValue({ event_id: 'event-1', request_id: 'req-1' });

        const result = await service.grantQuota('store-1', 'user-1', dto);

        expect(result.success).toBe(true);
        expect(mockManager.save).toHaveBeenCalled();
        expect(mockFederationSyncService.queueRelay).toHaveBeenCalled();
    });

    it('should handle request_id already exists gracefully (transparent idempotency)', async () => {
        const dto = {
            product_id: 'prod-1',
            device_id: 'dev-1',
            qty: 10,
            request_id: 'req-already-exists',
        };

        // 0. Idempotency check finds the event
        mockManager.findOne.mockResolvedValueOnce({
            event_id: 'existing-event-id',
            request_id: 'req-already-exists'
        });

        const result = await service.grantQuota('store-1', 'user-1', dto);

        expect(result.success).toBe(true);
        expect(result.is_duplicate).toBe(true);
        expect(result.event_id).toBe('existing-event-id');

        // Should NOT try to find product or save anything
        expect(mockManager.save).not.toHaveBeenCalled();
    });
});
