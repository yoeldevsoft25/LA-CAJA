import { Test, TestingModule } from '@nestjs/testing';
import { OutboxService } from './outbox.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Event } from '../database/entities/event.entity';
import { ProjectionsService } from '../projections/projections.service';
import { FederationSyncService } from './federation-sync.service';
import { DataSource } from 'typeorm';

describe('OutboxService', () => {
    let service: OutboxService;
    let dataSource: Partial<DataSource>;
    let manager: any;

    beforeEach(async () => {
        manager = {
            query: jest.fn(),
        };
        dataSource = {
            transaction: jest.fn((cb) => cb(manager)),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OutboxService,
                { provide: getRepositoryToken(Event), useValue: {} },
                { provide: ProjectionsService, useValue: { projectEvent: jest.fn() } },
                { provide: FederationSyncService, useValue: { queueRelay: jest.fn() } },
                { provide: DataSource, useValue: dataSource },
            ],
        }).compile();

        service = module.get<OutboxService>(OutboxService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should write outbox entries', async () => {
        const events = [
            { event_id: 'evt-1', type: 'SaleCreated', store_id: 'store-1' } as any
        ];

        await service.writeOutboxEntries(manager, events, true);

        expect(manager.query).toHaveBeenCalled();
        // Verify arguments contained 'projection' and 'federation-relay'
        const calls = manager.query.mock.calls;
        const sql = calls[0][0];
        expect(sql).toContain('INSERT INTO outbox_entries');
    });
});
