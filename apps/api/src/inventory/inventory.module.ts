import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { Product } from '../database/entities/product.entity';
import { WarehouseStock } from '../database/entities/warehouse-stock.entity';
import { Event } from '../database/entities/event.entity';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { AccountingModule } from '../accounting/accounting.module';
import { SyncModule } from '../sync/sync.module';
import { OversellAlertService } from './oversell-alert.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryMovement,
      Product,
      WarehouseStock,
      Event,
    ]),
    WarehousesModule,
    AccountingModule,
    forwardRef(() => SyncModule),
    NotificationsModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService, OversellAlertService],
  exports: [InventoryService, OversellAlertService],
})
export class InventoryModule {}
