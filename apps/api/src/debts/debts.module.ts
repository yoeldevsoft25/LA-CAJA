import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebtsController } from './debts.controller';
import { DebtsService } from './debts.service';
import { Debt } from '../database/entities/debt.entity';
import { DebtPayment } from '../database/entities/debt-payment.entity';
import { Customer } from '../database/entities/customer.entity';
import { Sale } from '../database/entities/sale.entity';
import { Event } from '../database/entities/event.entity';
import { ExchangeModule } from '../exchange/exchange.module';
import { AccountingModule } from '../accounting/accounting.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Debt, DebtPayment, Customer, Sale, Event]),
    ExchangeModule,
    AccountingModule,
    WhatsAppModule,
    forwardRef(() => SyncModule),
  ],
  controllers: [DebtsController],
  providers: [DebtsService],
  exports: [DebtsService],
})
export class DebtsModule { }
