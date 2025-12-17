import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FiscalConfigsController } from './fiscal-configs.controller';
import { FiscalConfigsService } from './fiscal-configs.service';
import { FiscalConfig } from '../database/entities/fiscal-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FiscalConfig])],
  controllers: [FiscalConfigsController],
  providers: [FiscalConfigsService],
  exports: [FiscalConfigsService],
})
export class FiscalConfigsModule {}
