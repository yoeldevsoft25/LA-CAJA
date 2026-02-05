import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { CashSession } from '../database/entities/cash-session.entity';
import { Sale } from '../database/entities/sale.entity';
import { CashMovement } from '../database/entities/cash-movement.entity';
import { Event } from '../database/entities/event.entity';
import { AccountingModule } from '../accounting/accounting.module';
import { SecurityModule } from '../security/security.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CashSession, Sale, CashMovement, Event]),
    AccountingModule,
    SecurityModule,
    SyncModule,
  ],
  controllers: [CashController],
  providers: [CashService],
  exports: [CashService],
})
export class CashModule {}
