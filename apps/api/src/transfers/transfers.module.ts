import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';
import { Transfer } from '../database/entities/transfer.entity';
import { TransferItem } from '../database/entities/transfer-item.entity';
import { Warehouse } from '../database/entities/warehouse.entity';
import { Product } from '../database/entities/product.entity';
import { WarehousesModule } from '../warehouses/warehouses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transfer, TransferItem, Warehouse, Product]),
    WarehousesModule,
  ],
  controllers: [TransfersController],
  providers: [TransfersService],
  exports: [TransfersService],
})
export class TransfersModule {}
