import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Event } from '../database/entities/event.entity';
import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';

// ProjectionsService pulls WhatsApp/Baileys, which includes ESM-only deps that Jest won't parse in CJS mode.
jest.mock('../projections/projections.service', () => ({
    ProjectionsService: class ProjectionsService {
        projectEvent = jest.fn();
    },
}));

type OrphanHealerServiceT = import('./orphan-healer.service').OrphanHealerService;
const { OrphanHealerService } = require('./orphan-healer.service') as { OrphanHealerService: new (...args: any[]) => OrphanHealerServiceT };
const { ProjectionsService } = require('../projections/projections.service') as { ProjectionsService: any };

describe('OrphanHealerService', () => {
    let service: OrphanHealerServiceT;
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

        service = module.get<OrphanHealerServiceT>(OrphanHealerService);
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

    it('should discard permanent debt-payment orphans to avoid infinite retries', async () => {
        (dataSource.query as jest.Mock)
            .mockResolvedValueOnce([]) // Sales
            .mockResolvedValueOnce([]) // Debts
            .mockResolvedValueOnce([{ event_id: 'evt-pay-1', type: 'DebtPaymentRecorded' }]) // Payments
            .mockResolvedValueOnce([]); // Voids

        eventRepo.findOne.mockResolvedValue({
            event_id: 'evt-pay-1',
            type: 'DebtPaymentRecorded',
        });
        projectionsService.projectEvent.mockRejectedValue(
            new Error('La deuda debt-1 no existe para la tienda store-1'),
        );

        await service.healStore('store-1');

        expect(eventRepo.update).toHaveBeenCalledWith(
            'evt-pay-1',
            expect.objectContaining({ projection_status: 'discarded' }),
        );
    });
});
