import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryEscrowController } from './inventory-escrow.controller';
import { InventoryEscrowService } from './inventory-escrow.service';
import { Event } from '../../database/entities/event.entity';
import { Product } from '../../database/entities/product.entity';
import { StockEscrow } from '../../database/entities/stock-escrow.entity';
import { SyncModule } from '../../sync/sync.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, Product, StockEscrow]),
    forwardRef(() => SyncModule),
  ],
  controllers: [InventoryEscrowController],
  providers: [InventoryEscrowService],
  exports: [InventoryEscrowService],
})
export class InventoryEscrowModule {}
