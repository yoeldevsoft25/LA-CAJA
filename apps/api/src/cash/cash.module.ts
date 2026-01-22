import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { CashSession } from '../database/entities/cash-session.entity';
import { Sale } from '../database/entities/sale.entity';
import { CashMovement } from '../database/entities/cash-movement.entity';
import { AccountingModule } from '../accounting/accounting.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CashSession, Sale, CashMovement]),
    AccountingModule,
    SecurityModule,
  ],
  controllers: [CashController],
  providers: [CashService],
  exports: [CashService],
})
export class CashModule {}
