
import { Test, TestingModule } from '@nestjs/testing';
import { FiscalSequenceService } from '../../fiscal/fiscal-sequence.service';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

// Mock DataSource
const mockDataSource = () => ({
    transaction: jest.fn(async (isolationLevelOrCb, cb) => {
        let callback = cb;
        if (typeof isolationLevelOrCb === 'function') {
            callback = isolationLevelOrCb;
        }

        const manager = {
            findOne: jest.fn(),
            save: jest.fn().mockImplementation(item => Promise.resolve({ ...item, range_start: 1, range_end: 50 })),
            createQueryBuilder: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            setLock: jest.fn().mockReturnThis(),
            getOne: jest.fn(),
            query: jest.fn().mockResolvedValue([]),
        };

        return await callback(manager);
    }),
});

describe('Chaos: Fiscal Range Safety', () => {
    let service: FiscalSequenceService;
    let dataSource: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FiscalSequenceService,
                { provide: getDataSourceToken(), useFactory: mockDataSource },
            ],
        }).compile();

        service = module.get<FiscalSequenceService>(FiscalSequenceService);
        dataSource = module.get(getDataSourceToken());
    });

    it('should request SERIALIZABLE transaction for range reservation', async () => {
        const storeId = 'store-1';
        const seriesId = 'series-A';
        const deviceId = 'dev-1';

        await service.reserveRange(storeId, seriesId, deviceId, 50);

        expect(dataSource.transaction).toHaveBeenCalledWith(
            'SERIALIZABLE',
            expect.any(Function)
        );
    });
});
