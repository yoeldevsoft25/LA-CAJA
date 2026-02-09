
import { Test, TestingModule } from '@nestjs/testing';
import { FederationSyncService } from '../../sync/federation-sync.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Event } from '../../database/entities/event.entity';
import { ConfigService } from '@nestjs/config';
import { InventoryEscrowService } from '../../inventory/escrow/inventory-escrow.service';
import { ConflictAuditService } from '../../sync/conflict-audit.service';
import { DistributedLockService } from '../../common/distributed-lock.service';
import axios from 'axios';
import { Job, Queue } from 'bullmq';
import { DataSource } from 'typeorm';

// Mock Axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mocks
const mockEventRepository = () => ({
    findOne: jest.fn(),
});
const mockQueue = () => ({
    add: jest.fn(),
    getJob: jest.fn(),
    getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
    }),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
});
const mockConfigService = () => ({
    get: jest.fn((key) => {
        if (key === 'REMOTE_SYNC_URL') return 'http://remote-api';
        if (key === 'ADMIN_SECRET') return 'secret';
        return null;
    }),
});
const mockInventoryEscrowService = () => ({});
const mockConflictAuditService = () => ({});
const mockDistributedLockService = () => ({
    acquire: jest.fn().mockResolvedValue('lock-id'),
    release: jest.fn().mockResolvedValue(true),
});
const mockDataSource = () => ({});

describe('Chaos: Federation Partition', () => {
    let service: FederationSyncService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FederationSyncService,
                { provide: getRepositoryToken(Event), useFactory: mockEventRepository },
                { provide: getQueueToken('federation-sync'), useFactory: mockQueue },
                { provide: ConfigService, useFactory: mockConfigService },
                { provide: InventoryEscrowService, useFactory: mockInventoryEscrowService },
                { provide: ConflictAuditService, useFactory: mockConflictAuditService },
                { provide: DistributedLockService, useFactory: mockDistributedLockService },
                { provide: DataSource, useFactory: mockDataSource },
            ],
        }).compile();

        service = module.get<FederationSyncService>(FederationSyncService);
    });

    it('remote unreachable should track failures', async () => {
        mockedAxios.post.mockRejectedValue(new Error('Network Error'));

        const event = {
            event_id: 'evt-1',
            type: 'SaleCreated',
            payload: {},
            store_id: 's1',
            created_at: new Date()
        } as any;

        // Try several times
        for (let i = 0; i < 3; i++) {
            try {
                await (service as any).relayEventNow(event);
            } catch (e) {
                // Expected
            }
        }

        const status = await service.getFederationStatus();
        expect(status.remoteProbe?.ok).toBe(false);
    });
});
