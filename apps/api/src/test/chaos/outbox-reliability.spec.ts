
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
import { OutboxService } from '../../sync/outbox.service';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Event } from '../../database/entities/event.entity';
import { ProjectionsService } from '../../projections/projections.service';
import { FederationSyncService } from '../../sync/federation-sync.service';

jest.mock('../../projections/projections.service');
jest.mock('../../sync/federation-sync.service');

// Mock DataSource
const mockDataSource = () => ({
    transaction: jest.fn(async (cb) => {
        const manager = {
            query: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
        };
        return await cb(manager);
    }),
});

const mockEventRepository = () => ({
    findOne: jest.fn(),
});

const mockProjectionsService = () => ({
    projectEvent: jest.fn(),
});

const mockFederationSyncService = () => ({
    queueRelay: jest.fn(),
});

describe('Chaos: Outbox Reliability', () => {
    let service: OutboxService;
    let eventRepository: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OutboxService,
                { provide: DataSource, useFactory: mockDataSource },
                { provide: getRepositoryToken(Event), useFactory: mockEventRepository },
                { provide: ProjectionsService, useFactory: mockProjectionsService },
                { provide: FederationSyncService, useFactory: mockFederationSyncService },
            ],
        }).compile();

        service = module.get<OutboxService>(OutboxService);
        eventRepository = module.get(getRepositoryToken(Event));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
