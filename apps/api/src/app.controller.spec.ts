import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: DataSource,
          useValue: {
            isInitialized: true,
            query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('ping', () => {
    it('should return ping status', () => {
      const ping = appController.ping();
      expect(ping).toHaveProperty('status', 'ok');
      expect(ping).toHaveProperty('message', 'Service is alive');
    });
  });
});

