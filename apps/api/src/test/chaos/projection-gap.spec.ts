
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
import { OrphanHealerService } from '../../sync/orphan-healer.service';
import { ProjectionsService } from '../../projections/projections.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Event } from '../../database/entities/event.entity';
import { DataSource } from 'typeorm';

jest.mock('../../projections/projections.service');

// Mocks
const mockEventRepository = () => ({
    manager: {
        query: jest.fn(),
    },
    save: jest.fn(),
});

const mockProjectionsService = () => ({
    projectEvent: jest.fn().mockResolvedValue(true),
});

const mockDataSource = () => ({
    transaction: jest.fn((cb) => cb({
        save: jest.fn(),
    })),
    query: jest.fn().mockResolvedValue([]),
});

describe('Chaos: Projection Gap Recovery', () => {
    let service: OrphanHealerService;
    let eventRepository: any;
    let projectionsService: any;
    let dataSource: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrphanHealerService,
                { provide: getRepositoryToken(Event), useFactory: mockEventRepository },
                { provide: ProjectionsService, useFactory: mockProjectionsService },
                { provide: DataSource, useFactory: mockDataSource },
            ],
        }).compile();

        service = module.get<OrphanHealerService>(OrphanHealerService);
        eventRepository = module.get(getRepositoryToken(Event));
        projectionsService = module.get(ProjectionsService);
        dataSource = module.get(DataSource);
    });

    it('should be defined', async () => {
        expect(service).toBeDefined();
    });
});
