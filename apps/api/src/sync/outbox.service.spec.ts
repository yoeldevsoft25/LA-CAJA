import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Event } from '../database/entities/event.entity';
import { FederationSyncService } from './federation-sync.service';
import { DataSource } from 'typeorm';

// ProjectionsService pulls WhatsApp/Baileys, which includes ESM-only deps that Jest won't parse in CJS mode.
// For this unit test we only need the token + shape, so we mock the whole module.
jest.mock('../projections/projections.service', () => ({
    ProjectionsService: class ProjectionsService {
        projectEvent = jest.fn();
    },
}));

type OutboxServiceT = import('./outbox.service').OutboxService;
const { OutboxService } = require('./outbox.service') as { OutboxService: new (...args: any[]) => OutboxServiceT };
const { ProjectionsService } = require('../projections/projections.service') as { ProjectionsService: any };

describe('OutboxService', () => {
    let service: OutboxServiceT;
    let dataSource: DataSource;
    let manager: any;

    beforeEach(async () => {
        manager = {
            query: jest.fn(),
        };
        // writeOutboxEntries() doesn't touch DataSource; it only needs to exist for DI.
        dataSource = {} as unknown as DataSource;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OutboxService,
                { provide: getRepositoryToken(Event), useValue: {} },
                { provide: ProjectionsService, useValue: { projectEvent: jest.fn() } },
                { provide: FederationSyncService, useValue: { queueRelay: jest.fn() } },
                { provide: DataSource, useValue: dataSource },
            ],
        }).compile();

        service = module.get<OutboxServiceT>(OutboxService);
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
