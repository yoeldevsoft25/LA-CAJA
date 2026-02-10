import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FiscalSequenceService } from './fiscal-sequence.service';
import { FiscalController } from './fiscal.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FiscalController],
  providers: [FiscalSequenceService],
  exports: [FiscalSequenceService],
})
export class FiscalModule {}
