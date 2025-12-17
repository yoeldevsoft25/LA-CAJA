import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductLotsController } from './product-lots.controller';
import { ProductLotsService } from './product-lots.service';
import { InventoryRulesService } from './inventory-rules.service';
import { ProductLot } from '../database/entities/product-lot.entity';
import { LotMovement } from '../database/entities/lot-movement.entity';
import { Product } from '../database/entities/product.entity';

/**
 * Módulo para gestión de lotes de productos
 */
@Module({
  imports: [TypeOrmModule.forFeature([ProductLot, LotMovement, Product])],
  controllers: [ProductLotsController],
  providers: [ProductLotsService, InventoryRulesService],
  exports: [ProductLotsService, InventoryRulesService],
})
export class ProductLotsModule {}
