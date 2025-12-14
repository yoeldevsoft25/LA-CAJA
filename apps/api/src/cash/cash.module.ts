import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { CashSession } from '../database/entities/cash-session.entity';
import { Sale } from '../database/entities/sale.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashSession, Sale])],
  controllers: [CashController],
  providers: [CashService],
  exports: [CashService],
})
export class CashModule {}

