import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './common/metrics/metrics.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, MetricsService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return a healthy response', () => {
      expect(appController.getHealth().status).toBe('ok');
    });
  });
});
