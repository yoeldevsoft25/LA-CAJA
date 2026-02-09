import { Test, TestingModule } from '@nestjs/testing';
import { OrphanHealerService } from './orphan-healer.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Event } from '../database/entities/event.entity';
import { ProjectionsService } from '../projections/projections.service';
import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';

describe('OrphanHealerService', () => {
    let service: OrphanHealerService;
    let dataSource: Partial<DataSource>;
    let eventRepo: any;
    let projectionsService: any;

    beforeEach(async () => {
        dataSource = {
            query: jest.fn(),
        };
        eventRepo = {
            findOne: jest.fn(),
            update: jest.fn(),
        };
        projectionsService = {
            projectEvent: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrphanHealerService,
                { provide: getRepositoryToken(Event), useValue: eventRepo },
                { provide: ProjectionsService, useValue: projectionsService },
                { provide: DataSource, useValue: dataSource },
            ],
        }).compile();

        service = module.get<OrphanHealerService>(OrphanHealerService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should heal orphaned events', async () => {
        // Mock getActiveStoreIds
        (dataSource.query as jest.Mock).mockResolvedValueOnce([{ store_id: 'store-1' }]);

        // Mock get orphans (4 queries)
        (dataSource.query as jest.Mock)
            .mockResolvedValueOnce([{ event_id: 'evt-1', type: 'SaleCreated' }]) // Sales
            .mockResolvedValueOnce([]) // Debts
            .mockResolvedValueOnce([]) // Payments
            .mockResolvedValueOnce([]); // Voids

        // Mock findOne
        eventRepo.findOne.mockResolvedValue({ event_id: 'evt-1', type: 'SaleCreated' });

        await service.autoHealCron();

        expect(projectionsService.projectEvent).toHaveBeenCalledWith(expect.objectContaining({ event_id: 'evt-1' }));
        expect(eventRepo.update).toHaveBeenCalledWith('evt-1', expect.objectContaining({ projection_status: 'processed' }));
    });
});
