import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductSerialsController } from './product-serials.controller';
import { ProductSerialsService } from './product-serials.service';
import { ProductSerial } from '../database/entities/product-serial.entity';
import { Product } from '../database/entities/product.entity';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';

/**
 * Módulo para gestión de seriales de productos
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ProductSerial, Product, Sale, SaleItem]),
  ],
  controllers: [ProductSerialsController],
  providers: [ProductSerialsService],
  exports: [ProductSerialsService],
})
export class ProductSerialsModule {}

